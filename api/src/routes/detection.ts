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

    // Determine annotation type based on multimodal fields
    const isMultimodal =
      (metadata.descriptionAnnotation?.length ?? 0) > 0 ||
      (metadata.qaAnnotation?.length ?? 0) > 0;
    const annotationType = isMultimodal ? 'multimodal' : 'detection';

    // Build metadata with timestamp and type info
    const storedMetadata = {
      taskId: metadata.taskId,
      imageId: metadata.imageId,
      filename: metadata.filename,
      width: metadata.width,
      height: metadata.height,
      annotations: metadata.annotations,
      // Include multimodal fields
      descriptionAnnotation: metadata.descriptionAnnotation,
      qaAnnotation: metadata.qaAnnotation,
      // Upload metadata
      uploadTime: metadata.uploadTime,
      uploadIP: metadata.uploadIP,
      // Storage metadata
      annotationType,
      storedAt: new Date().toISOString(),
    };

    // Store to MinIO - path uses annotationType
    const { filePath, metadataPath } = await storeWithMetadata({
      type: annotationType,
      taskId: metadata.taskId,
      filename: metadata.filename,
      fileBuffer: file.buffer,
      fileMimeType: file.mimeType,
      metadata: storedMetadata,
    });

    return c.json({
      success: true,
      data: {
        annotationType,
        filePath,
        metadataPath,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    console.error('❌ [detection] 请求处理失败:', message);
    return c.json({ success: false, error: message }, 400);
  }
});
