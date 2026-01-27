/**
 * E2E API Tests for Category-based Storage
 * Tests the new label-to-category mapping functionality
 *
 * Prerequisites:
 * 1. Backend server running at http://127.0.0.1:8001
 * 2. MinIO running and accessible
 * 3. Mappings loaded (classes.csv + label-id-map.json)
 */

import { describe, test, expect } from 'bun:test';

const BASE_URL = 'http://127.0.0.1:8001';

// Helper function to create multipart form data
function createMultipartFormData(
  metadata: Record<string, unknown>,
  fileBuffer: Buffer,
  filename: string
): FormData {
  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));
  const mimeType = filename.endsWith('.json') ? 'application/json' : 'image/jpeg';
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, filename);
  return formData;
}

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

function getTimestamp(): string {
  return String(Date.now());
}

// Generate a 32-character hex ID
function generateHexId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

describe('Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
    console.log('  Health check passed');
  });
});

describe('Detection API - Category Storage', () => {
  test('single label -> correct category path (021_gt_hd_xs -> 设备-输电/杆塔)', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `e2e-image-${ts}`,
      filename: `test-detection-${ts}.jpg`,
      width: 1920,
      height: 1080,
      uploadTime: new Date().toISOString(),
      storagePath: '原始样本区/天津/test.jpg',
      annotations: [
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: ['021_gt_hd_xs'], // 设备-输电 > 杆塔 > 横担 > 锈蚀
            x: 10,
            y: 10,
            width: 100,
            height: 100,
          },
        },
      ],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await fetch(`${BASE_URL}/api/v1/label/detection`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.annotationType).toBe('detection');

    const filePath = result.data.filePath;
    expect(filePath).toMatch(/^detection\/\d{4}-\d{2}\/设备-输电\/杆塔\/.+\.jpg$/);
    console.log(`  Stored to: ${filePath}`);
  });

  test('multiple labels with different categories -> allPaths', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `e2e-multi-img-${ts}`,
      filename: `test-multi-${ts}.jpg`,
      width: 1920,
      height: 1080,
      uploadTime: new Date().toISOString(),
      storagePath: '原始样本区/test.jpg',
      annotations: [
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: ['021_gt_hd_xs'], // 设备-输电 > 杆塔
            x: 10,
            y: 10,
            width: 100,
            height: 100,
          },
        },
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: ['021_blq_bt_zc'], // 设备-输电 > 避雷器
            x: 150,
            y: 150,
            width: 100,
            height: 100,
          },
        },
      ],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await fetch(`${BASE_URL}/api/v1/label/detection`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);

    const paths = result.data.allPaths || [result.data.filePath];
    console.log(`  Stored to ${paths.length} path(s):`);
    paths.forEach((p: string) => console.log(`    - ${p}`));
  });

  test('unknown label -> default category (未分类/未分类)', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `e2e-unknown-img-${ts}`,
      filename: `test-unknown-${ts}.jpg`,
      width: 1920,
      height: 1080,
      uploadTime: new Date().toISOString(),
      storagePath: '原始样本区/test.jpg',
      annotations: [
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: ['unknown_label_xyz'],
            x: 10,
            y: 10,
            width: 100,
            height: 100,
          },
        },
      ],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await fetch(`${BASE_URL}/api/v1/label/detection`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.data.filePath).toMatch(/^detection\/\d{4}-\d{2}\/未分类\/未分类\/.+\.jpg$/);
    console.log(`  Stored to: ${result.data.filePath}`);
  });

  test('multimodal annotations -> multimodal type', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `e2e-mm-img-${ts}`,
      filename: `test-mm-${ts}.jpg`,
      width: 1920,
      height: 1080,
      uploadTime: new Date().toISOString(),
      storagePath: '原始样本区/test.jpg',
      annotations: [
        {
          type: 'rectanglelabels',
          value: {
            rectanglelabels: ['021_gt_hd_xs'],
            x: 10,
            y: 10,
            width: 100,
            height: 100,
          },
        },
      ],
      descriptionAnnotation: [{ value: { text: ['Test description'] } }],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await fetch(`${BASE_URL}/api/v1/label/detection`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.data.annotationType).toBe('multimodal');
    expect(result.data.filePath).toMatch(/^multimodal\/\d{4}-\d{2}\/设备-输电\/杆塔\//);
    console.log(`  Type: ${result.data.annotationType}, Path: ${result.data.filePath}`);
  });
});

