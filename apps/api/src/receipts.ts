import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Receipt photos (SPEC §5): images only, at most 10 MB. The app shrinks them well below that. */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
} as const;
export type ReceiptType = keyof typeof RECEIPT_TYPES;

/** Every receipt of an expense lives under its trip's directory. */
export const receiptPrefix = (tripId: string, expenseId: string) =>
  `trips/${tripId}/receipts/${expenseId}/`;

export const newReceiptKey = (tripId: string, expenseId: string, type: ReceiptType) =>
  `${receiptPrefix(tripId, expenseId)}${randomUUID()}.${RECEIPT_TYPES[type]}`;

/** A browser form upload straight to storage: POST `fields` and then the file to `url`. */
export interface UploadForm {
  url: string;
  fields: Record<string, string>;
}

/** The private receipts bucket. A fake stands in for it in tests and the local dev server. */
export interface ReceiptStore {
  /** A short-lived upload of exactly `key`, of type `contentType`, no larger than the limit. */
  uploadForm(key: string, contentType: ReceiptType): Promise<UploadForm>;
  /** The stored object's size and type, or undefined if there's none. */
  head(key: string): Promise<{ size: number; contentType: string } | undefined>;
  /** A short-lived link to view it. */
  viewUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

/** Removes a stored receipt, best effort: callers have already committed. */
export const deleteReceipt = (store: ReceiptStore, key: string) =>
  store.delete(key).catch((err: unknown) => console.error('Receipt delete failed', err));

/** Upload forms and view links expire after this many seconds. */
const EXPIRES = 300;

export function s3ReceiptStore(bucket: string): ReceiptStore {
  const s3 = new S3Client({});
  return {
    async uploadForm(key, contentType) {
      return createPresignedPost(s3, {
        Bucket: bucket,
        Key: key,
        Fields: { 'Content-Type': contentType },
        // The policy pins the key and type and caps the size; S3 refuses anything else.
        Conditions: [
          ['eq', '$Content-Type', contentType],
          ['content-length-range', 1, RECEIPT_MAX_BYTES],
        ],
        Expires: EXPIRES,
      });
    },
    async head(key) {
      try {
        const res = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? '' };
      } catch (err) {
        if ((err as { name?: string }).name === 'NotFound') return undefined;
        throw err;
      }
    },
    viewUrl: (key) =>
      getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: EXPIRES }),
    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
