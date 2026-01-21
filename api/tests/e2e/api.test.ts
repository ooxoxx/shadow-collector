import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { detectionRoute } from '../../src/routes/detection';
import { textQaRoute } from '../../src/routes/text-qa';
import { classifyRoute } from '../../src/routes/classify';
import {
  detectionMetadata,
  textQaMetadata,
  classifyMetadata,
  sampleImageBuffer,
  sampleFileBuffer,
  createFormData,
} from '../fixtures';

// Mock the MinIO service before importing routes
const mockStoreResult = {
  filePath: 'detection/2026-01-21/test-task/test-image.jpg',
  metadataPath: 'detection/2026-01-21/test-task/test-image.jpg.json',
};

// We need to mock at module level
mock.module('../../src/services/minio', () => ({
  storeWithMetadata: mock(() => Promise.resolve(mockStoreResult)),
}));

// Create a test app
function createTestApp() {
  const app = new Hono();
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/api/v1/label/detection', detectionRoute);
  app.route('/api/v1/label/text-qa', textQaRoute);
  app.route('/api/v1/label/classify', classifyRoute);

  return app;
}

describe('Health Check', () => {
  const app = createTestApp();

  test('GET /health returns ok status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ok');
  });
});

describe('Detection API (Multipart)', () => {
  const app = createTestApp();

  test('POST /api/v1/label/detection with valid multipart returns success', async () => {
    const formData = createFormData(
      detectionMetadata,
      sampleImageBuffer,
      'test-image.jpg',
      'image/jpeg'
    );

    const res = await app.request('/api/v1/label/detection', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.filePath).toBeDefined();
    expect(json.data.metadataPath).toBeDefined();
  });

  test('POST /api/v1/label/detection with invalid taskId returns 400', async () => {
    const invalidMetadata = {
      ...detectionMetadata,
      taskId: 'invalid-id', // Not 32-char hex
    };

    const formData = createFormData(
      invalidMetadata,
      sampleImageBuffer,
      'test-image.jpg',
      'image/jpeg'
    );

    const res = await app.request('/api/v1/label/detection', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/label/detection with missing file returns 400', async () => {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(detectionMetadata));
    // No file appended

    const res = await app.request('/api/v1/label/detection', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/label/detection with missing metadata returns 400', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([sampleImageBuffer], { type: 'image/jpeg' }),
      'test-image.jpg'
    );
    // No metadata appended

    const res = await app.request('/api/v1/label/detection', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/label/detection with invalid JSON metadata returns 400', async () => {
    const formData = new FormData();
    formData.append('metadata', 'not valid json');
    formData.append(
      'file',
      new Blob([sampleImageBuffer], { type: 'image/jpeg' }),
      'test-image.jpg'
    );

    const res = await app.request('/api/v1/label/detection', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/label/detection with missing required fields returns 400', async () => {
    const invalidMetadata = {
      taskId: detectionMetadata.taskId,
      // Missing other required fields
    };

    const formData = createFormData(
      invalidMetadata,
      sampleImageBuffer,
      'test-image.jpg',
      'image/jpeg'
    );

    const res = await app.request('/api/v1/label/detection', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });
});

describe('Text QA API (Multipart)', () => {
  const app = createTestApp();

  test('POST /api/v1/label/text-qa with valid multipart returns success', async () => {
    const formData = createFormData(
      textQaMetadata,
      sampleFileBuffer,
      'test-document.pdf',
      'application/pdf'
    );

    const res = await app.request('/api/v1/label/text-qa', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
  });

  test('POST /api/v1/label/text-qa with numeric taskId returns success', async () => {
    const metadataWithNumericTaskId = {
      ...textQaMetadata,
      taskId: 12345, // Numeric taskId is allowed
    };

    const formData = createFormData(
      metadataWithNumericTaskId,
      sampleFileBuffer,
      'test-document.pdf',
      'application/pdf'
    );

    const res = await app.request('/api/v1/label/text-qa', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
  });

  test('POST /api/v1/label/text-qa with missing filename returns 400', async () => {
    const { filename, ...metadataWithoutFilename } = textQaMetadata;

    const formData = createFormData(
      metadataWithoutFilename,
      sampleFileBuffer,
      'test-document.pdf',
      'application/pdf'
    );

    const res = await app.request('/api/v1/label/text-qa', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });
});

describe('Classify API (Multipart)', () => {
  const app = createTestApp();

  test('POST /api/v1/label/classify with valid multipart returns success', async () => {
    const formData = createFormData(
      classifyMetadata,
      sampleImageBuffer,
      'classify-image.jpg',
      'image/jpeg'
    );

    const res = await app.request('/api/v1/label/classify', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
  });

  test('POST /api/v1/label/classify with empty labelIds returns success', async () => {
    const metadataWithEmptyLabels = {
      ...classifyMetadata,
      labelIds: [], // Empty array is valid
    };

    const formData = createFormData(
      metadataWithEmptyLabels,
      sampleImageBuffer,
      'classify-image.jpg',
      'image/jpeg'
    );

    const res = await app.request('/api/v1/label/classify', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
  });

  test('POST /api/v1/label/classify with invalid taskId returns 400', async () => {
    const invalidMetadata = {
      ...classifyMetadata,
      taskId: 'short', // Not 32-char hex
    };

    const formData = createFormData(
      invalidMetadata,
      sampleImageBuffer,
      'classify-image.jpg',
      'image/jpeg'
    );

    const res = await app.request('/api/v1/label/classify', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/label/classify with string labelIds returns 400', async () => {
    const invalidMetadata = {
      ...classifyMetadata,
      labelIds: ['not', 'numbers'], // Should be numbers
    };

    const formData = createFormData(
      invalidMetadata,
      sampleImageBuffer,
      'classify-image.jpg',
      'image/jpeg'
    );

    const res = await app.request('/api/v1/label/classify', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });
});

describe('API Error Handling', () => {
  const app = createTestApp();

  test('Non-existent endpoint returns 404', async () => {
    const res = await app.request('/api/v1/nonexistent');
    expect(res.status).toBe(404);
  });
});
