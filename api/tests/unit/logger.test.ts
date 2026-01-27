/**
 * Unit Tests for Logger Utility
 * Tests file logging functionality
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { logUpload, logError } from '../../src/utils/logger';

describe('Logger Utility', () => {
  // Log directory - same as logger.ts uses
  const logDir = join(import.meta.dir, '../../logs');
  const dateStr = new Date().toISOString().split('T')[0];
  const uploadLogFile = join(logDir, `upload-${dateStr}.log`);
  const errorLogFile = join(logDir, `error-${dateStr}.log`);

  // Track character counts before each test (not byte counts!)
  let uploadLogCharsBefore = 0;
  let errorLogCharsBefore = 0;

  beforeEach(() => {
    // Record current character counts (UTF-8 aware)
    uploadLogCharsBefore = existsSync(uploadLogFile)
      ? readFileSync(uploadLogFile, 'utf-8').length
      : 0;
    errorLogCharsBefore = existsSync(errorLogFile)
      ? readFileSync(errorLogFile, 'utf-8').length
      : 0;
  });

  describe('logUpload', () => {
    test('writes upload log with correct format', () => {
      logUpload('DETECTION', { taskId: 'task-123', filename: 'test.jpg' });

      expect(existsSync(uploadLogFile)).toBe(true);

      const content = readFileSync(uploadLogFile, 'utf-8');
      const newContent = content.slice(uploadLogCharsBefore);

      expect(newContent).toContain('[DETECTION]');
      expect(newContent).toContain('taskId=task-123');
      expect(newContent).toContain('filename=test.jpg');
    });

    test('handles object values in details', () => {
      logUpload('TEXT_QA', {
        metadata: { nested: 'value' },
        count: 42,
      });

      const content = readFileSync(uploadLogFile, 'utf-8');
      const newContent = content.slice(uploadLogCharsBefore);

      expect(newContent).toContain('[TEXT_QA]');
      expect(newContent).toContain('metadata=');
      expect(newContent).toContain('count=42');
    });

    test('includes ISO timestamp', () => {
      logUpload('CLASSIFY', { test: 'value' });

      const content = readFileSync(uploadLogFile, 'utf-8');
      const newContent = content.slice(uploadLogCharsBefore);

      // Should contain ISO timestamp format [YYYY-MM-DDTHH:MM:SS
      expect(newContent).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('logError', () => {
    test('writes error log with correct format', () => {
      logError('DETECTION', 'Upload failed');

      expect(existsSync(errorLogFile)).toBe(true);

      const content = readFileSync(errorLogFile, 'utf-8');
      const newContent = content.slice(errorLogCharsBefore);

      expect(newContent).toContain('[ERROR]');
      expect(newContent).toContain('[DETECTION]');
      expect(newContent).toContain('message="Upload failed"');
    });

    test('includes details when provided', () => {
      logError('QA_PAIR', 'Connection error', { code: 'ECONNREFUSED', port: 8001 });

      const content = readFileSync(errorLogFile, 'utf-8');
      const newContent = content.slice(errorLogCharsBefore);

      expect(newContent).toContain('[QA_PAIR]');
      expect(newContent).toContain('message="Connection error"');
      expect(newContent).toContain('details=');
      expect(newContent).toContain('ECONNREFUSED');
    });

    test('omits details field when not provided', () => {
      logError('CLASSIFY', 'Simple error');

      const content = readFileSync(errorLogFile, 'utf-8');
      const newContent = content.slice(errorLogCharsBefore);

      // Get only the last line (the one we just wrote)
      const lines = newContent.trim().split('\n');
      const lastLine = lines[lines.length - 1];

      expect(lastLine).toContain('[CLASSIFY]');
      expect(lastLine).not.toContain('details=');
    });

    test('includes ISO timestamp', () => {
      logError('TEXT_QA', 'Test error');

      const content = readFileSync(errorLogFile, 'utf-8');
      const newContent = content.slice(errorLogCharsBefore);

      expect(newContent).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
