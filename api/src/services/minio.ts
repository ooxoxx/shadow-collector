import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';

const s3Client = new S3Client({
  endpoint: env.minio.endpoint,
  region: env.minio.region,
  credentials: {
    accessKeyId: env.minio.accessKey,
    secretAccessKey: env.minio.secretKey,
  },
  forcePathStyle: true, // Required for MinIO
});

export type LabelType = 'detection' | 'multimodal' | 'text-qa' | 'classify';

interface StoreOptions {
  type: LabelType;
  taskId: string;
  filename: string;
  fileBuffer: Buffer;
  fileMimeType: string;
  metadata: Record<string, unknown>;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getDatePath(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Store a file and its metadata to MinIO
 * Structure: {bucket}/{type}/{date}/{taskId}/{filename}
 */
export async function storeWithMetadata(options: StoreOptions): Promise<{ filePath: string; metadataPath: string }> {
  const { type, taskId, filename, fileBuffer, fileMimeType, metadata } = options;
  const datePath = getDatePath();
  const basePath = `${type}/${datePath}/${taskId}`;
  const filePath = `${basePath}/${filename}`;
  const metadataPath = `${basePath}/${filename}.json`;

  // Upload the file
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.minio.bucket,
      Key: filePath,
      Body: fileBuffer,
      ContentType: fileMimeType,
    })
  );

  // Upload the metadata JSON
  const metadataJson = JSON.stringify(metadata, null, 2);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.minio.bucket,
      Key: metadataPath,
      Body: metadataJson,
      ContentType: 'application/json',
    })
  );

  return { filePath, metadataPath };
}

/**
 * Check MinIO connection and bucket accessibility
 */
export async function checkMinioConnection(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: env.minio.bucket }));
    console.log(`✅ MinIO 连接成功: ${env.minio.endpoint}, bucket: ${env.minio.bucket}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`MinIO 连接失败 (${env.minio.endpoint}): ${message}`);
  }
}
