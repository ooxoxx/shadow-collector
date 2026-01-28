/**
 * Unit Tests for Uncategorized Handler
 */

import { describe, test, expect } from 'bun:test';
import {
  isUncategorizedPath,
  groupUncategorizedPairs,
  getUncategorizedPrefix,
} from '../../../src/utils/migration/uncategorized';

describe('isUncategorizedPath', () => {
  test('returns true for uncategorized path', () => {
    expect(isUncategorizedPath('detection/2024-01/未分类/未分类/file.jpg')).toBe(true);
  });

  test('returns false for categorized path', () => {
    expect(isUncategorizedPath('detection/2024-01/设备-输电/杆塔/file.jpg')).toBe(false);
  });

  test('returns false for partial uncategorized', () => {
    expect(isUncategorizedPath('detection/2024-01/未分类/杆塔/file.jpg')).toBe(false);
    expect(isUncategorizedPath('detection/2024-01/设备/未分类/file.jpg')).toBe(false);
  });

  test('returns false for empty path', () => {
    expect(isUncategorizedPath('')).toBe(false);
  });
});

describe('getUncategorizedPrefix', () => {
  test('returns prefix for scanning uncategorized files', () => {
    const prefix = getUncategorizedPrefix('detection', '2024-01');
    expect(prefix).toBe('detection/2024-01/未分类/未分类/');
  });

  test('handles type without date', () => {
    const prefix = getUncategorizedPrefix('detection');
    expect(prefix).toBe('detection/');
  });
});

describe('groupUncategorizedPairs', () => {
  test('groups image and JSON pairs', () => {
    const files = [
      { key: 'detection/2024-01/未分类/未分类/image1.jpg' },
      { key: 'detection/2024-01/未分类/未分类/image1.json' },
      { key: 'detection/2024-01/未分类/未分类/image2.png' },
      { key: 'detection/2024-01/未分类/未分类/image2.json' },
    ];

    const pairs = groupUncategorizedPairs(files);
    expect(pairs.length).toBe(2);
    expect(pairs[0].imagePath).toBe('detection/2024-01/未分类/未分类/image1.jpg');
    expect(pairs[0].jsonPath).toBe('detection/2024-01/未分类/未分类/image1.json');
  });

  test('skips images without JSON', () => {
    const files = [
      { key: 'detection/2024-01/未分类/未分类/image1.jpg' },
      { key: 'detection/2024-01/未分类/未分类/image2.png' },
      { key: 'detection/2024-01/未分类/未分类/image2.json' },
    ];

    const pairs = groupUncategorizedPairs(files);
    expect(pairs.length).toBe(1);
    expect(pairs[0].imagePath).toBe('detection/2024-01/未分类/未分类/image2.png');
  });

  test('handles empty input', () => {
    const pairs = groupUncategorizedPairs([]);
    expect(pairs).toEqual([]);
  });

  test('handles various image extensions', () => {
    const files = [
      { key: 'path/image.jpg' },
      { key: 'path/image.json' },
      { key: 'path/photo.png' },
      { key: 'path/photo.json' },
      { key: 'path/pic.jpeg' },
      { key: 'path/pic.json' },
    ];

    const pairs = groupUncategorizedPairs(files);
    expect(pairs.length).toBe(3);
  });
});
