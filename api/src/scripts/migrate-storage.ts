#!/usr/bin/env bun
/**
 * MinIO Storage Migration Script
 * Migrates files from old directory structure to new category-based structure:
 *   {type}/{YYYY-MM}/{category1}/{category2}/{filename}
 *
 * Usage:
 *   bun run src/scripts/migrate-storage.ts [options]
 *
 * Options:
 *   --dry-run              Preview changes without executing
 *   --verbose              Show detailed output
 *   --obj-list <path>      Path to obj.json file (default: /app/logs/obj.json)
 *   --classes <path>       Path to classes.csv file (default: /docs/classes.csv)
 *   --reclassify           Re-process uncategorized files only
 *   --list-uncategorized   List uncategorized files without migrating
 *   --scan-all             Scan all files, auto-detect and migrate non-compliant paths
 *   --list-non-compliant   List non-compliant files without migrating
 */

import { readFileSync, existsSync } from 'fs';
import { parseArgs } from 'util';
import {
  checkMinioConnection,
  getObject,
  moveObject,
  listObjectsByPrefix,
} from '../services/minio';
import {
  loadCategoryMapping,
  getCategoriesFromLabels,
} from '../utils/category-mapper';
import {
  type MigrationOptions,
  type FilePair,
  type CategoryInfo,
  UNCATEGORIZED_CATEGORY,
  StatsTracker,
  parseObjectList,
  separateFileTypes,
  matchFilePairs,
  extractLabelsFromMetadata,
  extractTypeFromPath,
  extractDateFromPath,
  calculateNewPath,
  isCorrectLocation,
  isUncategorizedPath,
  groupUncategorizedPairs,
  scanBucketForNonCompliant,
  getPathViolationType,
} from '../utils/migration';

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(level: 'info' | 'success' | 'warn' | 'error', message: string): void {
  const prefixes = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[OK]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
  };
  console.log(`${prefixes[level]} ${message}`);
}

let verboseMode = false;
function logVerbose(message: string): void {
  if (verboseMode) {
    console.log(`${colors.blue}[DEBUG]${colors.reset} ${message}`);
  }
}

/**
 * Parse CLI arguments
 */
function parseCliArgs(): MigrationOptions {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      'obj-list': { type: 'string', default: '/app/logs/obj.json' },
      classes: { type: 'string', default: '/docs/classes.csv' },
      reclassify: { type: 'boolean', default: false },
      'list-uncategorized': { type: 'boolean', default: false },
      'scan-all': { type: 'boolean', default: false },
      'list-non-compliant': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(`
MinIO Storage Migration Script

Usage: bun run migrate [options]

Options:
  --dry-run              Preview changes without executing
  --verbose, -v          Show detailed output
  --obj-list <path>      Path to obj.json file (default: /app/logs/obj.json)
  --classes <path>       Path to classes.csv file (default: /docs/classes.csv)
  --reclassify           Re-process uncategorized files only
  --list-uncategorized   List uncategorized files without migrating
  --scan-all             Scan all files, auto-detect and migrate non-compliant paths
  --list-non-compliant   List non-compliant files without migrating
  --help, -h             Show this help message

Standard path format: {type}/{YYYY-MM}/{category1}/{category2}/{filename}

Non-compliant path formats detected:
  - old-taskid:       {type}/{YYYY-MM-DD}/{32-char-hex-taskId}/{filename}
  - old-flat:         {type}/{YYYY-MM-DD}/{filename}
  - url-encoded-root: Files at bucket root with URL-encoded paths
                      e.g., detection%2F2024-01%2Fcategory%2Ffile.jpg
`);
    process.exit(0);
  }

  return {
    dryRun: values['dry-run'] ?? false,
    verbose: values.verbose ?? false,
    objListPath: values['obj-list'] ?? '/app/logs/obj.json',
    classesPath: values.classes ?? '/docs/classes.csv',
    reclassify: values.reclassify ?? false,
    listUncategorized: values['list-uncategorized'] ?? false,
    scanAll: values['scan-all'] ?? false,
    listNonCompliant: values['list-non-compliant'] ?? false,
  };
}

/**
 * Check prerequisites
 */
