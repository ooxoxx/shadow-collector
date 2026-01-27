/**
 * Performance Baseline E2E Tests
 * Tests response time baselines and throughput
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
console.log(' Performance Baseline E2E Tests');
console.log('='.repeat(60));
console.log(` Server: ${BASE_URL}`);
console.log('='.repeat(60) + '\n');

// ============================================================================
// Response Time Baseline Tests
// ============================================================================
describe('Response Time Baselines', () => {
  test('health check responds within 100ms', async () => {
    const start = performance.now();
    const response = await getEndpoint('/health');
    const elapsed = performance.now() - start;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(100);
  });

  test('small file upload responds within 500ms', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `perf-small-${ts}`,
      filename: `perf-small-${ts}.jpg`,
      width: 800,
      height: 600,
      annotations: [],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);

    const start = performance.now();
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const elapsed = performance.now() - start;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });

  test('1MB file upload responds within 2000ms', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `perf-1mb-${ts}`,
      filename: `perf-1mb-${ts}.jpg`,
      width: 1920,
      height: 1080,
      annotations: [],
    };

    // Create a ~1MB buffer
    const largeBuffer = Buffer.alloc(1024 * 1024);
    // Copy JPEG header
    testImageBuffer.copy(largeBuffer, 0);

    const formData = createMultipartFormData(metadata, largeBuffer, metadata.filename);

    const start = performance.now();
    const response = await postEndpoint('/api/v1/label/detection', formData);
    const elapsed = performance.now() - start;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });
});

// ============================================================================
// Throughput Tests
// ============================================================================
describe('Throughput', () => {
  test('20 sequential requests complete successfully', async () => {
    const results: boolean[] = [];

    for (let i = 0; i < 20; i++) {
      const ts = getTimestamp();
      const metadata = {
        taskId: `qa-throughput-${ts}-${i}`,
        filename: `throughput-${ts}-${i}.json`,
        annotation: { dataId: i },
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);
      results.push(response.status === 200);
    }

    const successCount = results.filter(Boolean).length;
    expect(successCount).toBe(20);
  });
});
