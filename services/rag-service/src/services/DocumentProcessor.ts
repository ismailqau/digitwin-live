/**
 * DocumentProcessor - Process documents through extraction, chunking, and embedding pipeline
 */

import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';
import { Storage } from '@google-cloud/storage';

import { EmbeddingService } from './EmbeddingService';
import { TextChunker, type TextChunk } from './TextChunker';
import { TextExtractor } from './TextExtractor';
import { VectorSearchService } from './VectorSearchService';

export interface ProcessingResult {
  documentId: string;
  status: 'completed' | 'failed';
  chunkCount: number;
  vectorIds: string[];
  error?: string;
  processingTimeMs: number;
}

export interface DocumentProcessorConfig {
  gcsProjectId: string;
  gcsBucket: string;
  chunkSize: number;
  chunkOverlap: number;
  batchSize: number;
  maxFileSizeBytes: number;
}

export class DocumentProcessor {
  private storage: Storage;
  private textExtractor: TextExtractor;
  private textChunker: TextChunker;
  private embeddingService: EmbeddingService;
  private vectorSearchService: VectorSearchService;
  private prisma: PrismaClient;
  private config: DocumentProcessorConfig;

  constructor(
    embeddingService: EmbeddingService,
    vectorSearchService: VectorSearchService,
    prisma: PrismaClient,
    config: DocumentProcessorConfig
  ) {
    this.embeddingService = embeddingService;
    this.vectorSearchService = vectorSearchService;
    this.prisma = prisma;
    this.config = config;

    // Initialize GCS
    this.storage = new Storage({
      projectId: config.gcsProjectId,
    });

    // Initialize text extractor and chunker
    this.textExtractor = new TextExtractor();
    this.textChunker = new TextChunker({
      chunkSize: config.chunkSize,
      overlap: config.chunkOverlap,
    });
  }

  /**
   * Process a document through the complete pipeline
   */
  async processDocument(documentId: string): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting document processing', { documentId });

      // Update status to processing
      await this.updateDocumentStatus(documentId, 'processing');

      // Get document from database
      const document = await this.prisma.knowledgeDocument.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Download file from GCS
      const localFilePath = await this.downloadFromGCS(document.storagePath);

      // Validate file
      const validation = await this.textExtractor.validateFile(
        localFilePath,
        document.contentType,
        this.config.maxFileSizeBytes
      );

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Extract text
      const extractionResult = await this.textExtractor.extract(
        localFilePath,
        document.contentType
      );

      // Update document with extracted text
      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          textContent: extractionResult.text,
        },
      });

      // Chunk text
      const chunks = this.textChunker.chunk(extractionResult.text);
      logger.info('Text chunked', {
        documentId,
        chunkCount: chunks.length,
        stats: this.textChunker.getStats(chunks),
      });

      // Generate embeddings and store chunks
      const vectorIds = await this.processChunks(documentId, document.userId, chunks);

      // Update document status to completed
      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: 'completed',
          processedAt: new Date(),
          chunkCount: chunks.length,
          vectorIds,
        },
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info('Document processing completed', {
        documentId,
        chunkCount: chunks.length,
        vectorIds: vectorIds.length,
        processingTimeMs,
      });

      return {
        documentId,
        status: 'completed',
        chunkCount: chunks.length,
        vectorIds,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Document processing failed', {
        documentId,
        error: errorMessage,
        processingTimeMs,
      });

      // Update document status to failed
      await this.updateDocumentStatus(documentId, 'failed', errorMessage);

      return {
        documentId,
        status: 'failed',
        chunkCount: 0,
        vectorIds: [],
        error: errorMessage,
        processingTimeMs,
      };
    }
  }

  /**
   * Process chunks: generate embeddings and store in vector database
   */
  private async processChunks(
    documentId: string,
    userId: string,
    chunks: TextChunk[]
  ): Promise<string[]> {
    const vectorIds: string[] = [];

    // Process in batches
    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      const batch = chunks.slice(i, i + this.config.batchSize);

      logger.info('Processing chunk batch', {
        documentId,
        batchStart: i,
        batchSize: batch.length,
      });

      // Generate embeddings for batch
      const texts = batch.map((chunk) => chunk.content);
      const embeddings = await this.embeddingService.embedDocuments(texts);

      // Store chunks in database and vector database
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];

        // Create document chunk in database
        const documentChunk = await this.prisma.documentChunk.create({
          data: {
            documentId,
            userId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: JSON.stringify(embedding), // Store as JSON string
            metadata: {
              startOffset: chunk.startOffset,
              endOffset: chunk.endOffset,
              tokenCount: chunk.tokenCount,
            },
          },
        });

        // Upsert to vector database
        await this.vectorSearchService.upsert([
          {
            id: documentChunk.id,
            documentId,
            userId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding,
            metadata: {
              sourceType: 'document',
            },
          },
        ]);

        vectorIds.push(documentChunk.id);
      }
    }

    return vectorIds;
  }

  /**
   * Download file from GCS
   */
  private async downloadFromGCS(storagePath: string): Promise<string> {
    const bucket = this.storage.bucket(this.config.gcsBucket);
    const file = bucket.file(storagePath);

    // Create temporary local path
    const localPath = `/tmp/${Date.now()}-${storagePath.split('/').pop()}`;

    await file.download({ destination: localPath });

    return localPath;
  }

  /**
   * Update document status
   */
  private async updateDocumentStatus(
    documentId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status,
        errorMessage,
        ...(status === 'completed' && { processedAt: new Date() }),
      },
    });
  }

  /**
   * Reindex document (delete old chunks and reprocess)
   */
  async reindexDocument(documentId: string): Promise<ProcessingResult> {
    logger.info('Reindexing document', { documentId });

    // Get document
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      include: { chunks: true },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Delete old chunks from vector database
    if (document.vectorIds.length > 0) {
      await this.vectorSearchService.delete(document.vectorIds);
    }

    // Delete old chunks from database
    await this.prisma.documentChunk.deleteMany({
      where: { documentId },
    });

    // Reset document status
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: 'pending',
        chunkCount: 0,
        vectorIds: [],
        errorMessage: null,
      },
    });

    // Reprocess document
    return await this.processDocument(documentId);
  }
}
