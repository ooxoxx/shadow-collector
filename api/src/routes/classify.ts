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

    // 从请求获取客户端 IP
    const forwarded = c.req.header('x-forwarded-for');
    const uploadIP = forwarded ? forwarded.split(',')[0].trim() : c.req.header('x-real-ip') || null;

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
      uploadIP,
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
      storagePath: metadata.storagePath,
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
    console.error('❌ [classify] 请求处理失败:', message);
    return c.json({ success: false, error: message }, 400);
  }
});
