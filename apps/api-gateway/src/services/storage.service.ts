/**
 * Storage Service - Handle file uploads to Google Cloud Storage
 */

import { config } from '@clone/config';
import { logger } from '@clone/logger';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  storagePath: string;
  publicUrl?: string;
  sizeBytes: number;
}

export class StorageService {
  private storage: Storage;
  private bucketName: string;

  constructor(projectId?: string, bucketName?: string) {
    this.storage = new Storage({
      projectId: projectId || config.gcp.projectId,
    });
    this.bucketName = bucketName || config.storage.bucket || 'digitwin-live-documents';
  }

  /**
   * Upload file to GCS from local path
   */
  async uploadFile(
    localFilePath: string,
    userId: string,
    filename: string,
    contentType: string
  ): Promise<UploadResult> {
    try {
      const documentId = uuidv4();
      const storagePath = `${userId}/${documentId}/${filename}`;

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      await bucket.upload(localFilePath, {
        destination: storagePath,
        metadata: {
          contentType,
          metadata: {
            userId,
            documentId,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      const [metadata] = await file.getMetadata();

      logger.info('File uploaded to GCS', {
        storagePath,
        sizeBytes: metadata.size,
        contentType,
      });

      return {
        storagePath,
        sizeBytes: typeof metadata.size === 'string' ? parseInt(metadata.size) : metadata.size || 0,
      };
    } catch (error) {
      logger.error('File upload to GCS failed', { error });
      throw error;
    }
  }

  /**
   * Upload document from buffer
   */
  async uploadDocument(
    userId: string,
    filename: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    try {
      const documentId = uuidv4();
      const storagePath = `${userId}/${documentId}/${filename}`;

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            userId,
            documentId,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      logger.info('Document uploaded to GCS', {
        storagePath,
        sizeBytes: buffer.length,
        contentType,
      });

      return storagePath;
    } catch (error) {
      logger.error('Document upload to GCS failed', { error });
      throw error;
    }
  }

  /**
   * Delete document from GCS
   */
  async deleteDocument(storagePath: string): Promise<void> {
    return this.deleteFile(storagePath);
  }

  /**
   * Delete file from GCS
   */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      await file.delete();

      logger.info('File deleted from GCS', { storagePath });
    } catch (error) {
      logger.error('File deletion from GCS failed', { storagePath, error });
      throw error;
    }
  }

  /**
   * Get signed URL for file download
   */
  async getSignedUrl(storagePath: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

      return url;
    } catch (error) {
      logger.error('Failed to generate signed URL', { storagePath, error });
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      logger.error('Failed to check file existence', { storagePath, error });
      return false;
    }
  }
}
