import { Hono } from 'hono';
import { qaPairMetadataSchema } from '../schemas';
import { parseMultipartWithMetadata } from '../utils/multipart';
import { storeWithMetadata } from '../services/minio';

export const qaPairRoute = new Hono();

qaPairRoute.post('/', async (c) => {
  try {
    const { metadata, file } = await parseMultipartWithMetadata(
      c,
      qaPairMetadataSchema
    );

    // 从请求获取客户端 IP
    const forwarded = c.req.header('x-forwarded-for');
    const uploadIP = forwarded ? forwarded.split(',')[0].trim() : c.req.header('x-real-ip') || null;

    const storedMetadata = {
      taskId: metadata.taskId,
      dataTxtId: metadata.dataTxtId,
      filename: metadata.filename,
      department: metadata.department,
      annotation: metadata.annotation,
      uploadTime: metadata.uploadTime,
      uploadIP,
      storedAt: new Date().toISOString(),
    };

    const { filePath, metadataPath } = await storeWithMetadata({
      type: 'qa-pair',
      taskId: metadata.taskId,
      filename: metadata.filename,
      fileBuffer: file.buffer,
      fileMimeType: file.mimeType,
      metadata: storedMetadata,
      storagePath: metadata.storagePath,
    });

    return c.json({
      success: true,
      data: { filePath, metadataPath },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    console.error('❌ [qa-pair] 请求处理失败:', message);
    return c.json({ success: false, error: message }, 400);
  }
});
