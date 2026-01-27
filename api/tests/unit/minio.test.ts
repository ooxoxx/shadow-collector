/**
 * Unit Tests for MinIO Service
 * Tests storage functionality with mocked S3 client
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll, spyOn } from 'bun:test';
import {
  storeWithMetadata,
  checkMinioConnection,
  setS3Client,
  resetS3Client,
} from '../../src/services/minio';
import { loadCategoryMapping } from '../../src/utils/category-mapper';

// Track S3 send calls
let sendCalls: Array<{ commandName: string; input: unknown }> = [];
let sendShouldFail = false;
let sendError: Error | string = new Error('S3 upload failed');

// Create mock S3 client
const mockS3Client = {
  send: async (command: unknown) => {
    const commandName = command?.constructor?.name || 'Unknown';
    const input = (command as { input?: unknown })?.input;
    sendCalls.push({ commandName, input });

    if (sendShouldFail) {
      throw sendError;
    }
    return {};
  },
} as any;

describe('MinIO Service', () => {
  beforeAll(() => {
    loadCategoryMapping();
  });

  beforeEach(() => {
    // Reset mock state
    sendCalls = [];
    sendShouldFail = false;
    sendError = new Error('S3 upload failed');
    // Inject mock client
    setS3Client(mockS3Client);
  });

  afterAll(() => {
    // Restore original client
    resetS3Client();
  });

  describe('storeWithMetadata', () => {
    test('stores file with default category when no labels provided', async () => {
      const result = await storeWithMetadata({
        type: 'detection',
        taskId: 'task-123',
        filename: 'test-image.jpg',
        fileBuffer: Buffer.from('test content'),
        fileMimeType: 'image/jpeg',
        metadata: { taskId: 'task-123' },
      });

      // Should have called send twice (file + metadata)
      expect(sendCalls.length).toBe(2);

      // Path should contain default category
      expect(result.filePath).toContain('未分类/未分类');
      expect(result.filePath).toContain('test-image.jpg');
      expect(result.metadataPath).toContain('test-image.json');
    });

    test('stores file with default category when labels array is empty', async () => {
      const result = await storeWithMetadata({
        type: 'detection',
        taskId: 'task-123',
        filename: 'test.png',
        fileBuffer: Buffer.from('test'),
        fileMimeType: 'image/png',
        metadata: {},
        labels: [],
      });

      expect(result.filePath).toContain('未分类/未分类');
    });

    test('stores file with matched category for known label', async () => {
      const result = await storeWithMetadata({
        type: 'detection',
        taskId: 'task-123',
        filename: 'labeled.jpg',
        fileBuffer: Buffer.from('test'),
        fileMimeType: 'image/jpeg',
        metadata: {},
        labels: ['021_gt_hd_xs'],  // Known label from classes.csv
      });

      expect(result.filePath).toContain('设备-输电/杆塔');
      expect(sendCalls.length).toBe(2);
    });

    test('stores file with default category for unknown labels', async () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      const result = await storeWithMetadata({
        type: 'detection',
        taskId: 'task-123',
        filename: 'unknown.jpg',
        fileBuffer: Buffer.from('test'),
        fileMimeType: 'image/jpeg',
        metadata: {},
        labels: ['unknown_label_xyz'],
      });

      expect(result.filePath).toContain('未分类/未分类');
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    test('handles filename without extension', async () => {
      const result = await storeWithMetadata({
        type: 'text-qa',
        taskId: 'task-456',
        filename: 'noextension',
        fileBuffer: Buffer.from('test'),
        fileMimeType: 'application/octet-stream',
        metadata: { test: true },
      });

      expect(result.filePath).toContain('noextension');
      expect(result.metadataPath).toContain('noextension.json');
    });

    test('includes correct month path in YYYY-MM format', async () => {
      const result = await storeWithMetadata({
        type: 'classify',
        taskId: 'task-789',
        filename: 'dated.jpg',
        fileBuffer: Buffer.from('test'),
        fileMimeType: 'image/jpeg',
        metadata: {},
      });

      const now = new Date();
      const expectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(result.filePath).toContain(expectedMonth);
    });

    test('throws error when S3 upload fails', async () => {
      sendShouldFail = true;

      await expect(
        storeWithMetadata({
          type: 'detection',
          taskId: 'task-err',
          filename: 'fail.jpg',
          fileBuffer: Buffer.from('test'),
          fileMimeType: 'image/jpeg',
          metadata: {},
        })
      ).rejects.toThrow('S3 upload failed');
    });

    test('does not return allPaths for single category', async () => {
      const result = await storeWithMetadata({
        type: 'qa-pair',
        taskId: 'task-single',
        filename: 'single.json',
        fileBuffer: Buffer.from('{}'),
        fileMimeType: 'application/json',
        metadata: {},
        labels: ['021_gt_hd_xs'],
      });

      expect(result.allPaths).toBeUndefined();
    });

    test('uploads file with correct content type', async () => {
      await storeWithMetadata({
        type: 'detection',
        taskId: 'task-ct',
        filename: 'image.png',
        fileBuffer: Buffer.from('png data'),
        fileMimeType: 'image/png',
        metadata: { key: 'value' },
      });

      // First call should be file upload
      const fileUpload = sendCalls[0];
      expect(fileUpload.commandName).toBe('PutObjectCommand');

      // Second call should be metadata upload
      const metaUpload = sendCalls[1];
      expect(metaUpload.commandName).toBe('PutObjectCommand');
    });
  });

  describe('checkMinioConnection', () => {
    test('succeeds when bucket is accessible', async () => {
      await expect(checkMinioConnection()).resolves.toBeUndefined();
      expect(sendCalls.length).toBe(1);
      expect(sendCalls[0].commandName).toBe('HeadBucketCommand');
    });

    test('throws error with message when connection fails', async () => {
      sendShouldFail = true;
      sendError = new Error('Connection refused');

      await expect(checkMinioConnection()).rejects.toThrow('MinIO 连接失败');
    });

    test('handles non-Error rejection', async () => {
      sendShouldFail = true;
      sendError = 'string error' as any;

      await expect(checkMinioConnection()).rejects.toThrow('MinIO 连接失败');
    });
  });
});
