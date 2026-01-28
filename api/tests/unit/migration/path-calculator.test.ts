/**
 * Unit Tests for Path Calculator
 */

import { describe, test, expect } from 'bun:test';
import {
  extractTypeFromPath,
  extractDateFromPath,
  calculateNewPath,
  isCorrectLocation,
} from '../../../src/utils/migration/path-calculator';

describe('extractTypeFromPath', () => {
  test('extracts type from first path segment', () => {
    expect(extractTypeFromPath('detection/2024-01/file.jpg')).toBe('detection');
    expect(extractTypeFromPath('classify/2024-02/cat/dog/file.png')).toBe('classify');
    expect(extractTypeFromPath('text-qa/file.json')).toBe('text-qa');
  });

  test('handles paths with leading slash', () => {
    expect(extractTypeFromPath('/detection/2024-01/file.jpg')).toBe('detection');
  });

  test('returns empty string for empty path', () => {
    expect(extractTypeFromPath('')).toBe('');
  });

  test('returns the path itself if no slash', () => {
    expect(extractTypeFromPath('detection')).toBe('detection');
  });
});

describe('extractDateFromPath', () => {
  test('extracts YYYY-MM from path with full date', () => {
    expect(extractDateFromPath('detection/2024-01-15/file.jpg')).toBe('2024-01');
    expect(extractDateFromPath('classify/2023-12-31/cat/file.png')).toBe('2023-12');
  });

  test('extracts YYYY-MM from path with month only', () => {
    expect(extractDateFromPath('detection/2024-01/file.jpg')).toBe('2024-01');
  });

  test('returns current month if no date found', () => {
    const result = extractDateFromPath('detection/file.jpg');
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });

  test('handles multiple date patterns - uses first match', () => {
    expect(extractDateFromPath('detection/2024-01-15/2023-12-01/file.jpg')).toBe('2024-01');
  });
});

describe('calculateNewPath', () => {
  test('builds correct path with category', () => {
    const result = calculateNewPath(
      'detection/old/path/image.jpg',
      '2024-01',
      { category1: '设备-输电', category2: '杆塔' }
    );
    expect(result).toBe('detection/2024-01/设备-输电/杆塔/image.jpg');
  });

  test('uses uncategorized for missing category', () => {
    const result = calculateNewPath(
      'detection/old/path/image.jpg',
      '2024-01',
      { category1: '未分类', category2: '未分类' }
    );
    expect(result).toBe('detection/2024-01/未分类/未分类/image.jpg');
  });

  test('preserves filename with special characters', () => {
    const result = calculateNewPath(
      'detection/path/image-123_test.jpg',
      '2024-01',
      { category1: 'cat1', category2: 'cat2' }
    );
    expect(result).toBe('detection/2024-01/cat1/cat2/image-123_test.jpg');
  });

  test('handles JSON files', () => {
    const result = calculateNewPath(
      'detection/path/metadata.json',
      '2024-01',
      { category1: 'cat1', category2: 'cat2' }
    );
    expect(result).toBe('detection/2024-01/cat1/cat2/metadata.json');
  });
});

describe('isCorrectLocation', () => {
  test('returns true when paths match', () => {
    expect(isCorrectLocation(
      'detection/2024-01/cat1/cat2/file.jpg',
      'detection/2024-01/cat1/cat2/file.jpg'
    )).toBe(true);
  });

  test('returns false when paths differ', () => {
    expect(isCorrectLocation(
      'detection/old/file.jpg',
      'detection/2024-01/cat1/cat2/file.jpg'
    )).toBe(false);
  });

  test('returns false for empty paths', () => {
    expect(isCorrectLocation('', 'detection/2024-01/cat1/cat2/file.jpg')).toBe(false);
    expect(isCorrectLocation('detection/file.jpg', '')).toBe(false);
  });
});
