import type { Context } from 'hono';
import type { z } from 'zod';

export interface ParsedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface ParsedMultipart<T> {
  metadata: T;
  file: ParsedFile;
}

/**
 * Parse multipart/form-data request with metadata JSON and file
 * Expected fields:
 *   - metadata: JSON string containing structured metadata
 *   - file: Binary file data
 */
export async function parseMultipartWithMetadata<T>(
  c: Context,
  metadataSchema: z.ZodType<T>
): Promise<ParsedMultipart<T>> {
  const formData = await c.req.formData();

  // Parse metadata JSON
  const metadataRaw = formData.get('metadata');
  if (typeof metadataRaw !== 'string') {
    throw new Error('Missing or invalid metadata field');
  }

  let metadataJson: unknown;
  try {
    metadataJson = JSON.parse(metadataRaw);
  } catch {
    throw new Error('metadata field is not valid JSON');
  }

  const parseResult = metadataSchema.safeParse(metadataJson);
  if (!parseResult.success) {
    const errors = parseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    console.error('❌ [multipart] Metadata 验证失败:');
    console.error('  收到的数据:', JSON.stringify(metadataJson, null, 2));
    console.error('  错误详情:', errors);
    throw new Error(`Metadata validation failed: ${errors}`);
  }

  // Parse file
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new Error('Missing file field');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    metadata: parseResult.data,
    file: {
      buffer,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
    },
  };
}