async function checkPrerequisites(options: MigrationOptions): Promise<void> {
  log('info', 'Checking prerequisites...');

  // Check MinIO connection
  await checkMinioConnection();

  // For scan-all, reclassify, list modes - we don't need obj.json
  const needsObjJson = !options.reclassify &&
                       !options.listUncategorized &&
                       !options.scanAll &&
                       !options.listNonCompliant;

  if (needsObjJson) {
    if (!existsSync(options.objListPath)) {
      throw new Error(`Object list not found: ${options.objListPath}`);
    }
  }

  // Load category mapping (modifies global state in category-mapper)
  loadCategoryMapping();

  log('success', 'All prerequisites met');
}

/**
 * Get category for labels
 */
function getCategoryForLabels(labels: string[]): CategoryInfo {
  if (!labels || labels.length === 0) {
    return UNCATEGORIZED_CATEGORY;
  }
  const categories = getCategoriesFromLabels(labels);
  return categories.length > 0 ? categories[0] : UNCATEGORIZED_CATEGORY;
}

/**
 * Process a single file pair
 */
async function processFilePair(
  pair: FilePair,
  options: MigrationOptions,
  stats: StatsTracker
): Promise<void> {
  logVerbose(`Processing: ${pair.imagePath}`);

  try {
    // Download and parse JSON metadata
    const jsonBuffer = await getObject(pair.jsonPath);
    const metadata = JSON.parse(jsonBuffer.toString('utf-8'));
    const labels = extractLabelsFromMetadata(metadata);

    logVerbose(`Labels extracted: ${labels.join(', ') || '(none)'}`);

    // Get category and calculate new paths
    const category = getCategoryForLabels(labels);
    const dateMonth = extractDateFromPath(pair.imagePath);

    const newImagePath = calculateNewPath(pair.imagePath, dateMonth, category);
    const newJsonPath = calculateNewPath(pair.jsonPath, dateMonth, category);

    // Check if already in correct location
    if (isCorrectLocation(pair.imagePath, newImagePath)) {
      logVerbose(`Already correct: ${pair.imagePath}`);
      stats.record('skipped');
      return;
    }

    // Move files
    if (options.dryRun) {
      log('info', `[DRY-RUN] Would move: ${pair.imagePath} -> ${newImagePath}`);
    } else {
      await moveObject(pair.imagePath, newImagePath);
      await moveObject(pair.jsonPath, newJsonPath);
      logVerbose(`Moved: ${pair.imagePath} -> ${newImagePath}`);
    }

    stats.record('migrated');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log('error', `Failed to process ${pair.imagePath}: ${msg}`);
    stats.record('error');
  }
}

/**
 * Run main migration from obj.json
 */
async function runMigration(
  options: MigrationOptions,
  stats: StatsTracker
): Promise<void> {
  log('info', 'Starting migration...');

  if (options.dryRun) {
    log('warn', 'DRY-RUN MODE - No changes will be made');
  }

  // Read and parse object list
  const content = readFileSync(options.objListPath, 'utf-8');
  const entries = parseObjectList(content);
  const { images, jsons } = separateFileTypes(entries);

  log('info', `Found ${images.length} images and ${jsons.length} JSON files`);

  // Match file pairs
  const pairs = matchFilePairs(images, jsons);
  log('info', `Matched ${pairs.length} file pairs`);

  // Process each pair
  for (const pair of pairs) {
    await processFilePair(pair, options, stats);
  }
}

/**
 * Scan and list uncategorized files
 */
async function scanUncategorizedFiles(): Promise<FilePair[]> {
  log('info', 'Scanning for uncategorized files...');

  const types = ['detection', 'multimodal', 'text-qa', 'classify', 'qa-pair'];
  const allFiles: { key: string }[] = [];

  for (const type of types) {
    const files = await listObjectsByPrefix(`${type}/`);
    const uncategorized = files.filter(f => isUncategorizedPath(f.key));
    allFiles.push(...uncategorized);
  }

  const pairs = groupUncategorizedPairs(allFiles);
  log('info', `Found ${pairs.length} uncategorized file pairs`);

  return pairs;
}

