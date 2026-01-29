/**
 * Path Validator Tests
 * TDD tests for validating storage paths
 */

import { describe, test, expect } from 'bun:test';
import {
  isValidStoragePath,
  getPathViolationType,
  parseExistingPath,
  STORAGE_TYPES,
} from './path-validator';

describe('path-validator', () => {
  describe('isValidStoragePath', () => {
    test('returns true for valid detection path', () => {
      expect(isValidStoragePath('detection/2026-01/未分类/未分类/file.jpg')).toBe(true);
    });

    test('returns true for valid classify path', () => {
      expect(isValidStoragePath('classify/2026-01/环境监测/房屋建筑物/image.png')).toBe(true);
    });

    test('returns true for valid multimodal path', () => {
      expect(isValidStoragePath('multimodal/2025-12/交通/车辆/sample.jpeg')).toBe(true);
    });

    test('returns true for valid text-qa path', () => {
      expect(isValidStoragePath('text-qa/2026-01/未分类/未分类/data.json')).toBe(true);
    });

    test('returns true for valid qa-pair path', () => {
      expect(isValidStoragePath('qa-pair/2026-01/问答/对话/qa.json')).toBe(true);
    });

    test('returns false for old taskId format', () => {
      expect(isValidStoragePath('classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/file.jpg')).toBe(false);
    });

    test('returns false for old flat format', () => {
      expect(isValidStoragePath('classify/2026-01-22/sample.jpg')).toBe(false);
    });

    test('returns false for invalid type', () => {
      expect(isValidStoragePath('invalid/2026-01/未分类/未分类/file.jpg')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(isValidStoragePath('')).toBe(false);
    });

    test('returns false for path with extra segments', () => {
      expect(isValidStoragePath('detection/2026-01/cat1/cat2/extra/file.jpg')).toBe(false);
    });

    test('returns false for path with missing segments', () => {
      expect(isValidStoragePath('detection/2026-01/cat1/file.jpg')).toBe(false);
    });
  });

  describe('getPathViolationType', () => {
    test('returns valid for correct path', () => {
      expect(getPathViolationType('detection/2026-01/未分类/未分类/file.jpg')).toBe('valid');
    });

    test('returns old-taskid for 32-char hex taskId path', () => {
      expect(getPathViolationType('classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/file.jpg')).toBe('old-taskid');
    });

    test('returns old-taskid for detection taskId path', () => {
      expect(getPathViolationType('detection/2026-01-22/304fd5a7bf4e4a2b8f3c1d2e5a6b7c8d/image.png')).toBe('old-taskid');
    });

    test('returns old-flat for flat date-only path with image', () => {
      expect(getPathViolationType('classify/2026-01-22/sample.jpg')).toBe('old-flat');
    });

    test('returns old-flat for flat date-only path with json', () => {
      expect(getPathViolationType('detection/2026-01-22/data.json')).toBe('old-flat');
    });

    test('returns unknown for unrecognized invalid path', () => {
      expect(getPathViolationType('invalid/path/structure')).toBe('unknown');
    });

    test('returns unknown for empty string', () => {
      expect(getPathViolationType('')).toBe('unknown');
    });

    test('returns valid for various image extensions', () => {
      expect(getPathViolationType('detection/2026-01/cat1/cat2/file.jpeg')).toBe('valid');
      expect(getPathViolationType('detection/2026-01/cat1/cat2/file.png')).toBe('valid');
      expect(getPathViolationType('detection/2026-01/cat1/cat2/file.gif')).toBe('valid');
    });
  });

  describe('parseExistingPath', () => {
    test('parses valid 5-segment path', () => {
      const result = parseExistingPath('detection/2026-01/环境监测/房屋建筑物/image.jpg');
      expect(result).toEqual({
        type: 'detection',
        date: '2026-01',
        category1: '环境监测',
        category2: '房屋建筑物',
        filename: 'image.jpg',
      });
    });

    test('parses old taskId path (4 segments)', () => {
      const result = parseExistingPath('classify/2026-01-22/61e2a2859e734aaf82bf0d1f3b7c2a3e/file.jpg');
      expect(result).toEqual({
        type: 'classify',
        date: '2026-01-22',
        taskId: '61e2a2859e734aaf82bf0d1f3b7c2a3e',
        category1: undefined,
        category2: undefined,
        filename: 'file.jpg',
      });
    });

    test('parses old flat path (3 segments)', () => {
      const result = parseExistingPath('classify/2026-01-22/sample.jpg');
      expect(result).toEqual({
        type: 'classify',
        date: '2026-01-22',
        category1: undefined,
        category2: undefined,
        filename: 'sample.jpg',
      });
    });

    test('returns empty values for invalid path', () => {
      const result = parseExistingPath('');
      expect(result.type).toBe('');
      expect(result.filename).toBe('');
    });

    test('parses path with special characters in filename', () => {
      const result = parseExistingPath('detection/2026-01/cat1/cat2/文件名-test_123.jpg');
      expect(result.filename).toBe('文件名-test_123.jpg');
    });
  });

  describe('STORAGE_TYPES', () => {
    test('contains all expected types', () => {
      expect(STORAGE_TYPES).toContain('detection');
      expect(STORAGE_TYPES).toContain('multimodal');
      expect(STORAGE_TYPES).toContain('text-qa');
      expect(STORAGE_TYPES).toContain('classify');
      expect(STORAGE_TYPES).toContain('qa-pair');
      expect(STORAGE_TYPES.length).toBe(5);
    });
  });
});
