/**
 * DocumentService - Handles document upload, storage, and processing coordination
 */

import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';

import { StorageService } from './storage.service';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface DocumentResponse {
  id: string;
  userId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  processedAt?: string;
  status: string;
  chunkCount: number;
  errorMessage?: string;
}

export interface ProcessingStatus {
  documentId: string;
  status: string;
  progress: number;
  chunkCount: number;
  errorMessage?: string;
}

export class DocumentService {
  private prisma: PrismaClient;
  private storageService: StorageService;
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly SUPPORTED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/html',
    'text/markdown',
    'text/x-markdown',
  ];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.storageService = new StorageService();
  }

  /**
   * Upload document and queue for processing
   */
  async uploadDocument(userId: string, file: UploadedFile): Promise<DocumentResponse> {
    logger.info('Uploading document', {
      userId,
      filename: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    });

    // Validate file
    this.validateFile(file);

    // Upload to GCS
    const storagePath = await this.storageService.uploadDocument(
      userId,
      file.originalname,
      file.buffer,
      file.mimetype
    );

    // Create document record
    const document = await this.prisma.knowledgeDocument.create({
      data: {
        userId,
        filename: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
        status: 'pending',
        textContent: '', // Will be filled during processing
        chunkCount: 0,
        vectorIds: [],
      },
    });

    logger.info('Document uploaded successfully', {
      documentId: document.id,
      userId,
      filename: file.originalname,
    });

    // Queue for processing (will be implemented with Bull/BullMQ)
    // For now, we'll just return the document
    // TODO: Add to processing queue

    return this.formatDocumentResponse(document);
  }

  /**
   * Get user's documents
   */
  async getUserDocuments(userId: string): Promise<DocumentResponse[]> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return documents.map((doc) => this.formatDocumentResponse(doc));
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string, userId: string): Promise<DocumentResponse | null> {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
    });

    if (!document) {
      return null;
    }

    return this.formatDocumentResponse(document);
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Soft delete
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    // Delete from storage
    await this.storageService.deleteDocument(document.storagePath);

    // Delete chunks from vector database
    // TODO: Implement vector database deletion

    logger.info('Document deleted', { documentId, userId });
  }

  /**
   * Get processing status
   */
  async getProcessingStatus(documentId: string, userId: string): Promise<ProcessingStatus | null> {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
    });

    if (!document) {
      return null;
    }

    // Calculate progress based on status
    let progress = 0;
    switch (document.status) {
      case 'pending':
        progress = 0;
        break;
      case 'processing':
        progress = 50;
        break;
      case 'completed':
        progress = 100;
        break;
      case 'failed':
        progress = 0;
        break;
    }

    return {
      documentId: document.id,
      status: document.status,
      progress,
      chunkCount: document.chunkCount,
      errorMessage: document.errorMessage || undefined,
    };
  }

  /**
   * Validate file
   */
  private validateFile(file: UploadedFile): void {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(
        `File size (${file.size} bytes) exceeds maximum allowed size (${this.MAX_FILE_SIZE} bytes)`
      );
    }

    // Check if file is empty
    if (file.size === 0) {
      throw new Error('File is empty');
    }

    // Check content type
    if (!this.SUPPORTED_TYPES.includes(file.mimetype)) {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }
  }

  /**
   * Format document response
   */
  private formatDocumentResponse(document: {
    id: string;
    userId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    uploadedAt: Date;
    processedAt: Date | null;
    status: string;
    chunkCount: number;
    errorMessage: string | null;
  }): DocumentResponse {
    return {
      id: document.id,
      userId: document.userId,
      filename: document.filename,
      contentType: document.contentType,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.uploadedAt.toISOString(),
      processedAt: document.processedAt?.toISOString(),
      status: document.status,
      chunkCount: document.chunkCount,
      errorMessage: document.errorMessage || undefined,
    };
  }
}
