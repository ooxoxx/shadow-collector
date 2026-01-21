import { Hono } from 'hono';
import { classifyMetadataSchema } from '../schemas';
import { parseMultipartWithMetadata } from '../utils/multipart';
import { storeWithMetadata } from '../services/minio';

export const classifyRoute = new Hono();

classifyRoute.post('/', async (c) => {
  try {
    const { metadata, file } = await parseMultipartWithMetadata(
      c,
      classifyMetadataSchema
    );

    // Build metadata with timestamp
    const storedMetadata = {
      taskId: metadata.taskId,
      imageId: metadata.imageId,
      filename: metadata.filename,
      width: metadata.width,
      height: metadata.height,
      labelIds: metadata.labelIds,
      // Upload metadata
      uploadTime: metadata.uploadTime,
      uploadIP: metadata.uploadIP,
      // Storage metadata
      storedAt: new Date().toISOString(),
    };

    // Store to MinIO
    const { filePath, metadataPath } = await storeWithMetadata({
      type: 'classify',
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
