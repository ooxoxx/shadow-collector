/**
 * Label ID Mapper Utility
 * Maps label IDs (numbers) to label strings based on label-id-map.json
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Label ID -> Label string mapping (loaded from JSON)
const labelIdMap = new Map<number, string>();

/**
 * Load label-id-map.json and build id -> label mapping
 */
export function loadLabelIdMapping(): void {
  // Navigate from api/src/utils to api/assets folder
  const jsonPath = join(__dirname, '..', '..', 'assets', 'label-id-map.json');

  try {
    const jsonContent = readFileSync(jsonPath, 'utf-8');
    const mapping = JSON.parse(jsonContent) as Record<string, string>;

    // Convert string keys to numbers
    for (const [idStr, label] of Object.entries(mapping)) {
      const id = parseInt(idStr, 10);
      if (!isNaN(id)) {
        labelIdMap.set(id, label);
      }
    }

    console.log(`✅ 已加载 ${labelIdMap.size} 个 Label ID 映射 from ${jsonPath}`);
  } catch (error) {
    console.error('❌ 加载 Label ID 映射失败:', error);
    throw error;
  }
}

/**
 * Convert label IDs to label strings
 * Returns labels for all valid IDs, skips unknown IDs
 */
export function getLabelsFromIds(labelIds: number[]): string[] {
  const labels: string[] = [];

  for (const id of labelIds) {
    const label = labelIdMap.get(id);
    if (label) {
      labels.push(label);
    } else {
      console.warn(`⚠️ Unknown label ID: ${id}`);
    }
  }

  return labels;
}

/**
 * Get label string for a single ID (for debugging)
 */
export function getLabelForId(id: number): string | undefined {
  return labelIdMap.get(id);
}
