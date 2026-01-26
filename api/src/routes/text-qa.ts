import { Hono } from 'hono';
import { textQaMetadataSchema } from '../schemas';
import { parseMultipartWithMetadata } from '../utils/multipart';
import { storeWithMetadata } from '../services/minio';
import { getClientIP } from '../utils/ip';

export const textQaRoute = new Hono();

textQaRoute.post('/', async (c) => {
  try {
    const { metadata, file } = await parseMultipartWithMetadata(
      c,
      textQaMetadataSchema
    );

    // 从请求获取客户端 IP
    const uploadIP = getClientIP(c);

    // Build metadata with timestamp
    const storedMetadata = {
      fileId: metadata.fileId,
      filename: metadata.filename,
      taskId: metadata.taskId,
      batchId: metadata.batchId,
      annotations: metadata.annotations,
      // Upload metadata
      uploadTime: metadata.uploadTime,
      uploadIP,
      // Storage metadata
      storagePath: metadata.storagePath,
      storedAt: new Date().toISOString(),
    };

    // Store to MinIO - use taskId as string for path
    const taskIdStr = String(metadata.taskId);

    const { filePath, metadataPath } = await storeWithMetadata({
      type: 'text-qa',
      taskId: taskIdStr,
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
    console.error('❌ [text-qa] 请求处理失败:', message);
    return c.json({ success: false, error: message }, 400);
  }
});
