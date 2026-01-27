/**
 * Response Structure Validation E2E Tests
 * Tests that API responses have correct structure and field types
 *
 * Prerequisites:
 * 1. Backend server running at http://127.0.0.1:8001
 * 2. MinIO running and accessible
 */

import { describe, test, expect } from 'bun:test';
import {
  createMultipartFormData,
  postEndpoint,
  getEndpoint,
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
console.log(' Response Structure Validation E2E Tests');
console.log('='.repeat(60));
console.log(` Server: ${BASE_URL}`);
console.log('='.repeat(60) + '\n');

// ============================================================================
// Health Endpoint Response Structure
// ============================================================================
describe('Health Response Structure', () => {
  test('health response has all required fields', async () => {
    const response = await getEndpoint('/health');
    const data = await response.json();

    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(typeof data.status).toBe('string');
    expect(typeof data.timestamp).toBe('string');
  });

  test('health timestamp is valid ISO format', async () => {
    const response = await getEndpoint('/health');
    const data = await response.json();

    const parsed = new Date(data.timestamp);
    expect(parsed.toString()).not.toBe('Invalid Date');
  });
});

// ============================================================================
// Detection Response Structure
// ============================================================================
describe('Detection Response Structure', () => {
  test('success response has correct structure', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `resp-struct-${ts}`,
      filename: `resp-struct-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    // Top-level structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(typeof result.success).toBe('boolean');
    expect(result.success).toBe(true);

    // Data structure
    expect(result.data).toHaveProperty('filePath');
    expect(result.data).toHaveProperty('metadataPath');
    expect(result.data).toHaveProperty('annotationType');
    expect(typeof result.data.filePath).toBe('string');
    expect(typeof result.data.metadataPath).toBe('string');
    expect(typeof result.data.annotationType).toBe('string');
  });

  test('filePath follows expected pattern', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `path-pattern-${ts}`,
      filename: `path-pattern-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    // filePath should contain detection and end with image extension
    expect(result.data.filePath).toMatch(/detection/);
    expect(result.data.filePath).toMatch(/\.(jpg|jpeg|png)$/i);
  });

  test('metadataPath follows expected pattern', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `meta-pattern-${ts}`,
      filename: `meta-pattern-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    // metadataPath should end with .json
    expect(result.data.metadataPath).toMatch(/\.json$/);
  });
});

// ============================================================================
// Error Response Structure
// ============================================================================
describe('Error Response Structure', () => {
  test('validation error has correct structure', async () => {
    const metadata = {
      taskId: 'invalid', // Invalid taskId
      imageId: 'img-001',
      filename: 'test.jpg',
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, 'test.jpg');
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error');
  });

  test('missing file error has correct structure', async () => {
    const metadata = {
      taskId: generateHexId(),
      imageId: 'img-001',
      filename: 'test.jpg',
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    // No file appended

    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error');
  });
});

// ============================================================================
// Classify Response Structure
// ============================================================================
describe('Classify Response Structure', () => {
  test('success response has correct structure', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `classify-resp-${ts}`,
      filename: `classify-resp-${ts}.jpg`,
      width: 1024,
      height: 768,
      labelIds: [1, 2],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/classify', formData);
    const result = await response.json();

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('filePath');
    expect(result.data).toHaveProperty('metadataPath');
  });
});

// ============================================================================
// QA-Pair Response Structure
// ============================================================================
describe('QA-Pair Response Structure', () => {
  test('success response has correct structure', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: `qa-resp-${ts}`,
      filename: `qa-resp-${ts}.json`,
      annotation: { dataId: 12345 },
    };

    const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/qa-pair', formData);
    const result = await response.json();

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('filePath');
    expect(result.data).toHaveProperty('metadataPath');
  });
});

// ============================================================================
// Text-QA Response Structure
// ============================================================================
describe('Text-QA Response Structure', () => {
  test('success response has correct structure', async () => {
    const ts = getTimestamp();
    const metadata = {
      fileId: `textqa-resp-${ts}`,
      filename: `textqa-resp-${ts}.json`,
      taskId: 'task-123',
      batchId: `batch-${ts}`,
      annotations: { sections: [] },
    };

    const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/text-qa', formData);
    const result = await response.json();

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('filePath');
  });
});
