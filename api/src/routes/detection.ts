import { Hono } from 'hono';
import { detectionMetadataSchema } from '../schemas';
import { parseMultipartWithMetadata } from '../utils/multipart';
import { storeWithMetadata } from '../services/minio';
import { getClientIP } from '../utils/ip';
import { logUpload, logError } from '../utils/logger';
import { extractLabelsFromAnnotations } from '../utils/category-mapper';

export const detectionRoute = new Hono();

detectionRoute.post('/', async (c) => {
  try {
    const { metadata, file } = await parseMultipartWithMetadata(
      c,
      detectionMetadataSchema
    );

    // 从请求获取客户端 IP
    const uploadIP = getClientIP(c);

    // Determine annotation type based on multimodal fields
    const isMultimodal =
      (metadata.descriptionAnnotation?.length ?? 0) > 0 ||
      (metadata.qaAnnotation?.length ?? 0) > 0;
    const annotationType = isMultimodal ? 'multimodal' : 'detection';

    // Extract labels from annotations
    const labels = extractLabelsFromAnnotations(metadata.annotations);
    console.log(`📊 提取到 ${labels.length} 个标签: ${labels.join(', ')}`);

    // Build metadata with timestamp and type info
    const storedMetadata = {
      taskId: metadata.taskId,
      imageId: metadata.imageId,
      filename: metadata.filename,
      width: metadata.width,
      height: metadata.height,
      annotations: metadata.annotations,
      labels,  // Include extracted labels
      // Include multimodal fields
      descriptionAnnotation: metadata.descriptionAnnotation,
      qaAnnotation: metadata.qaAnnotation,
      // Upload metadata
      uploadTime: metadata.uploadTime,
      uploadIP,
      // Storage metadata
      annotationType,
      storagePath: metadata.storagePath,
      storedAt: new Date().toISOString(),
    };

    // Store to MinIO - path uses annotationType
    const { filePath, metadataPath, allPaths } = await storeWithMetadata({
      type: annotationType,
      taskId: metadata.taskId,
      filename: metadata.filename,
      fileBuffer: file.buffer,
      fileMimeType: file.mimeType,
      metadata: storedMetadata,
      labels,  // Pass labels for category-based storage
    });

    // Log successful upload
    logUpload('DETECTION', {
      taskId: metadata.taskId,
      imageId: metadata.imageId,
      filename: metadata.filename,
      fileSize: `${(file.buffer.length / 1024).toFixed(1)}KB`,
      ip: uploadIP,
      filePath,
      metadataPath,
      annotationType,
      labels: labels.join(', '),
      categories: allPaths ? allPaths.length : 1,
    });

    return c.json({
      success: true,
      data: {
        annotationType,
        filePath,
        metadataPath,
        allPaths,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    console.error('❌ [detection] 请求处理失败:', message);
    logError('DETECTION', message, error);
    return c.json({ success: false, error: message }, 400);
  }
});
