/**
 * Uncategorized Handler
 * Utilities for handling uncategorized files
 */

import { UNCATEGORIZED_PATH_PATTERN, type FilePair } from './types';

/**
 * Check if path contains uncategorized pattern
 */
export function isUncategorizedPath(path: string): boolean {
  if (!path) return false;
  return path.includes(UNCATEGORIZED_PATH_PATTERN);
}

/**
 * Get prefix for scanning uncategorized files
 */
export function getUncategorizedPrefix(type: string, dateMonth?: string): string {
  if (dateMonth) {
    return `${type}/${dateMonth}/${UNCATEGORIZED_PATH_PATTERN}/`;
  }
  return `${type}/`;
}

/**
 * Group files into image/JSON pairs
 */
export function groupUncategorizedPairs(
  files: { key: string }[]
): FilePair[] {
  const pairs: FilePair[] = [];
  const jsonMap = new Map<string, string>();

  // Build map of JSON files by stem
  for (const file of files) {
    if (file.key.endsWith('.json')) {
      const stem = file.key.slice(0, -5); // Remove .json
      jsonMap.set(stem, file.key);
    }
  }

  // Match images with their JSON files
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  for (const file of files) {
    const ext = imageExtensions.find(e => file.key.toLowerCase().endsWith(e));
    if (ext) {
      const stem = file.key.slice(0, -ext.length);
      const jsonPath = jsonMap.get(stem);
      if (jsonPath) {
        pairs.push({
          imagePath: file.key,
          jsonPath: jsonPath,
        });
      }
    }
  }

  return pairs;
}
