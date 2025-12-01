/**
 * Storage Service
 *
 * Handles file uploads to Google Cloud Storage.
 * Implements:
 * - Chunked file uploads
 * - Signed URL generation
 * - File metadata management
 * - Storage bucket operations
 */

import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_SERVICE_ACCOUNT_KEY_PATH,
});

interface UploadOptions {
  contentType?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  resumable?: boolean;
  chunkSize?: number;
}

interface UploadResult {
  path: string;
  url: string;
  size: number;
  contentType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Upload file to Google Cloud Storage
 */
export async function uploadToGCS(
  bucketName: string,
  fileName: string,
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uploadOptions: any = {
      metadata: {
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata || {},
      },
      resumable: options.resumable || false,
    };

    if (options.chunkSize) {
      uploadOptions.chunkSize = options.chunkSize;
    }

    // Upload the file
    await file.save(buffer, uploadOptions);

    // Get file metadata
    await file.getMetadata();

    return {
      path: fileName,
      url: `gs://${bucketName}/${fileName}`,
      size: buffer.length,
      contentType: options.contentType || 'application/octet-stream',
      metadata: options.metadata,
    };
  } catch (error) {
    console.error('GCS upload error:', error);
    throw new Error(`Failed to upload file to GCS: ${error}`);
  }
}

/**
 * Generate signed URL for file access
 */
export async function generateSignedUrl(
  bucketName: string,
  fileName: string,
  options: {
    action: 'read' | 'write' | 'delete';
    expires: Date;
    contentType?: string;
  }
): Promise<string> {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    const signedUrlOptions: {
      version: 'v4';
      action: 'read' | 'write' | 'delete';
      expires: Date;
      contentType?: string;
    } = {
      version: 'v4',
      action: options.action,
      expires: options.expires,
    };

    if (options.contentType) {
      signedUrlOptions.contentType = options.contentType;
    }

    const [url] = await file.getSignedUrl(signedUrlOptions);
    return url;
  } catch (error) {
    console.error('Signed URL generation error:', error);
    throw new Error(`Failed to generate signed URL: ${error}`);
  }
}

/**
 * Delete file from Google Cloud Storage
 */
export async function deleteFromGCS(bucketName: string, fileName: string): Promise<void> {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.delete();
  } catch (error) {
    console.error('GCS delete error:', error);
    throw new Error(`Failed to delete file from GCS: ${error}`);
  }
}

/**
 * Check if file exists in GCS
 */
export async function fileExists(bucketName: string, fileName: string): Promise<boolean> {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error('GCS file exists check error:', error);
    return false;
  }
}

/**
 * Get file metadata from GCS
 */
export async function getFileMetadata(
  bucketName: string,
  fileName: string
): Promise<Record<string, unknown>> {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    const [metadata] = await file.getMetadata();
    return metadata;
  } catch (error) {
    console.error('GCS metadata retrieval error:', error);
    throw new Error(`Failed to get file metadata: ${error}`);
  }
}

/**
 * List files in bucket with prefix
 */
export async function listFiles(
  bucketName: string,
  prefix?: string,
  maxResults?: number
): Promise<
  Array<{
    name: string;
    size: number;
    contentType: string;
    timeCreated: Date;
    updated: Date;
  }>
> {
  try {
    const bucket = storage.bucket(bucketName);

    const options: Record<string, unknown> = {};
    if (prefix) options.prefix = prefix;
    if (maxResults) options.maxResults = maxResults;

    const [files] = await bucket.getFiles(options);

    return files.map((file) => ({
      name: file.name,
      size: parseInt(String(file.metadata.size || '0')),
      contentType: file.metadata.contentType || 'application/octet-stream',
      timeCreated: new Date(file.metadata.timeCreated || Date.now()),
      updated: new Date(file.metadata.updated || Date.now()),
    }));
  } catch (error) {
    console.error('GCS list files error:', error);
    throw new Error(`Failed to list files: ${error}`);
  }
}

export default {
  uploadToGCS,
  generateSignedUrl,
  deleteFromGCS,
  fileExists,
  getFileMetadata,
  listFiles,
};
