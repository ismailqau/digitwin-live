/**
 * DocumentService - Handles document upload, storage, and processing coordination
 */

import crypto from 'crypto';

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
  title?: string;
  author?: string;
  sourceUrl?: string;
  tags: string[];
  errorMessage?: string;
}

export interface ProcessingStatus {
  documentId: string;
  status: string;
  progress: number;
  chunkCount: number;
  errorMessage?: string;
}

export interface DocumentSearchParams {
  q?: string;
  status?: string;
  fileType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface DocumentSearchResult {
  documents: DocumentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentStatistics {
  totalDocuments: number;
  documentsByStatus: Record<string, number>;
  documentsByType: Record<string, number>;
  totalStorageBytes: number;
  processingSuccessRate: number;
  averageProcessingTimeMs: number;
  mostReferencedDocuments: Array<{
    id: string;
    filename: string;
    referenceCount: number;
  }>;
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

    // Check for duplicates using content hash
    const contentHash = this.calculateHash(file.buffer);
    const existingDoc = await this.prisma.knowledgeDocument.findFirst({
      where: {
        userId,
        storagePath: { contains: contentHash },
        deletedAt: null,
      },
    });

    if (existingDoc) {
      throw new Error('Duplicate document detected');
    }

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
        tags: [],
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
   * Batch upload documents
   */
  async batchUploadDocuments(userId: string, files: UploadedFile[]): Promise<DocumentResponse[]> {
    const results: DocumentResponse[] = [];

    for (const file of files) {
      try {
        const document = await this.uploadDocument(userId, file);
        results.push(document);
      } catch (error) {
        logger.error('Failed to upload document in batch', {
          filename: file.originalname,
          error,
        });
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Get user's documents with pagination and filtering
   */
  async getUserDocuments(
    userId: string,
    params: DocumentSearchParams
  ): Promise<DocumentSearchResult> {
    const { q, status, fileType, dateFrom, dateTo, sortBy, order, page, limit } = params;

    // Build where clause
    const where: Record<string, unknown> = {
      userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (fileType) {
      where.contentType = { contains: fileType };
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) {
        dateFilter.gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.lte = new Date(dateTo);
      }
      where.uploadedAt = dateFilter;
    }

    if (q) {
      where.OR = [
        { filename: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { textContent: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    // Build order by
    const orderBy: Record<string, string> = {};
    if (sortBy) {
      orderBy[sortBy] = order || 'desc';
    } else {
      orderBy.uploadedAt = 'desc';
    }

    // Get total count
    const total = await this.prisma.knowledgeDocument.count({ where });

    // Get documents
    const documents = await this.prisma.knowledgeDocument.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      documents: documents.map((doc) => this.formatDocumentResponse(doc)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
   * Get document content
   */
  async getDocumentContent(documentId: string, userId: string): Promise<string | null> {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
      select: {
        textContent: true,
      },
    });

    return document?.textContent || null;
  }

  /**
   * Get document chunks
   */
  async getDocumentChunks(
    documentId: string,
    userId: string
  ): Promise<{
    documentId: string;
    filename: string;
    chunkCount: number;
    chunks: Array<{
      id: string;
      chunkIndex: number;
      content: string;
      metadata: unknown;
    }>;
  } | null> {
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

    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        documentId,
      },
      orderBy: {
        chunkIndex: 'asc',
      },
    });

    return {
      documentId: document.id,
      filename: document.filename,
      chunkCount: chunks.length,
      chunks: chunks.map((chunk) => ({
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        metadata: chunk.metadata as unknown,
      })),
    };
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: string,
    userId: string,
    updates: { title?: string; tags?: string[]; sourceUrl?: string }
  ): Promise<DocumentResponse> {
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

    const updated = await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: updates,
    });

    logger.info('Document metadata updated', { documentId, userId, updates });

    return this.formatDocumentResponse(updated);
  }

  /**
   * Update document status
   */
  async updateDocumentStatus(
    documentId: string,
    userId: string,
    status: string
  ): Promise<DocumentResponse> {
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

    const updated = await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status },
    });

    logger.info('Document status updated', { documentId, userId, status });

    return this.formatDocumentResponse(updated);
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
   * Bulk delete documents
   */
  async bulkDeleteDocuments(documentIds: string[], userId: string): Promise<number> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        id: { in: documentIds },
        userId,
        deletedAt: null,
      },
    });

    if (documents.length === 0) {
      return 0;
    }

    // Soft delete all documents
    await this.prisma.knowledgeDocument.updateMany({
      where: {
        id: { in: documentIds },
        userId,
      },
      data: { deletedAt: new Date() },
    });

    // Delete from storage
    for (const doc of documents) {
      await this.storageService.deleteDocument(doc.storagePath);
    }

    logger.info('Bulk delete completed', { count: documents.length, userId });

    return documents.length;
  }

  /**
   * Reindex document
   */
  async reindexDocument(documentId: string, userId: string): Promise<{ jobId: string }> {
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

    // Update status to pending
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: 'pending',
        errorMessage: null,
      },
    });

    // Queue for reprocessing
    // TODO: Add to processing queue
    const jobId = `reindex-${documentId}-${Date.now()}`;

    logger.info('Document queued for reindexing', { documentId, userId, jobId });

    return { jobId };
  }

  /**
   * Bulk reindex documents
   */
  async bulkReindexDocuments(documentIds: string[], userId: string): Promise<{ jobId: string }> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        id: { in: documentIds },
        userId,
        deletedAt: null,
      },
    });

    if (documents.length === 0) {
      throw new Error('No documents found');
    }

    // Update status to pending
    await this.prisma.knowledgeDocument.updateMany({
      where: {
        id: { in: documentIds },
        userId,
      },
      data: {
        status: 'pending',
        errorMessage: null,
      },
    });

    // Queue for reprocessing
    // TODO: Add to processing queue
    const jobId = `bulk-reindex-${Date.now()}`;

    logger.info('Documents queued for bulk reindexing', {
      count: documents.length,
      userId,
      jobId,
    });

    return { jobId };
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
   * Get document statistics
   */
  async getDocumentStatistics(userId: string): Promise<DocumentStatistics> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });

    const totalDocuments = documents.length;
    const documentsByStatus: Record<string, number> = {};
    const documentsByType: Record<string, number> = {};
    let totalStorageBytes = 0;
    let completedCount = 0;
    let totalProcessingTime = 0;

    for (const doc of documents) {
      // Count by status
      documentsByStatus[doc.status] = (documentsByStatus[doc.status] || 0) + 1;

      // Count by type
      const fileType = doc.contentType.split('/')[1] || 'unknown';
      documentsByType[fileType] = (documentsByType[fileType] || 0) + 1;

      // Sum storage
      totalStorageBytes += doc.sizeBytes;

      // Calculate processing time
      if (doc.status === 'completed' && doc.processedAt) {
        completedCount++;
        const processingTime = doc.processedAt.getTime() - doc.uploadedAt.getTime();
        totalProcessingTime += processingTime;
      }
    }

    const processingSuccessRate =
      totalDocuments > 0 ? (documentsByStatus.completed || 0) / totalDocuments : 0;

    const averageProcessingTimeMs = completedCount > 0 ? totalProcessingTime / completedCount : 0;

    // Get most referenced documents
    // TODO: Implement based on conversation turns
    const mostReferencedDocuments: Array<{
      id: string;
      filename: string;
      referenceCount: number;
    }> = [];

    return {
      totalDocuments,
      documentsByStatus,
      documentsByType,
      totalStorageBytes,
      processingSuccessRate,
      averageProcessingTimeMs,
      mostReferencedDocuments,
    };
  }

  /**
   * Get storage usage breakdown
   */
  async getStorageUsage(userId: string) {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        contentType: true,
        sizeBytes: true,
      },
    });

    const usageByType: Record<string, { count: number; bytes: number }> = {};
    let totalBytes = 0;

    for (const doc of documents) {
      const fileType = doc.contentType.split('/')[1] || 'unknown';
      if (!usageByType[fileType]) {
        usageByType[fileType] = { count: 0, bytes: 0 };
      }
      usageByType[fileType].count++;
      usageByType[fileType].bytes += doc.sizeBytes;
      totalBytes += doc.sizeBytes;
    }

    return {
      totalBytes,
      totalMB: totalBytes / (1024 * 1024),
      totalGB: totalBytes / (1024 * 1024 * 1024),
      byType: usageByType,
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
   * Calculate content hash for duplicate detection
   */
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
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
    title: string | null;
    author: string | null;
    sourceUrl: string | null;
    tags: string[];
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
      title: document.title || undefined,
      author: document.author || undefined,
      sourceUrl: document.sourceUrl || undefined,
      tags: document.tags,
      errorMessage: document.errorMessage || undefined,
    };
  }
}
