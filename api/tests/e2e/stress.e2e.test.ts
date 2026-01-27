/**
 * Stress E2E API Tests
 * Tests concurrent requests, large files, and edge cases
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
console.log(' Stress E2E API Tests');
console.log('='.repeat(60));
console.log(` Server: ${BASE_URL}`);
console.log('='.repeat(60) + '\n');

// ============================================================================
// Concurrent Request Tests
// ============================================================================
describe('Concurrent Requests', () => {
  test('10 concurrent detection requests all succeed', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => {
      const ts = getTimestamp();
      const metadata = {
        taskId: generateHexId(),
        imageId: `concurrent-${i}-${ts}`,
        filename: `concurrent-${i}-${ts}.jpg`,
        width: 800,
        height: 600,
        annotations: [],
      };
      const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
      return postEndpoint('/api/v1/label/detection', formData);
    });

    const responses = await Promise.all(requests);
    const results = await Promise.all(responses.map(r => r.json()));

    // All should succeed
    responses.forEach((response, i) => {
      expect(response.status).toBe(200);
      expect(results[i].success).toBe(true);
    });

    console.log(`  10 concurrent requests completed successfully`);
  });

  test('mixed endpoint concurrent requests', async () => {
    const ts = getTimestamp();

    // Create requests for different endpoints
    const detectionMeta = {
      taskId: generateHexId(),
      imageId: `mixed-det-${ts}`,
      filename: `mixed-det-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const classifyMeta = {
      taskId: generateHexId(),
      imageId: `mixed-cls-${ts}`,
      filename: `mixed-cls-${ts}.jpg`,
      width: 800,
      height: 600,
      labelIds: [1, 2],
    };

    const textQaMeta = {
      fileId: `mixed-tqa-${ts}`,
      filename: `mixed-tqa-${ts}.json`,
      taskId: '12345',
      batchId: `batch-${ts}`,
      annotations: {},
    };

    const qaPairMeta = {
      taskId: `mixed-qap-${ts}`,
      filename: `mixed-qap-${ts}.json`,
      annotation: { dataId: 99999 },
    };

    const jsonBuffer = Buffer.from(JSON.stringify({ test: 'data' }));

    const requests = [
      postEndpoint('/api/v1/label/detection', createMultipartFormData(detectionMeta, testImageBuffer, detectionMeta.filename)),
      postEndpoint('/api/v1/label/classify', createMultipartFormData(classifyMeta, testImageBuffer, classifyMeta.filename)),
      postEndpoint('/api/v1/label/text-qa', createMultipartFormData(textQaMeta, jsonBuffer, textQaMeta.filename)),
      postEndpoint('/api/v1/label/qa-pair', createMultipartFormData(qaPairMeta, jsonBuffer, qaPairMeta.filename)),
    ];

    const responses = await Promise.all(requests);

    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    console.log(`  4 mixed endpoint requests completed successfully`);
  });
});

// ============================================================================
// Large File Tests
// ============================================================================
describe('Large File Handling', () => {
  test('1MB file upload succeeds', async () => {
    const ts = getTimestamp();
    // Create 1MB buffer
    const largeBuffer = Buffer.alloc(1024 * 1024, 0x42);

    const metadata = {
      taskId: generateHexId(),
      imageId: `large-1mb-${ts}`,
      filename: `large-1mb-${ts}.jpg`,
      width: 4000,
      height: 3000,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, largeBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    console.log(`  1MB file uploaded successfully`);
  });
});

// ============================================================================
// Special Character Filename Tests
// ============================================================================
describe('Special Character Filenames', () => {
  test('Chinese characters in filename', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `chinese-${ts}`,
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
    console.log(`  Chinese filename uploaded successfully`);
  });

  test('spaces in filename', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `spaces-${ts}`,
      filename: `test image with spaces ${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    console.log(`  Filename with spaces uploaded successfully`);
  });

  test('special characters in filename', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `special-${ts}`,
      filename: `test_file-${ts}(1)[2].jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    console.log(`  Special character filename uploaded successfully`);
  });
});
