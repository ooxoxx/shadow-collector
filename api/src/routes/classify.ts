import { Hono } from 'hono';
import { classifyMetadataSchema } from '../schemas';
import { parseMultipartWithMetadata } from '../utils/multipart';
import { storeWithMetadata } from '../services/minio';
import { getClientIP } from '../utils/ip';
import { logUpload, logError } from '../utils/logger';

export const classifyRoute = new Hono();

classifyRoute.post('/', async (c) => {
  try {
    const { metadata, file } = await parseMultipartWithMetadata(
      c,
      classifyMetadataSchema
    );

    // 从请求获取客户端 IP
    const uploadIP = getClientIP(c);

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
      storagePath: metadata.storagePath,
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

    // Log successful upload
    logUpload('CLASSIFY', {
      taskId: metadata.taskId,
      imageId: metadata.imageId,
      filename: metadata.filename,
      fileSize: `${(file.buffer.length / 1024).toFixed(1)}KB`,
      ip: uploadIP,
      filePath,
      metadataPath,
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
    logError('CLASSIFY', message, error);
    return c.json({ success: false, error: message }, 400);
  }
});
