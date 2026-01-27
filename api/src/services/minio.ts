import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { getCategoriesFromLabels, CategoryInfo } from '../utils/category-mapper';

// S3 client instance - can be replaced for testing
let s3Client: S3Client = new S3Client({
  endpoint: env.minio.endpoint,
  region: env.minio.region,
  credentials: {
    accessKeyId: env.minio.accessKey,
    secretAccessKey: env.minio.secretKey,
  },
  forcePathStyle: true, // Required for MinIO
});

/**
 * Get the current S3 client instance
 */
export function getS3Client(): S3Client {
  return s3Client;
}

/**
 * Set a custom S3 client (for testing)
 */
export function setS3Client(client: S3Client): void {
  s3Client = client;
}

/**
 * Reset S3 client to default (for testing cleanup)
 */
export function resetS3Client(): void {
  s3Client = new S3Client({
    endpoint: env.minio.endpoint,
    region: env.minio.region,
    credentials: {
      accessKeyId: env.minio.accessKey,
      secretAccessKey: env.minio.secretKey,
    },
    forcePathStyle: true,
  });
}

export type LabelType = 'detection' | 'multimodal' | 'text-qa' | 'classify' | 'qa-pair';

interface StoreOptions {
  type: LabelType;
  taskId: string;
  filename: string;
  fileBuffer: Buffer;
  fileMimeType: string;
  metadata: Record<string, unknown>;
  labels?: string[];  // Annotation labels for category-based storage
}

/**
 * Get current month in YYYY-MM format
 */
function getMonthPath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Store a file and its metadata to MinIO
 * Structure: {bucket}/{type}/{month}/{category1}/{category2}/{filename}
 * Supports storing to multiple category paths if labels match multiple categories
 */
export async function storeWithMetadata(options: StoreOptions): Promise<{ filePath: string; metadataPath: string; allPaths?: string[] }> {
  const { type, filename, fileBuffer, fileMimeType, metadata, labels } = options;
  const monthPath = getMonthPath();

  // Default fallback category
  const defaultCategory: CategoryInfo = {
    category1: '未分类',
    category2: '未分类',
  };

  // Get categories from labels, or use default
  let categories: CategoryInfo[] = [];
  if (labels && labels.length > 0) {
    categories = getCategoriesFromLabels(labels);
    if (categories.length === 0) {
      console.warn(`⚠️ No matching categories for labels: ${labels.join(', ')}, using default`);
      categories = [defaultCategory];
    }
  } else {
    categories = [defaultCategory];
  }

  // Store file to all matching category paths
  const allPaths: string[] = [];
  const stem = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;

  for (const category of categories) {
    const basePath = `${type}/${monthPath}/${category.category1}/${category.category2}`;
    const filePath = `${basePath}/${filename}`;
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

    allPaths.push(filePath);
    console.log(`✅ 已存储到: ${filePath}`);
  }

  // Return the first path as primary, and all paths in allPaths
  const primaryPath = allPaths[0];
  const primaryMetadataPath = `${primaryPath.substring(0, primaryPath.lastIndexOf('/'))}/${stem}.json`;

  return {
    filePath: primaryPath,
    metadataPath: primaryMetadataPath,
    allPaths: allPaths.length > 1 ? allPaths : undefined,
  };
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
