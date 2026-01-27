import { Hono } from 'hono';
import { classifyMetadataSchema } from '../schemas';
import { parseMultipartWithMetadata } from '../utils/multipart';
import { storeWithMetadata } from '../services/minio';
import { getClientIP } from '../utils/ip';
import { logUpload, logError } from '../utils/logger';
import { getLabelsFromIds } from '../utils/label-id-mapper';

export const classifyRoute = new Hono();

classifyRoute.post('/', async (c) => {
  try {
    const { metadata, file } = await parseMultipartWithMetadata(
      c,
      classifyMetadataSchema
    );

    // 从请求获取客户端 IP
    const uploadIP = getClientIP(c);

    // Convert label IDs to label strings
    const labels = getLabelsFromIds(metadata.labelIds);
    console.log(`📊 将 labelIds [${metadata.labelIds.join(', ')}] 转换为标签: ${labels.join(', ')}`);

    // Build metadata with timestamp
    const storedMetadata = {
      taskId: metadata.taskId,
      imageId: metadata.imageId,
      filename: metadata.filename,
      width: metadata.width,
      height: metadata.height,
      labelIds: metadata.labelIds,
      labels,  // Include converted labels
      // Upload metadata
      uploadTime: metadata.uploadTime,
      uploadIP,
      // Storage metadata
      storagePath: metadata.storagePath,
      storedAt: new Date().toISOString(),
    };

    // Store to MinIO
    const { filePath, metadataPath, allPaths } = await storeWithMetadata({
      type: 'classify',
      taskId: metadata.taskId,
      filename: metadata.filename,
      fileBuffer: file.buffer,
      fileMimeType: file.mimeType,
      metadata: storedMetadata,
      labels,  // Pass labels for category-based storage
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
      labels: labels.join(', '),
      categories: allPaths ? allPaths.length : 1,
    });

    return c.json({
      success: true,
      data: {
        filePath,
        metadataPath,
        allPaths,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    console.error('❌ [classify] 请求处理失败:', message);
    logError('CLASSIFY', message, error);
    return c.json({ success: false, error: message }, 400);
  }
});
