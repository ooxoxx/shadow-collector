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
 *   --dry-run           Preview changes without executing
 *   --verbose           Show detailed output
 *   --obj-list <path>   Path to obj.json file (default: /app/logs/obj.json)
 *   --classes <path>    Path to classes.csv file (default: /docs/classes.csv)
 *   --reclassify        Re-process uncategorized files only
 *   --list-uncategorized List uncategorized files without migrating
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
} from '../utils/migration';

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(`
MinIO Storage Migration Script

Usage: bun run migrate [options]

Options:
  --dry-run             Preview changes without executing
  --verbose, -v         Show detailed output
  --obj-list <path>     Path to obj.json file (default: /app/logs/obj.json)
  --classes <path>      Path to classes.csv file (default: /docs/classes.csv)
  --reclassify          Re-process uncategorized files only
  --list-uncategorized  List uncategorized files without migrating
  --help, -h            Show this help message
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
  };
}

/**
 * Check prerequisites
 */
async function checkPrerequisites(options: MigrationOptions): Promise<void> {
  log('info', 'Checking prerequisites...');

  // Check MinIO connection
  await checkMinioConnection();

  // For reclassify mode, we don't need obj.json
  if (!options.reclassify && !options.listUncategorized) {
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

    if (options.listUncategorized) {
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
