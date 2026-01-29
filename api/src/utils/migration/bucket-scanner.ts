/**
 * Bucket Scanner
 * Scans MinIO bucket for non-compliant files
 */

import type { ObjectEntry, FilePair } from './types';
import { isValidStoragePath, STORAGE_TYPES, isUrlEncodedRootPath, decodeRootPath } from './path-validator';
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
 *
 * Handles both regular keys and URL-encoded keys (using decoded key for matching)
 */
export function groupNonCompliantPairs(files: ObjectEntry[]): FilePair[] {
  const pairs: FilePair[] = [];
  const jsonMap = new Map<string, ObjectEntry>(); // decoded key -> ObjectEntry

  // Build map of JSON file paths (using decoded key for matching)
  for (const file of files) {
    const matchKey = file.key;
    if (matchKey.endsWith('.json')) {
      jsonMap.set(matchKey, file);
    }
  }

  // Match images with their JSON files
  for (const file of files) {
    const matchKey = file.key;
    const ext = IMAGE_EXTENSIONS.find((e) =>
      matchKey.toLowerCase().endsWith(e)
    );
    if (!ext) continue;

    // Pattern 1: {stem}.json
    const stem = matchKey.slice(0, -ext.length);
    const jsonPath1 = `${stem}.json`;

    // Pattern 2: {imagePath}.json
    const jsonPath2 = `${matchKey}.json`;

    const jsonEntry = jsonMap.get(jsonPath1) || jsonMap.get(jsonPath2);
    if (jsonEntry) {
      pairs.push({
        imagePath: file.key,
        jsonPath: jsonEntry.key,
        originalImagePath: file.originalKey,
        originalJsonPath: jsonEntry.originalKey,
      });
    }
  }

  return pairs;
}

/**
 * Scan bucket root for URL-encoded files
 * These are files stored at root level with %2F encoded path separators
 */
export async function scanBucketRootForUrlEncoded(): Promise<ObjectEntry[]> {
  // List files at bucket root (empty prefix, non-recursive)
  // We use delimiter '/' to only get root-level objects
  const allRootFiles = await listObjectsByPrefix('', '/');

  const urlEncodedFiles: ObjectEntry[] = [];
  for (const file of allRootFiles) {
    if (isUrlEncodedRootPath(file.key)) {
      // Store decoded key for matching, original key for retrieval
      urlEncodedFiles.push({
        key: decodeRootPath(file.key),
        originalKey: file.key,
        size: file.size,
        lastModified: file.lastModified?.toISOString(),
      });
    }
  }

  return urlEncodedFiles;
}

/**
 * Convert minio listing result to ObjectEntry
 */
function toObjectEntry(file: { key: string; size?: number; lastModified?: Date }): ObjectEntry {
  return {
    key: file.key,
    size: file.size,
    lastModified: file.lastModified?.toISOString(),
  };
}

/**
 * Scan bucket for all non-compliant file pairs
 * Scans each storage type prefix and bucket root, returns paired files
 */
export async function scanBucketForNonCompliant(
  onProgress?: (type: string, count: number) => void
): Promise<FilePair[]> {
  const allNonCompliantFiles: ObjectEntry[] = [];

  // Scan each storage type prefix
  for (const type of STORAGE_TYPES) {
    const files = await listObjectsByPrefix(`${type}/`);
    const entries = files.map(toObjectEntry);
    const nonCompliant = filterNonCompliantFiles(entries);
    allNonCompliantFiles.push(...nonCompliant);
    onProgress?.(type, nonCompliant.length);
  }

  // Scan bucket root for URL-encoded files
  const urlEncodedFiles = await scanBucketRootForUrlEncoded();
  if (urlEncodedFiles.length > 0) {
    allNonCompliantFiles.push(...urlEncodedFiles);
    onProgress?.('url-encoded-root', urlEncodedFiles.length);
  }

  return groupNonCompliantPairs(allNonCompliantFiles);
}
