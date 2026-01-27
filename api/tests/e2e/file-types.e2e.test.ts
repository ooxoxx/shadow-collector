/**
 * File Type Handling E2E Tests
 * Tests different file formats and MIME type handling
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
import { sampleImageBuffer, sampleFileBuffer, sampleJsonBuffer } from '../fixtures';

// Minimal valid JPEG buffer
const jpegBuffer = Buffer.from([
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
console.log(' File Type Handling E2E Tests');
console.log('='.repeat(60));
console.log(` Server: ${BASE_URL}`);
console.log('='.repeat(60) + '\n');

// ============================================================================
// PNG File Tests
// ============================================================================
describe('PNG File Handling', () => {
  test('PNG file upload for detection accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `png-detect-${ts}`,
      filename: `test-${ts}.png`,
      width: 1,
      height: 1,
      annotations: [],
    };

    // Use the sample PNG buffer from fixtures
    const formData = createMultipartFormData(metadata, sampleImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.filePath).toMatch(/\.png$/i);
  });

  test('PNG file upload for classify accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `png-classify-${ts}`,
      filename: `classify-${ts}.png`,
      width: 1024,
      height: 768,
      labelIds: [1, 2],
    };

    const formData = createMultipartFormData(metadata, sampleImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/classify', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// PDF File Tests
// ============================================================================
describe('PDF File Handling', () => {
  test('PDF file upload for text-qa accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      fileId: `pdf-${ts}`,
      filename: `document-${ts}.pdf`,
      taskId: 'pdf-task',
      batchId: `batch-${ts}`,
      annotations: { sections: [] },
    };

    const formData = createMultipartFormData(metadata, sampleFileBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/text-qa', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// JSON File Tests
// ============================================================================
describe('JSON File Handling', () => {
  test('JSON file upload for qa-pair accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: `json-qa-${ts}`,
      filename: `qa-data-${ts}.json`,
      annotation: { dataId: 12345 },
    };

    const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/qa-pair', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('JSON file upload for text-qa accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      fileId: `json-textqa-${ts}`,
      filename: `textqa-${ts}.json`,
      taskId: 'json-task',
      batchId: `batch-${ts}`,
      annotations: { data: 'test' },
    };

    const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/text-qa', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// MIME Type Tests
// ============================================================================
describe('MIME Type Handling', () => {
  test('JPEG with .jpeg extension accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `jpeg-ext-${ts}`,
      filename: `test-${ts}.jpeg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, jpegBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  test('binary file with octet-stream type accepted', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: `binary-${ts}`,
      filename: `data-${ts}.bin`,
      annotation: { dataId: 12345 },
    };

    const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const formData = createMultipartFormData(metadata, binaryBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/qa-pair', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });
});
