/**
 * Unit Tests for IP Utility
 * Tests client IP extraction from various sources
 */

import { describe, test, expect, mock } from 'bun:test';

// Mock getConnInfo from hono/bun
const mockGetConnInfo = mock(() => ({
  remote: { address: '192.168.1.100' },
}));

mock.module('hono/bun', () => ({
  getConnInfo: mockGetConnInfo,
}));

// Import after mocking
import { getClientIP } from '../../src/utils/ip';

// Helper to create mock Context
function createMockContext(headers: Record<string, string | undefined> = {}): any {
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()],
    },
  };
}

describe('getClientIP', () => {
  test('extracts IP from x-forwarded-for header (single IP)', () => {
    const ctx = createMockContext({
      'x-forwarded-for': '203.0.113.50',
    });

    const ip = getClientIP(ctx);
    expect(ip).toBe('203.0.113.50');
  });

  test('extracts first IP from x-forwarded-for header (multiple IPs)', () => {
    const ctx = createMockContext({
      'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178',
    });

    const ip = getClientIP(ctx);
    expect(ip).toBe('203.0.113.50');
  });

  test('trims whitespace from x-forwarded-for IP', () => {
    const ctx = createMockContext({
      'x-forwarded-for': '  203.0.113.50  , 70.41.3.18',
    });

    const ip = getClientIP(ctx);
    expect(ip).toBe('203.0.113.50');
  });

  test('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const ctx = createMockContext({
      'x-real-ip': '10.0.0.1',
    });

    const ip = getClientIP(ctx);
    expect(ip).toBe('10.0.0.1');
  });

  test('prefers x-forwarded-for over x-real-ip', () => {
    const ctx = createMockContext({
      'x-forwarded-for': '203.0.113.50',
      'x-real-ip': '10.0.0.1',
    });

    const ip = getClientIP(ctx);
    expect(ip).toBe('203.0.113.50');
  });

  test('falls back to socket connection info when no headers present', () => {
    mockGetConnInfo.mockImplementation(() => ({
      remote: { address: '192.168.1.100' },
    }));

    const ctx = createMockContext({});
    const ip = getClientIP(ctx);
    expect(ip).toBe('192.168.1.100');
  });

  test('returns null when socket info has no address', () => {
    mockGetConnInfo.mockImplementation(() => ({
      remote: { address: null },
    }));

    const ctx = createMockContext({});
    const ip = getClientIP(ctx);
    expect(ip).toBeNull();
  });

  test('returns null when socket info has no remote', () => {
    mockGetConnInfo.mockImplementation(() => ({
      remote: undefined,
    }));

    const ctx = createMockContext({});
    const ip = getClientIP(ctx);
    expect(ip).toBeNull();
  });

  test('returns null when getConnInfo throws', () => {
    mockGetConnInfo.mockImplementation(() => {
      throw new Error('Socket not available');
    });

    const ctx = createMockContext({});
    const ip = getClientIP(ctx);
    expect(ip).toBeNull();
  });

  test('returns null when getConnInfo returns null', () => {
    mockGetConnInfo.mockImplementation(() => null);

    const ctx = createMockContext({});
    const ip = getClientIP(ctx);
    expect(ip).toBeNull();
  });
});
