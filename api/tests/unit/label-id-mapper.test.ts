/**
 * Unit Tests for Label ID Mapper Utility
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import {
  loadLabelIdMapping,
  getLabelsFromIds,
  getLabelForId,
} from '../../src/utils/label-id-mapper';

// Load mappings before tests
beforeAll(() => {
  loadLabelIdMapping();
});

describe('getLabelsFromIds', () => {
  test('returns empty array for empty input', () => {
    const labels = getLabelsFromIds([]);
    expect(labels).toEqual([]);
  });

  test('returns labels for known IDs', () => {
    // IDs 4 and 5 should map to known labels
    const labels = getLabelsFromIds([4, 5]);
    expect(labels.length).toBe(2);
    expect(labels[0]).toBe('021_gt_hd_xs');
    expect(labels[1]).toBe('021_gt_hd_wx');
  });

  test('skips unknown IDs', () => {
    const labels = getLabelsFromIds([999999, 888888]);
    expect(labels).toEqual([]);
  });

  test('returns partial results for mixed known/unknown IDs', () => {
    const labels = getLabelsFromIds([4, 999999, 5]);
    expect(labels.length).toBe(2);
  });
});

describe('getLabelForId', () => {
  test('returns undefined for unknown ID', () => {
    const label = getLabelForId(999999);
    expect(label).toBeUndefined();
  });

  test('returns label for known ID', () => {
    const label = getLabelForId(4);
    expect(label).toBe('021_gt_hd_xs');
  });
});
