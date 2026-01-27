/**
 * Unit Tests for Category Mapper Utility
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import {
  loadCategoryMapping,
  extractLabelsFromAnnotations,
  getCategoriesFromLabels,
  getCategoryForLabel,
} from '../../src/utils/category-mapper';

// Load mappings before tests
beforeAll(() => {
  loadCategoryMapping();
});

describe('extractLabelsFromAnnotations', () => {
  test('extracts labels from valid rectanglelabels annotation', () => {
    const annotations = [
      {
        type: 'rectanglelabels',
        value: {
          rectanglelabels: ['label1', 'label2'],
          x: 10,
          y: 10,
          width: 100,
          height: 100,
        },
      },
    ];

    const labels = extractLabelsFromAnnotations(annotations);
    expect(labels).toContain('label1');
    expect(labels).toContain('label2');
    expect(labels.length).toBe(2);
  });

  test('returns empty array for empty annotations', () => {
    const labels = extractLabelsFromAnnotations([]);
    expect(labels).toEqual([]);
  });

  test('handles null annotation gracefully', () => {
    const annotations = [null, undefined];
    const labels = extractLabelsFromAnnotations(annotations as unknown[]);
    expect(labels).toEqual([]);
  });

  test('handles annotation without value property', () => {
    const annotations = [{ type: 'rectanglelabels' }];
    const labels = extractLabelsFromAnnotations(annotations);
    expect(labels).toEqual([]);
  });

  test('handles annotation with non-object value', () => {
    const annotations = [{ type: 'rectanglelabels', value: 'string' }];
    const labels = extractLabelsFromAnnotations(annotations);
    expect(labels).toEqual([]);
  });

  test('handles annotation with non-array rectanglelabels', () => {
    const annotations = [
      { type: 'rectanglelabels', value: { rectanglelabels: 'not-array' } },
    ];
    const labels = extractLabelsFromAnnotations(annotations);
    expect(labels).toEqual([]);
  });

  test('filters out non-string labels', () => {
    const annotations = [
      {
        type: 'rectanglelabels',
        value: { rectanglelabels: ['valid', 123, null, 'also-valid'] },
      },
    ];
    const labels = extractLabelsFromAnnotations(annotations);
    expect(labels).toContain('valid');
    expect(labels).toContain('also-valid');
    expect(labels.length).toBe(2);
  });

  test('deduplicates labels across multiple annotations', () => {
    const annotations = [
      { type: 'rectanglelabels', value: { rectanglelabels: ['label1'] } },
      { type: 'rectanglelabels', value: { rectanglelabels: ['label1', 'label2'] } },
    ];
    const labels = extractLabelsFromAnnotations(annotations);
    expect(labels.length).toBe(2);
  });
});

describe('getCategoriesFromLabels', () => {
  test('returns empty array for empty labels', () => {
    const categories = getCategoriesFromLabels([]);
    expect(categories).toEqual([]);
  });

  test('returns empty array for unknown labels', () => {
    const categories = getCategoriesFromLabels(['unknown_label_xyz']);
    expect(categories).toEqual([]);
  });

  test('returns category for known label', () => {
    // Use a known label from the CSV
    const categories = getCategoriesFromLabels(['021_gt_hd_xs']);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toHaveProperty('category1');
    expect(categories[0]).toHaveProperty('category2');
  });

  test('deduplicates categories from same category path', () => {
    // Two labels from same category should return one category
    const categories = getCategoriesFromLabels(['021_gt_hd_xs', '021_gt_hd_wx']);
    // Both are in 设备-输电/杆塔, should dedupe
    expect(categories.length).toBe(1);
  });
});

describe('getCategoryForLabel', () => {
  test('returns undefined for unknown label', () => {
    const category = getCategoryForLabel('unknown_label');
    expect(category).toBeUndefined();
  });

  test('returns category info for known label', () => {
    const category = getCategoryForLabel('021_gt_hd_xs');
    expect(category).toBeDefined();
    expect(category?.category1).toBe('设备-输电');
    expect(category?.category2).toBe('杆塔');
  });
});
