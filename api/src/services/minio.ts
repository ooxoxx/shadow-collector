import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
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

/**
 * Encode S3 object key for CopySource header
 * Encodes each path segment (for non-ASCII chars) but preserves "/" separators
 */
function encodeS3Key(key: string): string {
  return key.split('/').map(segment => encodeURIComponent(segment)).join('/');
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
 * Structure:
 *   - Normal case: {bucket}/{type}/{month}/{category1}/{category2}/{filename}
 *   - Single-level: {bucket}/{type}/{month}/{category1}/{filename} (when category2 is empty)
 * Supports storing to multiple category paths if labels match multiple categories
 */
export async function storeWithMetadata(options: StoreOptions): Promise<{ filePath: string; metadataPath: string; allPaths?: string[] }> {
  const { type, filename, fileBuffer, fileMimeType, metadata, labels } = options;
  const monthPath = getMonthPath();

  // Default fallback category (single-level 未分类/)
  const defaultCategory: CategoryInfo = {
    category1: '未分类',
    category2: '',  // Empty = single-level directory
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
    // Handle single-level directory when category2 is empty
    const basePath = category.category2
      ? `${type}/${monthPath}/${category.category1}/${category.category2}`
      : `${type}/${monthPath}/${category.category1}`;
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

/**
 * Get an object from MinIO as Buffer
 */
export async function getObject(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: env.minio.bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${key}`);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Copy an object within MinIO
 */
export async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  await s3Client.send(
    new CopyObjectCommand({
      Bucket: env.minio.bucket,
      CopySource: `${env.minio.bucket}/${encodeS3Key(sourceKey)}`,
      Key: destKey,
    })
  );
}

/**
 * Delete an object from MinIO
 */
export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.minio.bucket,
      Key: key,
    })
  );
}

/**
 * Move an object (copy + delete)
 */
export async function moveObject(sourceKey: string, destKey: string): Promise<void> {
  await copyObject(sourceKey, destKey);
  await deleteObject(sourceKey);
}

/**
 * List objects by prefix
 */
export async function listObjectsByPrefix(
  prefix: string,
  maxKeys?: number
): Promise<{ key: string; size?: number; lastModified?: Date }[]> {
  const results: { key: string; size?: number; lastModified?: Date }[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: env.minio.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys ? Math.min(maxKeys - results.length, 1000) : 1000,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          results.push({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
          });
        }
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken && (!maxKeys || results.length < maxKeys));

  return results;
}
