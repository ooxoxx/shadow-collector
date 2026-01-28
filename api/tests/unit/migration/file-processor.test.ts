/**
 * Unit Tests for File Processor
 */

import { describe, test, expect } from 'bun:test';
import {
  parseObjectList,
  separateFileTypes,
  matchFilePairs,
  extractLabelsFromMetadata,
} from '../../../src/utils/migration/file-processor';

describe('parseObjectList', () => {
  test('parses NDJSON format', () => {
    const content = '{"key":"file1.jpg"}\n{"key":"file2.json"}\n';
    const entries = parseObjectList(content);
    expect(entries.length).toBe(2);
    expect(entries[0].key).toBe('file1.jpg');
    expect(entries[1].key).toBe('file2.json');
  });

  test('parses JSON array format', () => {
    const content = '[{"key":"file1.jpg"},{"key":"file2.json"}]';
    const entries = parseObjectList(content);
    expect(entries.length).toBe(2);
  });

  test('handles empty lines in NDJSON', () => {
    const content = '{"key":"file1.jpg"}\n\n{"key":"file2.json"}\n';
    const entries = parseObjectList(content);
    expect(entries.length).toBe(2);
  });

  test('returns empty array for empty content', () => {
    expect(parseObjectList('')).toEqual([]);
    expect(parseObjectList('   ')).toEqual([]);
  });

  test('skips invalid JSON lines', () => {
    const content = '{"key":"file1.jpg"}\ninvalid\n{"key":"file2.json"}';
    const entries = parseObjectList(content);
    expect(entries.length).toBe(2);
  });
});

describe('separateFileTypes', () => {
  test('separates images and JSON files', () => {
    const entries = [
      { key: 'path/image.jpg' },
      { key: 'path/image.json' },
      { key: 'path/photo.png' },
    ];
    const { images, jsons } = separateFileTypes(entries);
    expect(images.length).toBe(2);
    expect(jsons.length).toBe(1);
  });

  test('handles various image extensions', () => {
    const entries = [
      { key: 'a.jpg' },
      { key: 'b.jpeg' },
      { key: 'c.png' },
      { key: 'd.gif' },
      { key: 'e.webp' },
    ];
    const { images } = separateFileTypes(entries);
    expect(images.length).toBe(5);
  });

  test('handles empty input', () => {
    const { images, jsons } = separateFileTypes([]);
    expect(images).toEqual([]);
    expect(jsons).toEqual([]);
  });
});

describe('matchFilePairs', () => {
  test('matches images with corresponding JSON', () => {
    const images = ['path/image1.jpg', 'path/image2.png'];
    const jsons = ['path/image1.json', 'path/image2.json'];

    const pairs = matchFilePairs(images, jsons);
    expect(pairs.length).toBe(2);
    expect(pairs[0].imagePath).toBe('path/image1.jpg');
    expect(pairs[0].jsonPath).toBe('path/image1.json');
  });

  test('skips images without JSON', () => {
    const images = ['path/image1.jpg', 'path/image2.png'];
    const jsons = ['path/image1.json'];

    const pairs = matchFilePairs(images, jsons);
    expect(pairs.length).toBe(1);
  });

  test('handles empty inputs', () => {
    expect(matchFilePairs([], [])).toEqual([]);
    expect(matchFilePairs(['a.jpg'], [])).toEqual([]);
  });
});

describe('extractLabelsFromMetadata', () => {
  test('extracts rectanglelabels from annotations', () => {
    const metadata = {
      annotations: [
        { type: 'rectanglelabels', value: { rectanglelabels: ['label1', 'label2'] } },
      ],
    };
    const labels = extractLabelsFromMetadata(metadata);
    expect(labels).toContain('label1');
    expect(labels).toContain('label2');
  });

  test('handles multiple annotations', () => {
    const metadata = {
      annotations: [
        { value: { rectanglelabels: ['label1'] } },
        { value: { rectanglelabels: ['label2'] } },
      ],
    };
    const labels = extractLabelsFromMetadata(metadata);
    expect(labels.length).toBe(2);
  });

  test('deduplicates labels', () => {
    const metadata = {
      annotations: [
        { value: { rectanglelabels: ['label1', 'label1'] } },
      ],
    };
    const labels = extractLabelsFromMetadata(metadata);
    expect(labels.length).toBe(1);
  });

  test('returns empty array for missing annotations', () => {
    expect(extractLabelsFromMetadata({})).toEqual([]);
    expect(extractLabelsFromMetadata({ annotations: [] })).toEqual([]);
  });

  test('handles null/undefined gracefully', () => {
    expect(extractLabelsFromMetadata(null as any)).toEqual([]);
    expect(extractLabelsFromMetadata(undefined as any)).toEqual([]);
  });
});
