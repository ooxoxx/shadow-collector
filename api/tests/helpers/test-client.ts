/**
 * Test Client Helpers for E2E API Tests
 */

const BASE_URL = 'http://127.0.0.1:8001';

/**
 * Create multipart FormData with metadata and file
 */
export function createMultipartFormData(
  metadata: Record<string, unknown>,
  fileBuffer: Buffer,
  filename: string
): FormData {
  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));
  const mimeType = getMimeType(filename);
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, filename);
  return formData;
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'json':
      return 'application/json';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * POST to an endpoint with multipart form data
 */
export async function postEndpoint(
  endpoint: string,
  formData: FormData
): Promise<Response> {
  return fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
  });
}

/**
 * POST JSON to an endpoint (for non-multipart requests)
 */
export async function postJson(
  endpoint: string,
  body: unknown
): Promise<Response> {
  return fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * GET request to an endpoint
 */
export async function getEndpoint(endpoint: string): Promise<Response> {
  return fetch(`${BASE_URL}${endpoint}`);
}

/**
 * Generate a 32-character hex ID
 */
export function generateHexId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Get current timestamp as string
 */
export function getTimestamp(): string {
  return String(Date.now());
}

/**
 * Generate unique test ID with prefix
 */
export function generateTestId(prefix: string): string {
  return `${prefix}-${getTimestamp()}`;
}

export { BASE_URL };