/**
 * Reclassify uncategorized files
 */
async function runReclassify(
  options: MigrationOptions,
  stats: StatsTracker
): Promise<void> {
  log('info', 'Starting reclassification of uncategorized files...');

  if (options.dryRun) {
    log('warn', 'DRY-RUN MODE - No changes will be made');
  }

  const pairs = await scanUncategorizedFiles();

  for (const pair of pairs) {
    await processReclassifyPair(pair, options, stats);
  }
}

/**
 * Process a single pair for reclassification
 */
async function processReclassifyPair(
  pair: FilePair,
  options: MigrationOptions,
  stats: StatsTracker
): Promise<void> {
  logVerbose(`Reclassifying: ${pair.imagePath}`);

  try {
    const jsonBuffer = await getObject(pair.jsonPath);
    const metadata = JSON.parse(jsonBuffer.toString('utf-8'));
    const labels = extractLabelsFromMetadata(metadata);

    const category = getCategoryForLabels(labels);

    // Skip if still uncategorized
    if (category.category1 === '未分类') {
      logVerbose(`Still uncategorized: ${pair.imagePath}`);
      stats.record('skipped');
      return;
    }

    const dateMonth = extractDateFromPath(pair.imagePath);
    const newImagePath = calculateNewPath(pair.imagePath, dateMonth, category);
    const newJsonPath = calculateNewPath(pair.jsonPath, dateMonth, category);

    if (options.dryRun) {
      log('info', `[DRY-RUN] Would reclassify: ${pair.imagePath} -> ${newImagePath}`);
    } else {
      await moveObject(pair.imagePath, newImagePath);
      await moveObject(pair.jsonPath, newJsonPath);
      log('success', `Reclassified: ${pair.imagePath} -> ${newImagePath}`);
    }

    stats.record('reclassified');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log('error', `Failed to reclassify ${pair.imagePath}: ${msg}`);
    stats.record('error');
  }
}

/**
 * List uncategorized files only
 */
async function listUncategorized(): Promise<void> {
  const pairs = await scanUncategorizedFiles();

  if (pairs.length === 0) {
    log('info', 'No uncategorized files found');
    return;
  }

  console.log('\nUncategorized files:');
  for (const pair of pairs) {
    console.log(`  ${pair.imagePath}`);
  }
  console.log(`\nTotal: ${pairs.length} file pairs`);
}

/**
 * Scan all files and migrate non-compliant paths
 */
async function runScanAll(
  options: MigrationOptions,
  stats: StatsTracker
): Promise<void> {
  log('info', 'Scanning all files for non-compliant paths...');

  if (options.dryRun) {
    log('warn', 'DRY-RUN MODE - No changes will be made');
  }

  const pairs = await scanBucketForNonCompliant((type, count) => {
    logVerbose(`Scanned ${type}/: found ${count} non-compliant files`);
  });
  log('info', `Found ${pairs.length} non-compliant file pairs`);

  if (pairs.length === 0) {
    log('success', 'All files are compliant with standard path format');
    return;
  }

  // Group by violation type for reporting
  const byType = new Map<string, number>();
  for (const pair of pairs) {
    const violationType = getPathViolationType(pair.imagePath);
    byType.set(violationType, (byType.get(violationType) || 0) + 1);
  }

  console.log('\nViolation types found:');
  for (const [type, count] of byType) {
    console.log(`  ${colors.cyan}${type}${colors.reset}: ${count} pairs`);
  }
  console.log('');

  // Process each pair
  for (const pair of pairs) {
    await processNonCompliantPair(pair, options, stats);
  }
}

/**
 * Process a single non-compliant file pair
 * For URL-encoded files, uses originalPath for retrieval and decoded path for destination
 */
