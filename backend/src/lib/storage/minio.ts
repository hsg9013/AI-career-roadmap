import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';

// T029: MinIO presigned URL 발급·검증 (R-2). S3 호환 API.

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true, // MinIO는 path-style 필수
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

export type BucketKey =
  | 'portfolios'
  | 'mission-submissions'
  | 'data-exports'
  | 'invoices';

const BUCKET_MAP: Record<BucketKey, string> = {
  portfolios: env.S3_BUCKET_PORTFOLIOS,
  'mission-submissions': env.S3_BUCKET_SUBMISSIONS,
  'data-exports': env.S3_BUCKET_DATA_EXPORTS,
  invoices: env.S3_BUCKET_INVOICES,
};

export async function presignPut(
  bucket: BucketKey,
  key: string,
  contentType: string,
  expiresInSec = 900, // 15분
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET_MAP[bucket],
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

export async function presignGet(
  bucket: BucketKey,
  key: string,
  expiresInSec = 900,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET_MAP[bucket], Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

export async function deleteObject(bucket: BucketKey, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_MAP[bucket], Key: key }));
}

export { s3 as s3Client };
