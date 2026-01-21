import { Hono } from 'hono';
import { detectionMetadataSchema } from '../schemas';
import { parseMultipartWithMetadata } from '../utils/multipart';
import { storeWithMetadata } from '../services/minio';

export const detectionRoute = new Hono();

detectionRoute.post('/', async (c) => {
  try {
    const { metadata, file } = await parseMultipartWithMetadata(
      c,
      detectionMetadataSchema
    );

    // Build metadata with timestamp
    const storedMetadata = {
      taskId: metadata.taskId,
      imageId: metadata.imageId,
      filename: metadata.filename,
      width: metadata.width,
      height: metadata.height,
      annotations: metadata.annotations,
      storedAt: new Date().toISOString(),
    };

    // Store to MinIO
    const { filePath, metadataPath } = await storeWithMetadata({
      type: 'detection',
      taskId: metadata.taskId,
      filename: metadata.filename,
      fileBuffer: file.buffer,
      fileMimeType: file.mimeType,
      metadata: storedMetadata,
    });

    return c.json({
      success: true,
      data: {
        filePath,
        metadataPath,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return c.json({ success: false, error: message }, 400);
  }
});
