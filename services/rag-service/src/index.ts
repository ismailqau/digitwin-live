// RAG Service - Retrieval-Augmented Generation pipeline
import { resolve } from 'path';

import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';
import { config } from 'dotenv';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../../.env') });

import { CacheService } from './services/CacheService';
import { ContextAssembler } from './services/ContextAssembler';
import { EmbeddingService } from './services/EmbeddingService';
import { RAGOrchestrator } from './services/RAGOrchestrator';
import { VectorSearchService } from './services/VectorSearchService';

export const RAG_SERVICE_VERSION = '1.0.0';

// Export all services
export { EmbeddingService } from './services/EmbeddingService';
export { VectorSearchService, PostgreSQLVectorSearch } from './services/VectorSearchService';
export { ContextAssembler } from './services/ContextAssembler';
export { CacheService } from './services/CacheService';
export { RAGOrchestrator } from './services/RAGOrchestrator';
export { TextExtractor } from './services/TextExtractor';
export { TextChunker } from './services/TextChunker';
export { DocumentProcessor } from './services/DocumentProcessor';
export { DocumentProcessingQueue } from './services/DocumentProcessingQueue';

// Export types
export type { SearchResult, SearchFilter } from './services/VectorSearchService';
export type { ConversationTurn, UserProfile, LLMContext } from './services/ContextAssembler';
export type { RAGQueryRequest, RAGQueryResponse } from './services/RAGOrchestrator';
export type { TextChunk, ChunkerConfig } from './services/TextChunker';
export type { ExtractionResult } from './services/TextExtractor';
export type { ProcessingResult, DocumentProcessorConfig } from './services/DocumentProcessor';
export type { DocumentProcessingJob, QueueConfig } from './services/DocumentProcessingQueue';

/**
 * Initialize RAG service with configuration
 */
export function initializeRAGService(config: {
  projectId: string;
  location: string;
  databaseUrl: string;
  cacheEnabled?: boolean;
  cacheTtlShort?: number;
  cacheTtlMedium?: number;
  cacheTtlLong?: number;
  similarityThreshold?: number;
  topK?: number;
  maxConversationTurns?: number;
  enableQueryOptimization?: boolean;
  enableHybridSearch?: boolean;
  sourcePriority?: Record<string, number>;
}): RAGOrchestrator {
  logger.info('Initializing RAG service', {
    projectId: config.projectId,
    location: config.location,
  });

  // Initialize Prisma client
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.databaseUrl,
      },
    },
  });

  // Initialize embedding service
  const embeddingService = new EmbeddingService({
    model: 'text-embedding-004',
    projectId: config.projectId,
    location: config.location,
  });

  // Initialize vector search service (PostgreSQL with pgvector)
  const vectorSearchService = new VectorSearchService({
    postgresql: {
      connectionString: config.databaseUrl,
      similarityThreshold: config.similarityThreshold || 0.7,
    },
  });

  // Initialize context assembler
  const contextAssembler = new ContextAssembler({
    maxConversationTurns: config.maxConversationTurns || 5,
    maxKnowledgeChunks: config.topK || 5,
  });

  // Initialize cache service
  const cacheService = new CacheService(prisma, {
    enabled: config.cacheEnabled !== false,
    ttlShort: config.cacheTtlShort || 300, // 5 minutes
    ttlMedium: config.cacheTtlMedium || 3600, // 1 hour
    ttlLong: config.cacheTtlLong || 86400, // 24 hours
  });

  // Initialize RAG orchestrator
  const ragOrchestrator = new RAGOrchestrator(
    embeddingService,
    vectorSearchService,
    contextAssembler,
    cacheService,
    {
      topK: config.topK || 5,
      similarityThreshold: config.similarityThreshold || 0.7,
      maxConversationTurns: config.maxConversationTurns || 5,
      enableQueryOptimization: config.enableQueryOptimization || false,
      enableHybridSearch: config.enableHybridSearch || false,
      sourcePriority: config.sourcePriority || { faq: 1.5, document: 1.0, conversation: 0.8 },
    }
  );

  logger.info('RAG service initialized successfully');

  return ragOrchestrator;
}

// Main entry point for standalone service
if (require.main === module) {
  const config = {
    projectId: process.env.GCP_PROJECT_ID || '',
    location: process.env.GCP_LOCATION || 'us-central1',
    databaseUrl: process.env.DATABASE_URL || '',
    cacheEnabled: process.env.ENABLE_CACHING !== 'false',
    cacheTtlShort: parseInt(process.env.CACHE_TTL_SHORT || '300'),
    cacheTtlMedium: parseInt(process.env.CACHE_TTL_MEDIUM || '3600'),
    cacheTtlLong: parseInt(process.env.CACHE_TTL_LONG || '86400'),
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
    topK: parseInt(process.env.RAG_TOP_K || '5'),
    maxConversationTurns: parseInt(process.env.MAX_CONVERSATION_TURNS || '5'),
  };

  const ragService = initializeRAGService(config);

  // Perform health check
  ragService.healthCheck().then((health) => {
    logger.info('RAG service health check', health);
    if (health.status === 'unhealthy') {
      logger.error('RAG service is unhealthy');
      process.exit(1);
    }
  });

  // Set up periodic cache cleanup (every hour)
  setInterval(async () => {
    try {
      const prisma = new PrismaClient();
      const cacheService = new CacheService(prisma, {
        enabled: true,
        ttlShort: 300,
        ttlMedium: 3600,
        ttlLong: 86400,
      });
      await cacheService.cleanup();
    } catch (error) {
      logger.error('Periodic cache cleanup failed', { error });
    }
  }, 3600000); // 1 hour

  logger.info('RAG service started', { version: RAG_SERVICE_VERSION });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`[rag-service] ${signal} received, shutting down...`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
