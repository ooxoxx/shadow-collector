export const env = {
  port: parseInt(process.env.PORT || '8001', 10),
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'shadow-collector',
    region: process.env.MINIO_REGION || 'us-east-1',
  },
} as const;
