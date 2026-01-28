/**
 * File Processor
 * Utilities for processing file pairs during migration
 */

import type { ObjectEntry, FilePair, MetadataJson } from './types';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Parse object list from NDJSON or JSON array format
 */
export function parseObjectList(content: string): ObjectEntry[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  // Try JSON array first
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to NDJSON
    }
  }

  // Parse as NDJSON
  const entries: ObjectEntry[] = [];
  for (const line of trimmed.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    try {
      entries.push(JSON.parse(l));
    } catch {
      // Skip invalid lines
    }
  }
  return entries;
}

/**
 * Separate entries into images and JSON files
 */
export function separateFileTypes(entries: ObjectEntry[]): {
  images: string[];
  jsons: string[];
} {
  const images: string[] = [];
  const jsons: string[] = [];

  for (const entry of entries) {
    const key = entry.key.toLowerCase();
    if (key.endsWith('.json')) {
      jsons.push(entry.key);
    } else if (IMAGE_EXTENSIONS.some(ext => key.endsWith(ext))) {
      images.push(entry.key);
    }
  }

  return { images, jsons };
}

/**
 * Match images with their metadata JSON files
 */
export function matchFilePairs(images: string[], jsons: string[]): FilePair[] {
  const pairs: FilePair[] = [];
  const jsonSet = new Set(jsons);

  for (const imagePath of images) {
    const ext = IMAGE_EXTENSIONS.find(e =>
      imagePath.toLowerCase().endsWith(e)
    );
    if (!ext) continue;

    const stem = imagePath.slice(0, -ext.length);
    const jsonPath = `${stem}.json`;

    if (jsonSet.has(jsonPath)) {
      pairs.push({ imagePath, jsonPath });
    }
  }

  return pairs;
}

/**
 * Extract labels from metadata JSON
 */
export function extractLabelsFromMetadata(metadata: MetadataJson): string[] {
  if (!metadata || !metadata.annotations) return [];

  const labels = new Set<string>();

  for (const annotation of metadata.annotations) {
    const rectanglelabels = annotation?.value?.rectanglelabels;
    if (Array.isArray(rectanglelabels)) {
      for (const label of rectanglelabels) {
        if (typeof label === 'string') {
          labels.add(label);
        }
      }
    }
  }

  return Array.from(labels);
}
