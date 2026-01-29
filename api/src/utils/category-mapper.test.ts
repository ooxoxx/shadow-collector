/**
 * Tests for category-mapper.ts
 * Run with: bun test api/src/utils/category-mapper.test.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import {
  loadCategoryMapping,
  extractPrefixFromLabel,
  getCategory1FromPrefix,
  getCategoriesFromLabels,
  extractLabelsFromAnnotations,
} from './category-mapper';

// Load category mapping before running tests
beforeAll(() => {
  loadCategoryMapping();
});

describe('extractPrefixFromLabel', () => {
  test('extracts 3-digit prefix from valid labels', () => {
    expect(extractPrefixFromLabel('021_gt_hd_xs')).toBe('021');
    expect(extractPrefixFromLabel('011_something')).toBe('011');
    expect(extractPrefixFromLabel('022_bd_jdq_zc')).toBe('022');
    expect(extractPrefixFromLabel('023_pd_dn_xs')).toBe('023');
    expect(extractPrefixFromLabel('031_yx_test')).toBe('031');
    expect(extractPrefixFromLabel('041_jj_test')).toBe('041');
  });

  test('returns null for labels without valid prefix', () => {
    expect(extractPrefixFromLabel('abc_xyz')).toBeNull();
    expect(extractPrefixFromLabel('completely_unknown')).toBeNull();
    expect(extractPrefixFromLabel('21_invalid')).toBeNull(); // 2 digits
    expect(extractPrefixFromLabel('0211_invalid')).toBeNull(); // 4 digits before underscore
    expect(extractPrefixFromLabel('021')).toBeNull(); // no underscore
  });
});

describe('getCategory1FromPrefix', () => {
  test('maps known prefixes to category1', () => {
    expect(getCategory1FromPrefix('011')).toBe('安监');
    expect(getCategory1FromPrefix('021')).toBe('设备-输电');
    expect(getCategory1FromPrefix('022')).toBe('设备-变电');
    expect(getCategory1FromPrefix('023')).toBe('设备-配电');
    expect(getCategory1FromPrefix('031')).toBe('营销');
    expect(getCategory1FromPrefix('041')).toBe('基建');
  });

  test('returns null for unknown prefixes', () => {
    expect(getCategory1FromPrefix('000')).toBeNull();
    expect(getCategory1FromPrefix('999')).toBeNull();
    expect(getCategory1FromPrefix('abc')).toBeNull();
  });
});

describe('getCategoriesFromLabels', () => {
  test('returns empty array for empty labels', () => {
    expect(getCategoriesFromLabels([])).toEqual([]);
  });

  test('returns specific category for known labels from CSV', () => {
    // This test assumes CSV contains entries for 021_gt_hd_xs -> 设备-输电/杆塔
    const categories = getCategoriesFromLabels(['021_gt_hd_xs']);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0].category1).toBe('设备-输电');
    expect(categories[0].category2).not.toBe('未分类');
  });

  test('returns prefix-based category for unknown labels with known prefix', () => {
    // Use a label that definitely won't be in CSV
    const categories = getCategoriesFromLabels(['021_unknown_xyz_999']);
    expect(categories.length).toBe(1);
    expect(categories[0].category1).toBe('设备-输电');
    expect(categories[0].category2).toBe('未分类');
  });

  test('returns single-level 未分类/ for completely unknown labels', () => {
    const categories = getCategoriesFromLabels(['abc_xyz', 'def_uvw']);
    expect(categories.length).toBe(1);
    expect(categories[0].category1).toBe('未分类');
    expect(categories[0].category2).toBe(''); // Empty = single-level
  });

  test('filters out prefix-based category when same category1 has specific label', () => {
    // Mix of known CSV label and unknown label with same prefix
    const categories = getCategoriesFromLabels(['021_gt_hd_xs', '021_unknown_xyz_999']);

    // Should only have the specific category, not 设备-输电/未分类
    const paths = categories.map(c => c.category2 ? `${c.category1}/${c.category2}` : `${c.category1}/`);

    expect(paths.some(p => p.includes('设备-输电') && !p.includes('未分类'))).toBe(true);
    expect(paths.some(p => p === '设备-输电/未分类')).toBe(false);
  });

  test('excludes top-level 未分类/ when any label has specific category', () => {
    // Mix of known label and completely unknown label
    const categories = getCategoriesFromLabels(['021_gt_hd_xs', 'completely_unknown']);

    const paths = categories.map(c => c.category2 ? `${c.category1}/${c.category2}` : `${c.category1}/`);

    expect(paths.some(p => p.includes('设备-输电'))).toBe(true);
    expect(paths.some(p => p === '未分类/')).toBe(false);
  });

  test('returns multiple prefix-based categories for different prefixes', () => {
    const categories = getCategoriesFromLabels(['021_unknown_a', '022_unknown_b']);

    expect(categories.length).toBe(2);

    const category1s = categories.map(c => c.category1);
    expect(category1s).toContain('设备-输电');
    expect(category1s).toContain('设备-变电');

    // Both should be 未分类 for category2
    expect(categories.every(c => c.category2 === '未分类')).toBe(true);
  });
});

describe('extractLabelsFromAnnotations', () => {
  test('extracts labels from rectanglelabels', () => {
    const annotations = [
      { value: { rectanglelabels: ['021_gt_hd_xs'] }, type: 'rectanglelabels' },
      { value: { rectanglelabels: ['021_gt_hd_zc'] }, type: 'rectanglelabels' },
    ];

    const labels = extractLabelsFromAnnotations(annotations);
    expect(labels).toContain('021_gt_hd_xs');
    expect(labels).toContain('021_gt_hd_zc');
  });

  test('deduplicates labels', () => {
    const annotations = [
      { value: { rectanglelabels: ['021_gt_hd_xs'] }, type: 'rectanglelabels' },
      { value: { rectanglelabels: ['021_gt_hd_xs'] }, type: 'rectanglelabels' },
    ];

    const labels = extractLabelsFromAnnotations(annotations);
    expect(labels.length).toBe(1);
  });
});
