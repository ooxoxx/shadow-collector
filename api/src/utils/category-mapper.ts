/**
 * Category Mapper Utility
 * Maps annotation labels to category paths based on classes.csv
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface CategoryInfo {
  category1: string;  // 专业
  category2: string;  // 部件名称/场景分类
}

// Label -> Category mapping (loaded from CSV)
const labelCategoryMap = new Map<string, CategoryInfo>();

/**
 * Load classes.csv and build label -> category mapping
 */
export function loadCategoryMapping(): void {
  // Navigate from api/src/utils to project root docs folder
  const csvPath = join(__dirname, '..', '..', '..', 'docs', 'classes.csv');

  try {
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    // Skip header (line 1) and process data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSV structure: 专业,部件名称/场景分类,部位名称/场景名称,状态描述/场景描述,标注标签
      const columns = line.split(',');
      if (columns.length >= 5) {
        const category1 = columns[0].replace(/^﻿/, '').trim(); // Remove BOM if present
        const category2 = columns[1].trim();
        const label = columns[4].trim();

        if (label && category1 && category2) {
          labelCategoryMap.set(label, { category1, category2 });
        }
      }
    }

    console.log(`✅ 已加载 ${labelCategoryMap.size} 个标签分类映射 from ${csvPath}`);
  } catch (error) {
    console.error('❌ 加载分类映射失败:', error);
    throw error;
  }
}

/**
 * Extract labels from detection annotations
 * Annotation structure: { value: { rectanglelabels: ["021_gt_hd_xs"] }, type: "rectanglelabels" }
 */
export function extractLabelsFromAnnotations(annotations: unknown[]): string[] {
  const labels = new Set<string>();

  for (const annotation of annotations) {
    if (typeof annotation === 'object' && annotation !== null) {
      const ann = annotation as Record<string, unknown>;

      // Check for rectanglelabels in value
      if (ann.value && typeof ann.value === 'object') {
        const value = ann.value as Record<string, unknown>;
        if (Array.isArray(value.rectanglelabels)) {
          for (const label of value.rectanglelabels) {
            if (typeof label === 'string') {
              labels.add(label);
            }
          }
        }
      }
    }
  }

  return Array.from(labels);
}

/**
 * Get all unique category combinations for given labels
 * Returns array of unique {category1, category2} combinations
 */
export function getCategoriesFromLabels(labels: string[]): CategoryInfo[] {
  const categoriesSet = new Set<string>();
  const categories: CategoryInfo[] = [];

  for (const label of labels) {
    const categoryInfo = labelCategoryMap.get(label);
    if (categoryInfo) {
      // Use stringified version as set key for uniqueness
      const key = `${categoryInfo.category1}/${categoryInfo.category2}`;
      if (!categoriesSet.has(key)) {
        categoriesSet.add(key);
        categories.push(categoryInfo);
      }
    }
  }

  return categories;
}

/**
 * Get category info for a single label (for debugging)
 */
export function getCategoryForLabel(label: string): CategoryInfo | undefined {
  return labelCategoryMap.get(label);
}