describe('Classify API - Label ID Mapping', () => {
  test('label IDs [4, 5] -> 设备-输电/杆塔', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `e2e-classify-img-${ts}`,
      filename: `test-classify-${ts}.jpg`,
      width: 1920,
      height: 1080,
      uploadTime: new Date().toISOString(),
      storagePath: '原始样本区/test.jpg',
      labelIds: [4, 5], // 021_gt_hd_xs, 021_gt_hd_wx
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await fetch(`${BASE_URL}/api/v1/label/classify`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.filePath).toMatch(/^classify\/\d{4}-\d{2}\/设备-输电\/杆塔\//);
    console.log(`  Label IDs [4, 5] -> ${result.data.filePath}`);
  });

  test('unknown label ID [999999] -> default category', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: generateHexId(),
      imageId: `e2e-classify-unk-img-${ts}`,
      filename: `test-classify-unk-${ts}.jpg`,
      width: 1920,
      height: 1080,
      uploadTime: new Date().toISOString(),
      storagePath: '原始样本区/test.jpg',
      labelIds: [999999],
    };

    const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
    const response = await fetch(`${BASE_URL}/api/v1/label/classify`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.data.filePath).toMatch(/^classify\/\d{4}-\d{2}\/未分类\/未分类\//);
    console.log(`  Unknown ID -> ${result.data.filePath}`);
  });
});

describe('Text-QA API', () => {
  test('uses default category (未分类/未分类)', async () => {
    const ts = getTimestamp();
    const metadata = {
      fileId: `e2e-tqa-${ts}`,
      filename: `test-tqa-${ts}.json`,
      taskId: 12345,
      batchId: `batch-${ts}`,
      uploadTime: new Date().toISOString(),
      storagePath: '原始样本区/test.json',
      annotations: [{ text: 'Sample' }],
    };

    const textBuffer = Buffer.from(JSON.stringify({ test: 'data' }));
    const formData = createMultipartFormData(metadata, textBuffer, metadata.filename);
    const response = await fetch(`${BASE_URL}/api/v1/label/text-qa`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.data.filePath).toMatch(/^text-qa\/\d{4}-\d{2}\/未分类\/未分类\//);
    console.log(`  Stored to: ${result.data.filePath}`);
  });
});

describe('QA-Pair API', () => {
  test('uses default category (未分类/未分类)', async () => {
    const ts = getTimestamp();
    const metadata = {
      taskId: `e2e-qap-${ts}`,
      dataTxtId: `e2e-txt-${ts}`,
      filename: `test-qap-${ts}.json`,
      department: 'test-dept',
      uploadTime: new Date().toISOString(),
      storagePath: '原始样本区/test.json',
      annotation: { dataId: 12345, question: 'Q?', answer: 'A.' },
    };

    const textBuffer = Buffer.from(JSON.stringify({ qa: 'data' }));
    const formData = createMultipartFormData(metadata, textBuffer, metadata.filename);
    const response = await fetch(`${BASE_URL}/api/v1/label/qa-pair`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.data.filePath).toMatch(/^qa-pair\/\d{4}-\d{2}\/未分类\/未分类\//);
    console.log(`  Stored to: ${result.data.filePath}`);
  });
});

describe('Error Handling', () => {
  test('404 for non-existent routes', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/label/nonexistent`, {
      method: 'POST',
    });
    expect(response.status).toBe(404);
    console.log('  404 handling works');
  });
});

console.log('\n' + '='.repeat(50));
console.log(' Category Storage E2E Tests');
console.log('='.repeat(50));
console.log(' Server: http://127.0.0.1:8001');
console.log('='.repeat(50) + '\n');
