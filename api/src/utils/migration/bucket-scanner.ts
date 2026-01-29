/**
 * Bucket Scanner
 * Scans MinIO bucket for non-compliant files
 */

import type { ObjectEntry, FilePair } from './types';
import { isValidStoragePath, STORAGE_TYPES } from './path-validator';
import { listObjectsByPrefix } from '../../services/minio';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Filter files that don't comply with standard storage path format
 */
export function filterNonCompliantFiles(files: ObjectEntry[]): ObjectEntry[] {
  return files.filter((file) => !isValidStoragePath(file.key));
}

/**
 * Group non-compliant files into image/JSON pairs
 * Supports two naming patterns:
 * - Pattern 1: {stem}.json (e.g., image.json for image.jpg)
 * - Pattern 2: {imagePath}.json (e.g., image.jpg.json for image.jpg)
 */
export function groupNonCompliantPairs(files: ObjectEntry[]): FilePair[] {
  const pairs: FilePair[] = [];
  const jsonSet = new Set<string>();

  // Build set of JSON file paths
  for (const file of files) {
    if (file.key.endsWith('.json')) {
      jsonSet.add(file.key);
    }
  }

  // Match images with their JSON files
  for (const file of files) {
    const ext = IMAGE_EXTENSIONS.find((e) =>
      file.key.toLowerCase().endsWith(e)
    );
    if (!ext) continue;

    // Pattern 1: {stem}.json
    const stem = file.key.slice(0, -ext.length);
    const jsonPath1 = `${stem}.json`;

    // Pattern 2: {imagePath}.json
    const jsonPath2 = `${file.key}.json`;

    if (jsonSet.has(jsonPath1)) {
      pairs.push({ imagePath: file.key, jsonPath: jsonPath1 });
    } else if (jsonSet.has(jsonPath2)) {
      pairs.push({ imagePath: file.key, jsonPath: jsonPath2 });
    }
  }

  return pairs;
}

/**
 * Scan bucket for all non-compliant file pairs
 * Scans each storage type prefix and returns paired files
 */
export async function scanBucketForNonCompliant(
  onProgress?: (type: string, count: number) => void
): Promise<FilePair[]> {
  const allNonCompliantFiles: ObjectEntry[] = [];

  for (const type of STORAGE_TYPES) {
    const files = await listObjectsByPrefix(`${type}/`);
    const nonCompliant = filterNonCompliantFiles(files);
    allNonCompliantFiles.push(...nonCompliant);
    onProgress?.(type, nonCompliant.length);
  }

  return groupNonCompliantPairs(allNonCompliantFiles);
}
