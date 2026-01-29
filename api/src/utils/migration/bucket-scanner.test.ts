/**
 * Bucket Scanner Tests
 * TDD tests for scanning MinIO bucket for non-compliant files
 */

import { describe, test, expect } from 'bun:test';
import {
  filterNonCompliantFiles,
  groupNonCompliantPairs,
} from './bucket-scanner';
import type { ObjectEntry } from './types';

describe('bucket-scanner', () => {
  describe('filterNonCompliantFiles', () => {
    test('filters out valid paths', () => {
      const files: ObjectEntry[] = [
        { key: 'detection/2026-01/未分类/未分类/file1.jpg' },
        { key: 'detection/2026-01/未分类/未分类/file1.json' },
        { key: 'classify/2026-01/环境监测/房屋建筑物/file2.png' },
      ];
      const result = filterNonCompliantFiles(files);
      expect(result).toHaveLength(0);
    });

    test('returns old-taskid format files', () => {
      const files: ObjectEntry[] = [
        { key: 'classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/test.jpg' },
        { key: 'classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/test.json' },
      ];
      const result = filterNonCompliantFiles(files);
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/test.jpg');
    });

    test('returns old-flat format files', () => {
      const files: ObjectEntry[] = [
        { key: 'detection/2026-01-22/sample.jpg' },
        { key: 'detection/2026-01-22/sample.json' },
      ];
      const result = filterNonCompliantFiles(files);
      expect(result).toHaveLength(2);
    });

    test('handles mixed valid and invalid files', () => {
      const files: ObjectEntry[] = [
        { key: 'detection/2026-01/未分类/未分类/valid.jpg' },
        { key: 'classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/invalid.jpg' },
        { key: 'detection/2026-01-22/flat.jpg' },
      ];
      const result = filterNonCompliantFiles(files);
      expect(result).toHaveLength(2);
    });

    test('returns empty array for empty input', () => {
      const result = filterNonCompliantFiles([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('groupNonCompliantPairs', () => {
    test('pairs images with their JSON files', () => {
      const files: ObjectEntry[] = [
        { key: 'classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/test.jpg' },
        { key: 'classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/test.json' },
      ];
      const result = groupNonCompliantPairs(files);
      expect(result).toHaveLength(1);
      expect(result[0].imagePath).toBe('classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/test.jpg');
      expect(result[0].jsonPath).toBe('classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/test.json');
    });

    test('handles {imagePath}.json naming pattern', () => {
      const files: ObjectEntry[] = [
        { key: 'detection/2026-01-22/sample.jpg' },
        { key: 'detection/2026-01-22/sample.jpg.json' },
      ];
      const result = groupNonCompliantPairs(files);
      expect(result).toHaveLength(1);
      expect(result[0].imagePath).toBe('detection/2026-01-22/sample.jpg');
      expect(result[0].jsonPath).toBe('detection/2026-01-22/sample.jpg.json');
    });

    test('handles {stem}.json naming pattern', () => {
      const files: ObjectEntry[] = [
        { key: 'detection/2026-01-22/sample.jpg' },
        { key: 'detection/2026-01-22/sample.json' },
      ];
      const result = groupNonCompliantPairs(files);
      expect(result).toHaveLength(1);
      expect(result[0].imagePath).toBe('detection/2026-01-22/sample.jpg');
      expect(result[0].jsonPath).toBe('detection/2026-01-22/sample.json');
    });

    test('excludes images without matching JSON', () => {
      const files: ObjectEntry[] = [
        { key: 'detection/2026-01-22/orphan.jpg' },
        { key: 'detection/2026-01-22/other.json' },
      ];
      const result = groupNonCompliantPairs(files);
      expect(result).toHaveLength(0);
    });

    test('handles multiple pairs', () => {
      const files: ObjectEntry[] = [
        { key: 'classify/2026-01-22/a123456789012345678901234567890a/img1.jpg' },
        { key: 'classify/2026-01-22/a123456789012345678901234567890a/img1.json' },
        { key: 'detection/2026-01-22/img2.png' },
        { key: 'detection/2026-01-22/img2.json' },
      ];
      const result = groupNonCompliantPairs(files);
      expect(result).toHaveLength(2);
    });

    test('handles various image extensions', () => {
      const files: ObjectEntry[] = [
        { key: 'detection/2026-01-22/a.png' },
        { key: 'detection/2026-01-22/a.json' },
        { key: 'detection/2026-01-22/b.jpeg' },
        { key: 'detection/2026-01-22/b.json' },
        { key: 'detection/2026-01-22/c.gif' },
        { key: 'detection/2026-01-22/c.json' },
      ];
      const result = groupNonCompliantPairs(files);
      expect(result).toHaveLength(3);
    });

    test('returns empty array for empty input', () => {
      const result = groupNonCompliantPairs([]);
      expect(result).toHaveLength(0);
    });
  });
});
