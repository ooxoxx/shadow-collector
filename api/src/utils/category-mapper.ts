/**
 * Category Mapper Utility
 * Maps annotation labels to category paths based on classes.csv
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface CategoryInfo {
  category1: string;  // 专业
  category2: string;  // 部件名称/场景分类 (empty string = single-level directory)
}

// Label -> Category mapping (loaded from CSV)
const labelCategoryMap = new Map<string, CategoryInfo>();

// Label prefix -> category1 mapping for fallback categorization
const LABEL_PREFIX_TO_CATEGORY1: Record<string, string> = {
  '011': '安监',
  '021': '设备-输电',
  '022': '设备-变电',
  '023': '设备-配电',
  '031': '营销',
  '041': '基建',
};

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
 * Extract 3-digit prefix from a label
 * @example "021_gt_hd_xs" -> "021"
 */
export function extractPrefixFromLabel(label: string): string | null {
  const match = label.match(/^(\d{3})_/);
  return match ? match[1] : null;
}

/**
 * Get category1 from label prefix
 * @example "021" -> "设备-输电"
 */
export function getCategory1FromPrefix(prefix: string): string | null {
  return LABEL_PREFIX_TO_CATEGORY1[prefix] ?? null;
}

/**
 * Internal type to track label categorization source
 */
interface LabelCategoryResult {
  label: string;
  category: CategoryInfo | null;
  source: 'csv' | 'prefix' | 'unknown';
}

/**
 * Categorize a single label with source tracking
 */
function categorizeLabelWithSource(label: string): LabelCategoryResult {
  // First try CSV lookup
  const csvCategory = labelCategoryMap.get(label);
  if (csvCategory) {
    return { label, category: csvCategory, source: 'csv' };
  }

  // Then try prefix mapping
  const prefix = extractPrefixFromLabel(label);
  if (prefix) {
    const category1 = getCategory1FromPrefix(prefix);
    if (category1) {
      return {
        label,
        category: { category1, category2: '未分类' },
        source: 'prefix',
      };
    }
  }

  // Completely unknown
  return { label, category: null, source: 'unknown' };
}

/**
 * Filter categories based on rules:
 * 1. If ANY label has a specific category -> exclude top-level 未分类/
 * 2. If category1 has ANY specific category2 -> exclude <category1>/未分类
 */
function filterCategoriesByRules(results: LabelCategoryResult[]): CategoryInfo[] {
  // Check if any label has a specific (CSV) category
  const hasSpecificCategory = results.some(r => r.source === 'csv');

  // Group results by category1
  const category1Groups = new Map<string, { hasSpecific: boolean; categories: CategoryInfo[] }>();

  for (const result of results) {
    if (!result.category) continue;

    const { category1, category2 } = result.category;
    const isSpecific = result.source === 'csv';

    if (!category1Groups.has(category1)) {
      category1Groups.set(category1, { hasSpecific: false, categories: [] });
    }

    const group = category1Groups.get(category1)!;
    if (isSpecific) {
      group.hasSpecific = true;
    }
    group.categories.push(result.category);
  }

  // Collect final categories with filtering
  const categoriesSet = new Set<string>();
  const categories: CategoryInfo[] = [];

  // If any label has specific category, exclude completely unknown labels (top-level 未分类/)
  // Otherwise, if all labels are unknown, use single-level 未分类/
  const allUnknown = results.every(r => r.source === 'unknown');

  if (allUnknown) {
    // All labels are completely unknown -> use single-level 未分类/ (empty category2)
    return [{ category1: '未分类', category2: '' }];
  }

  for (const [category1, group] of category1Groups) {
    for (const category of group.categories) {
      const isUnclassifiedCategory2 = category.category2 === '未分类';

      // Skip <category1>/未分类 if this category1 has any specific category2
      if (isUnclassifiedCategory2 && group.hasSpecific) {
        continue;
      }

      // Use stringified version as set key for uniqueness
      const key = category.category2 ? `${category.category1}/${category.category2}` : category.category1;
      if (!categoriesSet.has(key)) {
        categoriesSet.add(key);
        categories.push(category);
      }
    }
  }

  return categories;
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
 *
 * Categorization logic:
 * 1. First check CSV for exact label match
 * 2. If not found, try prefix mapping (e.g., "021_..." -> "设备-输电/未分类")
 * 3. If all labels are completely unknown, return single-level "未分类/"
 *
 * Filtering rules:
 * - If ANY label has a specific category -> exclude top-level 未分类/
 * - If category1 has ANY specific category2 -> exclude <category1>/未分类
 */
export function getCategoriesFromLabels(labels: string[]): CategoryInfo[] {
  if (!labels || labels.length === 0) {
    return [];
  }

  // Categorize each label with source tracking
  const results: LabelCategoryResult[] = labels.map(label => categorizeLabelWithSource(label));

  // Log categorization results for debugging
  for (const result of results) {
    if (result.source === 'csv') {
      console.log(`  📋 标签 "${result.label}" -> ${result.category!.category1}/${result.category!.category2} (CSV)`);
    } else if (result.source === 'prefix') {
      console.log(`  📋 标签 "${result.label}" -> ${result.category!.category1}/未分类 (前缀映射)`);
    } else {
      console.log(`  ⚠️ 标签 "${result.label}" -> 未分类 (无法识别)`);
    }
  }

  // Apply filtering rules
  const categories = filterCategoriesByRules(results);

  if (categories.length > 0) {
    const pathStrings = categories.map(c => c.category2 ? `${c.category1}/${c.category2}` : `${c.category1}/`);
    console.log(`  ✅ 最终分类路径: ${pathStrings.join(', ')}`);
  }

  return categories;
}

/**
 * Get category info for a single label (for debugging)
 */
export function getCategoryForLabel(label: string): CategoryInfo | undefined {
  return labelCategoryMap.get(label);
}
