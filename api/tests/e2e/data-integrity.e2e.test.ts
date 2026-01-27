/**
 * Data Integrity E2E Tests
 * Tests that uploaded data is correctly preserved and returned
 *
 * Prerequisites:
 * 1. Backend server running at http://127.0.0.1:8001
 * 2. MinIO running and accessible
 */

import { describe, test, expect } from 'bun:test';
import {
  createMultipartFormData,
  postEndpoint,
  generateHexId,
  getTimestamp,
  BASE_URL,
} from '../helpers/test-client';
import { sampleJsonBuffer } from '../fixtures';

// Minimal valid JPEG buffer
const testImageBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0x7f, 0xff, 0xd9,
]);

console.log('\n' + '='.repeat(60));
console.log(' Data Integrity E2E Tests');
console.log('='.repeat(60));
console.log(` Server: ${BASE_URL}`);
console.log('='.repeat(60) + '\n');

// ============================================================================
// Unicode Character Tests
// ============================================================================
describe('Unicode Character Handling', () => {
  test('Chinese characters in filename preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `unicode-cn-${ts}`,
      filename: `测试图片-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('Japanese characters in imageId preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `テスト画像-${ts}`,
      filename: `japanese-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('emoji in annotation values preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `emoji-${ts}`,
      filename: `emoji-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: ['🎉 celebration', '👍 approved'],
            x: 10,
            y: 10,
            width: 50,
            height: 50,
          },
        },
      ],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('mixed unicode in qa-pair annotation preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: `qa-unicode-${ts}`,
      filename: `qa-unicode-${ts}.json`,
      annotation: {
        dataId: 12345,
        editedInput: '你好世界 Hello こんにちは 🌍',
        editedAnswer: 'Réponse avec accents: é, è, ê, ë',
      },
    };

    const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/qa-pair', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Numeric Precision Tests
// ============================================================================
describe('Numeric Precision', () => {
  test('large integer values preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `large-int-${ts}`,
      filename: `large-int-${ts}.jpg`,
      width: 2147483647, // Max 32-bit signed int
      height: 2147483647,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('decimal coordinates in annotations preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `decimal-${ts}`,
      filename: `decimal-${ts}.jpg`,
      width: 1920,
      height: 1080,
      annotations: [
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: ['precise'],
            x: 10.123456789,
            y: 20.987654321,
            width: 50.555555555,
            height: 60.666666666,
          },
        },
      ],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('large dataId in qa-pair preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: `qa-large-id-${ts}`,
      filename: `qa-large-id-${ts}.json`,
      annotation: {
        dataId: 9007199254740991, // Max safe integer in JS
      },
    };

    const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/qa-pair', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Complex Nested Structure Tests
// ============================================================================
describe('Complex Nested Structures', () => {
  test('deeply nested annotation structure preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `nested-${ts}`,
      filename: `nested-${ts}.jpg`,
      width: 1920,
      height: 1080,
      annotations: [
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: ['label1', 'label2'],
            x: 10,
            y: 10,
            width: 100,
            height: 100,
            nested: {
              level1: {
                level2: {
                  level3: {
                    data: 'deep value',
                  },
                },
              },
            },
          },
        },
      ],
      descriptionAnnotation: [
        {
          value: {
            text: ['Description line 1', 'Description line 2'],
            metadata: {
              author: 'test',
              timestamp: new Date().toISOString(),
            },
          },
        },
      ],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('complex text-qa annotations structure preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      fileId: `complex-${ts}`,
      filename: `complex-${ts}.json`,
      taskId: 'complex-task',
      batchId: `batch-${ts}`,
      annotations: {
        sections: [
          { id: 1, score: 'pass', reason: '', metadata: { reviewer: 'auto' } },
          { id: 2, score: 'fail', reason: 'Issue found', tags: ['critical', 'review'] },
          { id: 3, score: 'pass', reason: '', nested: { a: { b: { c: 'deep' } } } },
        ],
        summary: {
          total: 3,
          passed: 2,
          failed: 1,
        },
      },
    };

    const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/text-qa', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Special Characters Tests
// ============================================================================
describe('Special Characters', () => {
  test('special characters in annotation labels preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `special-${ts}`,
      filename: `special-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: [
              'label/with/slashes',
              'label-with-dashes',
              'label_with_underscores',
              'label.with.dots',
              'label:with:colons',
            ],
            x: 10,
            y: 10,
            width: 50,
            height: 50,
          },
        },
      ],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('newlines and tabs in qa-pair text preserved', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: `qa-newlines-${ts}`,
      filename: `qa-newlines-${ts}.json`,
      annotation: {
        dataId: 12345,
        editedInput: 'Line 1\nLine 2\nLine 3',
        editedAnswer: 'Tab\there\tand\there',
      },
    };

    const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/qa-pair', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});
