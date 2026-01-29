/**
 * File Processor
 * Utilities for processing file pairs during migration
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { ObjectEntry, FilePair, MetadataJson } from './types';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

// Label ID -> Label string mapping (loaded lazily)
let labelIdMap: Map<number, string> | null = null;

/**
 * Load label-id-map.json and build id -> label mapping
 */
function loadLabelIdMap(): Map<number, string> {
  if (labelIdMap) return labelIdMap;

  labelIdMap = new Map<number, string>();
  // From api/src/utils/migration/ to api/assets/
  const jsonPath = join(__dirname, '..', '..', '..', 'assets', 'label-id-map.json');

  try {
    const jsonContent = readFileSync(jsonPath, 'utf-8');
    const mapping = JSON.parse(jsonContent) as Record<string, string>;

    for (const [idStr, label] of Object.entries(mapping)) {
      const id = parseInt(idStr, 10);
      if (!isNaN(id)) {
        labelIdMap.set(id, label);
      }
    }
  } catch {
    // Silently fail - labelIds conversion will be skipped
  }

  return labelIdMap;
}

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
 * Supports two naming patterns:
 * - Pattern 1: {stem}.json (e.g., image.json for image.jpg)
 * - Pattern 2: {imagePath}.json (e.g., image.jpg.json for image.jpg)
 */
export function matchFilePairs(images: string[], jsons: string[]): FilePair[] {
  const pairs: FilePair[] = [];
  const jsonSet = new Set(jsons);

  for (const imagePath of images) {
    const ext = IMAGE_EXTENSIONS.find(e =>
      imagePath.toLowerCase().endsWith(e)
    );
    if (!ext) continue;

    // Pattern 1: {stem}.json
    const stem = imagePath.slice(0, -ext.length);
    const jsonPath1 = `${stem}.json`;

    // Pattern 2: {imagePath}.json
    const jsonPath2 = `${imagePath}.json`;

    if (jsonSet.has(jsonPath1)) {
      pairs.push({ imagePath, jsonPath: jsonPath1 });
    } else if (jsonSet.has(jsonPath2)) {
      pairs.push({ imagePath, jsonPath: jsonPath2 });
    }
  }

  return pairs;
}

/**
 * Extract labels from metadata JSON
 * Supports three formats:
 * - Format 1: Direct labels array (ShadowCollector storage format)
 * - Format 2: annotations[].value.rectanglelabels (Label Studio format)
 * - Format 3: labelIds array converted via label-id-map.json (Classify workflow)
 */
export function extractLabelsFromMetadata(metadata: MetadataJson): string[] {
  if (!metadata) return [];

  const labels = new Set<string>();

  // Format 1: Direct labels array (ShadowCollector storage format)
  if (Array.isArray(metadata.labels)) {
    for (const label of metadata.labels) {
      if (typeof label === 'string') {
        labels.add(label);
      }
    }
  }

  // Format 2: annotations[].value.rectanglelabels (Label Studio format)
  if (Array.isArray(metadata.annotations)) {
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
  }

  // Format 3: labelIds array (Classify workflow) - convert via label-id-map.json
  if (labels.size === 0 && Array.isArray(metadata.labelIds)) {
    const idMap = loadLabelIdMap();
    for (const id of metadata.labelIds) {
      if (typeof id === 'number') {
        const label = idMap.get(id);
        if (label) {
          labels.add(label);
        }
      }
    }
  }

  return Array.from(labels);
}
