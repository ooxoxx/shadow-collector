/**
 * Comprehensive E2E API Tests
 * Tests all endpoints with happy paths and validation error cases
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
import { sampleImageBuffer, sampleJsonBuffer } from '../fixtures';

// Minimal valid JPEG buffer for image uploads
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
console.log(' Comprehensive E2E API Tests');
console.log('='.repeat(60));
console.log(` Server: ${BASE_URL}`);
console.log('='.repeat(60) + '\n');

// ============================================================================
// Health Endpoint Tests
// ============================================================================
describe('Health Endpoint', () => {
  test('GET /health returns 200 with status ok', async () => {
    const response = await getEndpoint('/health');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status', 'ok');
  });

  test('GET /health response includes timestamp', async () => {
    const response = await getEndpoint('/health');
    const data = await response.json();

    expect(data).toHaveProperty('timestamp');
    expect(typeof data.timestamp).toBe('string');
  });
});

// ============================================================================
// Detection Endpoint Tests
// ============================================================================
describe('Detection API', () => {
  describe('Happy Path', () => {
    test('valid detection annotation stores successfully', async () => {
      const ts = getTimestamp();
      const metadata = {
        taskId: generateHexId(),
        imageId: `img-${ts}`,
        filename: `detection-${ts}.jpg`,
        width: 1920,
        height: 1080,
        uploadTime: new Date().toISOString(),
        storagePath: '原始样本区/test.jpg',
        annotations: [
          {
            type: 'rectanglelabels',
            value: {
              rectanglelabels: ['test_label'],
              x: 10,
              y: 10,
              width: 100,
              height: 100,
            },
          },
        ],
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/detection', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('filePath');
      expect(result.data).toHaveProperty('metadataPath');
      expect(result.data.annotationType).toBe('detection');
    });

    test('multimodal: descriptionAnnotation triggers multimodal type', async () => {
      const ts = getTimestamp();
      const metadata = {
        taskId: generateHexId(),
        imageId: `mm-img-${ts}`,
        filename: `multimodal-${ts}.jpg`,
        width: 1920,
        height: 1080,
        uploadTime: new Date().toISOString(),
        storagePath: '原始样本区/test.jpg',
        annotations: [
          {
            type: 'rectanglelabels',
            value: {
              rectanglelabels: ['test_label'],
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
      const response = await postEndpoint('/api/v1/label/detection', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.annotationType).toBe('multimodal');
    });
  });

  describe('Validation Errors', () => {
    test('invalid taskId (non-32-char hex) returns 400', async () => {
      const metadata = {
        taskId: 'invalid-task-id', // Not 32-char hex
        imageId: 'img-001',
        filename: 'test.jpg',
        width: 800,
        height: 600,
        annotations: [],
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, 'test.jpg');
      const response = await postEndpoint('/api/v1/label/detection', formData);

      expect(response.status).toBe(400);
    });

    test('empty imageId returns 400', async () => {
      const metadata = {
        taskId: generateHexId(),
        imageId: '', // Empty
        filename: 'test.jpg',
        width: 800,
        height: 600,
        annotations: [],
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, 'test.jpg');
      const response = await postEndpoint('/api/v1/label/detection', formData);

      expect(response.status).toBe(400);
    });

    test('non-positive width returns 400', async () => {
      const metadata = {
        taskId: generateHexId(),
        imageId: 'img-001',
        filename: 'test.jpg',
        width: 0, // Invalid
        height: 600,
        annotations: [],
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, 'test.jpg');
      const response = await postEndpoint('/api/v1/label/detection', formData);

      expect(response.status).toBe(400);
    });

    test('negative height returns 400', async () => {
      const metadata = {
        taskId: generateHexId(),
        imageId: 'img-001',
        filename: 'test.jpg',
        width: 800,
        height: -100, // Invalid
        annotations: [],
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, 'test.jpg');
      const response = await postEndpoint('/api/v1/label/detection', formData);

      expect(response.status).toBe(400);
    });

    test('missing file field returns 400', async () => {
      const metadata = {
        taskId: generateHexId(),
        imageId: 'img-001',
        filename: 'test.jpg',
        width: 800,
        height: 600,
        annotations: [],
      };

      // Create FormData without file
      const formData = new FormData();
      formData.append('metadata', JSON.stringify(metadata));

      const response = await postEndpoint('/api/v1/label/detection', formData);

      expect(response.status).toBe(400);
    });
  });
});

// ============================================================================
// Text-QA Endpoint Tests
// ============================================================================
describe('Text-QA API', () => {
  describe('Happy Path', () => {
    test('valid text-qa annotation with string taskId stores successfully', async () => {
      const ts = getTimestamp();
      const metadata = {
        fileId: `file-${ts}`,
        filename: `text-qa-${ts}.json`,
        taskId: 'string-task-id-123',
        batchId: `batch-${ts}`,
        uploadTime: new Date().toISOString(),
        storagePath: '原始样本区/test.json',
        annotations: { sections: [{ id: 1, score: 'pass' }] },
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/text-qa', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('filePath');
    });

    test('valid text-qa annotation with numeric taskId stores successfully', async () => {
      const ts = getTimestamp();
      const metadata = {
        fileId: `file-num-${ts}`,
        filename: `text-qa-num-${ts}.json`,
        taskId: 12345, // Numeric taskId
        batchId: `batch-${ts}`,
        uploadTime: new Date().toISOString(),
        annotations: { data: 'test' },
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/text-qa', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Errors', () => {
    test('empty fileId returns 400', async () => {
      const metadata = {
        fileId: '', // Empty
        filename: 'test.json',
        taskId: '12345',
        batchId: 'batch-001',
        annotations: {},
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, 'test.json');
      const response = await postEndpoint('/api/v1/label/text-qa', formData);

      expect(response.status).toBe(400);
    });

    test('missing batchId returns 400', async () => {
      const metadata = {
        fileId: 'file-001',
        filename: 'test.json',
        taskId: '12345',
        // batchId missing
        annotations: {},
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, 'test.json');
      const response = await postEndpoint('/api/v1/label/text-qa', formData);

      expect(response.status).toBe(400);
    });

    test('empty filename returns 400', async () => {
      const metadata = {
        fileId: 'file-001',
        filename: '', // Empty
        taskId: '12345',
        batchId: 'batch-001',
        annotations: {},
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, 'test.json');
      const response = await postEndpoint('/api/v1/label/text-qa', formData);

      expect(response.status).toBe(400);
    });
  });
});

// ============================================================================
// Classify Endpoint Tests
// ============================================================================
describe('Classify API', () => {
  describe('Happy Path', () => {
    test('valid classify annotation stores successfully', async () => {
      const ts = getTimestamp();
      const metadata = {
        taskId: generateHexId(),
        imageId: `classify-img-${ts}`,
        filename: `classify-${ts}.jpg`,
        width: 1024,
        height: 768,
        labelIds: [1, 2, 3],
        uploadTime: new Date().toISOString(),
        storagePath: '原始样本区/test.jpg',
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/classify', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('filePath');
    });

    test('known label IDs map to correct categories', async () => {
      const ts = getTimestamp();
      const metadata = {
        taskId: generateHexId(),
        imageId: `classify-known-${ts}`,
        filename: `classify-known-${ts}.jpg`,
        width: 1024,
        height: 768,
        labelIds: [4, 5], // Known IDs from label-id-map
        uploadTime: new Date().toISOString(),
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/classify', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Errors', () => {
    test('invalid taskId (non-hex) returns 400', async () => {
      const metadata = {
        taskId: 'not-a-hex-id', // Invalid
        imageId: 'img-001',
        filename: 'test.jpg',
        width: 1024,
        height: 768,
        labelIds: [1],
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, 'test.jpg');
      const response = await postEndpoint('/api/v1/label/classify', formData);

      expect(response.status).toBe(400);
    });

    test('labelIds with non-number values returns 400', async () => {
      const metadata = {
        taskId: generateHexId(),
        imageId: 'img-001',
        filename: 'test.jpg',
        width: 1024,
        height: 768,
        labelIds: ['not', 'numbers'], // Invalid
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, 'test.jpg');
      const response = await postEndpoint('/api/v1/label/classify', formData);

      expect(response.status).toBe(400);
    });

    test('empty imageId returns 400', async () => {
      const metadata = {
        taskId: generateHexId(),
        imageId: '', // Empty
        filename: 'test.jpg',
        width: 1024,
        height: 768,
        labelIds: [1],
      };

      const formData = createMultipartFormData(metadata, testImageBuffer, 'test.jpg');
      const response = await postEndpoint('/api/v1/label/classify', formData);

      expect(response.status).toBe(400);
    });
  });
});

// ============================================================================
// QA-Pair Endpoint Tests (Major Gap)
// ============================================================================
describe('QA-Pair API', () => {
  describe('Happy Path', () => {
    test('valid qa-pair with complete metadata stores successfully', async () => {
      const ts = getTimestamp();
      const metadata = {
        taskId: `qa-task-${ts}`,
        dataTxtId: `txt-${ts}`,
        filename: `qa-pair-${ts}.json`,
        department: 'test-dept',
        uploadTime: new Date().toISOString(),
        storagePath: '原始样本区/qa-pair/test.json',
        annotation: {
          dataId: 12345,
          isAvailable: 'yes',
          questionType: 'factual',
          applicableRole: 'assistant',
          applicableScene: 'customer-service',
          editedInput: 'Test question?',
          editedAnswer: 'Test answer.',
        },
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('filePath');
      expect(result.data).toHaveProperty('metadataPath');
    });

    test('valid qa-pair with minimal metadata stores successfully', async () => {
      const ts = getTimestamp();
      const metadata = {
        taskId: `qa-minimal-${ts}`,
        filename: `qa-minimal-${ts}.json`,
        annotation: {
          dataId: 67890,
        },
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Errors', () => {
    test('empty taskId returns 400', async () => {
      const metadata = {
        taskId: '', // Empty
        filename: 'test.json',
        annotation: { dataId: 123 },
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, 'test.json');
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);

      expect(response.status).toBe(400);
    });

    test('missing filename returns 400', async () => {
      const metadata = {
        taskId: 'task-001',
        // filename missing
        annotation: { dataId: 123 },
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, 'test.json');
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);

      expect(response.status).toBe(400);
    });

    test('annotation as non-object returns 400', async () => {
      const metadata = {
        taskId: 'task-001',
        filename: 'test.json',
        annotation: 'not-an-object', // Invalid
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, 'test.json');
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);

      expect(response.status).toBe(400);
    });

    test('annotation.dataId as non-number returns 400', async () => {
      const metadata = {
        taskId: 'task-001',
        filename: 'test.json',
        annotation: { dataId: 'not-a-number' }, // Invalid
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, 'test.json');
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);

      expect(response.status).toBe(400);
    });

    test('missing annotation returns 400', async () => {
      const metadata = {
        taskId: 'task-001',
        filename: 'test.json',
        // annotation missing
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, 'test.json');
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);

      expect(response.status).toBe(400);
    });
  });

  describe('Optional Fields', () => {
    test('dataTxtId can be omitted', async () => {
      const ts = getTimestamp();
      const metadata = {
        taskId: `qa-no-txt-${ts}`,
        filename: `qa-no-txt-${ts}.json`,
        annotation: { dataId: 11111 },
        // dataTxtId omitted
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    test('department can be omitted', async () => {
      const ts = getTimestamp();
      const metadata = {
        taskId: `qa-no-dept-${ts}`,
        filename: `qa-no-dept-${ts}.json`,
        annotation: { dataId: 22222 },
        // department omitted
      };

      const formData = createMultipartFormData(metadata, sampleJsonBuffer, metadata.filename);
      const response = await postEndpoint('/api/v1/label/qa-pair', formData);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================
describe('Error Handling', () => {
  test('404 for non-existent routes', async () => {
    const response = await getEndpoint('/api/v1/label/nonexistent');
    expect(response.status).toBe(404);
  });

  test('404 for POST to non-existent routes', async () => {
    const formData = new FormData();
    formData.append('metadata', '{}');
    const response = await postEndpoint('/api/v1/label/unknown', formData);
    expect(response.status).toBe(404);
  });

  test('400 for non-multipart request to detection', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/label/detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
    });
    expect(response.status).toBe(400);
  });

  test('400 for missing metadata field', async () => {
    const formData = new FormData();
    // Only file, no metadata
    const blob = new Blob([testImageBuffer], { type: 'image/jpeg' });
    formData.append('file', blob, 'test.jpg');

    const response = await postEndpoint('/api/v1/label/detection', formData);
    expect(response.status).toBe(400);
  });

  test('400 for invalid JSON in metadata', async () => {
    const formData = new FormData();
    formData.append('metadata', 'not-valid-json{');
    const blob = new Blob([testImageBuffer], { type: 'image/jpeg' });
    formData.append('file', blob, 'test.jpg');

    const response = await postEndpoint('/api/v1/label/detection', formData);
    expect(response.status).toBe(400);
  });
});
