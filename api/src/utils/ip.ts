import type { Context } from 'hono';
import { getConnInfo } from 'hono/bun';

/**
 * Extract client IP address from request
 *
 * Priority:
 * 1. x-forwarded-for (proxy chain, first IP)
 * 2. x-real-ip (alternative proxy header)
 * 3. Socket connection info (direct connection)
 */
export function getClientIP(c: Context): string | null {
  // Check proxy headers first
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = c.req.header('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to socket info
  try {
    const connInfo = getConnInfo(c);
    return connInfo?.remote?.address || null;
  } catch {
    return null;
  }
}