async function processNonCompliantPair(
  pair: FilePair,
  options: MigrationOptions,
  stats: StatsTracker
): Promise<void> {
  const violationType = getPathViolationType(pair.imagePath);
  logVerbose(`Processing (${violationType}): ${pair.imagePath}`);

  // Use original path for retrieval if available (URL-encoded files)
  const sourceImagePath = pair.originalImagePath ?? pair.imagePath;
  const sourceJsonPath = pair.originalJsonPath ?? pair.jsonPath;

  try {
    // Download and parse JSON metadata using source path
    const jsonBuffer = await getObject(sourceJsonPath);
    const metadata = JSON.parse(jsonBuffer.toString('utf-8'));
    const labels = extractLabelsFromMetadata(metadata);

    logVerbose(`Labels extracted: ${labels.join(', ') || '(none)'}`);

    // Get category and calculate new paths (using decoded path)
    const category = getCategoryForLabels(labels);
    const dateMonth = extractDateFromPath(pair.imagePath);

    const newImagePath = calculateNewPath(pair.imagePath, dateMonth, category);
    const newJsonPath = calculateNewPath(pair.jsonPath, dateMonth, category);

    // Move files
    if (options.dryRun) {
      log('info', `[DRY-RUN] Would move (${violationType}):`);
      if (pair.originalImagePath) {
        console.log(`    ${colors.yellow}(encoded) ${sourceImagePath}${colors.reset}`);
        console.log(`    ${colors.red}(decoded) ${pair.imagePath}${colors.reset}`);
      } else {
        console.log(`    ${colors.red}${pair.imagePath}${colors.reset}`);
      }
      console.log(`    ${colors.green}-> ${newImagePath}${colors.reset}`);
    } else {
      await moveObject(sourceImagePath, newImagePath);
      await moveObject(sourceJsonPath, newJsonPath);
      log('success', `Migrated: ${pair.imagePath} -> ${newImagePath}`);
    }

    stats.record('migrated');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log('error', `Failed to process ${pair.imagePath}: ${msg}`);
    stats.record('error');
  }
}

/**
 * List non-compliant files only
 */
async function listNonCompliant(): Promise<void> {
  log('info', 'Scanning for non-compliant files...');

  const pairs = await scanBucketForNonCompliant((type, count) => {
    console.log(`  Scanned ${type}/: ${count} non-compliant files`);
  });

  if (pairs.length === 0) {
    log('success', 'All files are compliant with standard path format');
    return;
  }

  // Group by violation type
  const byType = new Map<string, FilePair[]>();
  for (const pair of pairs) {
    const violationType = getPathViolationType(pair.imagePath);
    if (!byType.has(violationType)) {
      byType.set(violationType, []);
    }
    byType.get(violationType)!.push(pair);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Non-compliant files by violation type:');
  console.log('='.repeat(60));

  for (const [type, typePairs] of byType) {
    console.log(`\n${colors.cyan}[${type}]${colors.reset} (${typePairs.length} pairs):`);
    for (const pair of typePairs) {
      if (pair.originalImagePath) {
        // URL-encoded file: show both original and decoded paths
        console.log(`  ${colors.yellow}(encoded)${colors.reset} ${pair.originalImagePath}`);
        console.log(`  ${colors.blue}(decoded)${colors.reset} ${pair.imagePath}`);
      } else {
        console.log(`  ${pair.imagePath}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${pairs.length} non-compliant file pairs`);
  console.log('='.repeat(60));
  console.log(`\nRun with ${colors.yellow}--scan-all${colors.reset} to migrate these files`);
  console.log(`Run with ${colors.yellow}--scan-all --dry-run${colors.reset} to preview migration`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('==========================================');
  console.log('MinIO Storage Migration Script');
  console.log('==========================================');

  const options = parseCliArgs();
  verboseMode = options.verbose;

  try {
    await checkPrerequisites(options);

    const stats = new StatsTracker();

    if (options.listNonCompliant) {
      await listNonCompliant();
    } else if (options.scanAll) {
      await runScanAll(options, stats);
      stats.complete();
      console.log(stats.printSummary());
    } else if (options.listUncategorized) {
      await listUncategorized();
    } else if (options.reclassify) {
      await runReclassify(options, stats);
      stats.complete();
      console.log(stats.printSummary());
    } else {
      await runMigration(options, stats);
      stats.complete();
      console.log(stats.printSummary());
    }

    if (options.dryRun) {
      log('warn', 'DRY-RUN: No files were moved');
      log('info', 'Run without --dry-run to execute');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log('error', msg);
    process.exit(1);
  }
}

main();
