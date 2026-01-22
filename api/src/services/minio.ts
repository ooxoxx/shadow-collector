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
  storagePath?: string;  // Original storage path for category extraction
}

/**
 * Parse storage path to extract category directories
 * Input: "原始样本区/天津/20251226-1435/设备-输电/未分类/未分类/未分类/filename.jpg"
 * Output: { category1: "设备-输电", category2: "未分类" }
 */
function parseStoragePath(storagePath: string): { category1: string; category2: string } | null {
  const segments = storagePath.split('/').filter(s => s.length > 0);
  // Skip first 3 segments, take 4th and 5th
  if (segments.length >= 5) {
    return {
      category1: segments[3],
      category2: segments[4],
    };
  }
  return null;
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
 * Structure: {bucket}/{type}/{date}/{filename}
 */
export async function storeWithMetadata(options: StoreOptions): Promise<{ filePath: string; metadataPath: string }> {
  const { type, filename, fileBuffer, fileMimeType, metadata, storagePath } = options;
  const datePath = getDatePath();

  // Try to parse category from storagePath, otherwise fallback to type
  let basePath: string;
  if (storagePath) {
    const categories = parseStoragePath(storagePath);
    if (categories) {
      basePath = `${type}/${categories.category1}/${categories.category2}/${datePath}`;
    } else {
      basePath = `${type}/${datePath}`;
    }
  } else {
    basePath = `${type}/${datePath}`;
  }

  const filePath = `${basePath}/${filename}`;
  const stem = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
  const metadataPath = `${basePath}/${stem}.json`;

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
