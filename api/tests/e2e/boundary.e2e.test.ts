/**
 * Boundary Value E2E Tests
 * Tests edge cases for dimensions, string lengths, and array sizes
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
import { sampleImageBuffer, sampleJsonBuffer } from '../fixtures';

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
console.log(' Boundary Value E2E Tests');
console.log('='.repeat(60));
console.log(` Server: ${BASE_URL}`);
console.log('='.repeat(60) + '\n');

// ============================================================================
// Dimension Boundary Tests
// ============================================================================
describe('Dimension Boundaries', () => {
  test('minimum valid dimensions (width=1, height=1) accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `min-dim-${ts}`,
      filename: `min-dim-${ts}.jpg`,
      width: 1,
      height: 1,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('very large dimensions (100000x100000) accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `large-dim-${ts}`,
      filename: `large-dim-${ts}.jpg`,
      width: 100000,
      height: 100000,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('classify with minimum dimensions accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `classify-min-${ts}`,
      filename: `classify-min-${ts}.jpg`,
      width: 1,
      height: 1,
      labelIds: [1],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/classify', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// String Length Boundary Tests
// ============================================================================
describe('String Length Boundaries', () => {
  test('imageId with 255 characters accepted', async () => {
    const ts = getTimestamp();
    const longImageId = 'a'.repeat(255);
    const metadata = {
      taskId: generateHexId(),
      imageId: longImageId,
      filename: `long-id-${ts}.jpg`,
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

  test('filename with 200 characters accepted', async () => {
    const ts = getTimestamp();
    const longFilename = 'f'.repeat(196) + '.jpg'; // 200 chars total
    const metadata = {
      taskId: generateHexId(),
      imageId: `long-fn-${ts}`,
      filename: longFilename,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, longFilename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('taskId exactly 32 hex chars (boundary) accepted', async () => {
    const ts = getTimestamp();
    const exactTaskId = '0123456789abcdef0123456789abcdef'; // Exactly 32 chars
    const metadata = {
      taskId: exactTaskId,
      imageId: `exact-task-${ts}`,
      filename: `exact-task-${ts}.jpg`,
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

  test('taskId with 31 chars (below boundary) rejected', async () => {
    const ts = getTimestamp();
    const shortTaskId = '0123456789abcdef0123456789abcde'; // 31 chars
    const metadata = {
      taskId: shortTaskId,
      imageId: `short-task-${ts}`,
      filename: `short-task-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);

    expect(response.status).toBe(400);
  });

  test('taskId with 33 chars (above boundary) rejected', async () => {
    const ts = getTimestamp();
    const longTaskId = '0123456789abcdef0123456789abcdefa'; // 33 chars
    const metadata = {
      taskId: longTaskId,
      imageId: `long-task-${ts}`,
      filename: `long-task-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);

    expect(response.status).toBe(400);
  });
});

// ============================================================================
// Array Boundary Tests
// ============================================================================
describe('Array Boundaries', () => {
  test('annotations with 100 items accepted', async () => {
    const ts = getTimestamp();
    const manyAnnotations = Array.from({ length: 100 }, (_, i) => ({
      type: 'rectanglelabels',
      value: {
        rectanglelabels: [`label_${i}`],
        x: i % 100,
        y: i % 100,
        width: 10,
        height: 10,
      },
    }));

    const metadata = {
      taskId: generateHexId(),
      imageId: `many-annot-${ts}`,
      filename: `many-annot-${ts}.jpg`,
      width: 1920,
      height: 1080,
      annotations: manyAnnotations,
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('labelIds with 50 items accepted', async () => {
    const ts = getTimestamp();
    const manyLabelIds = Array.from({ length: 50 }, (_, i) => i + 1);

    const metadata = {
      taskId: generateHexId(),
      imageId: `many-labels-${ts}`,
      filename: `many-labels-${ts}.jpg`,
      width: 1024,
      height: 768,
      labelIds: manyLabelIds,
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/classify', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('empty annotations array accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `empty-annot-${ts}`,
      filename: `empty-annot-${ts}.jpg`,
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

  test('empty labelIds array accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `empty-labels-${ts}`,
      filename: `empty-labels-${ts}.jpg`,
      width: 1024,
      height: 768,
      labelIds: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/classify', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});
