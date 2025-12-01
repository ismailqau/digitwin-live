/**
 * Cache manager that orchestrates all cache services
 * Provides unified interface for caching operations
 */

import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';

import { AudioChunkCacheService } from './audio-chunk-cache.service';
import { EmbeddingCacheService } from './embedding-cache.service';
import { LLMResponseCacheService } from './llm-response-cache.service';
import { CacheType, CleanupResult } from './types';
import { VectorSearchCacheService } from './vector-search-cache.service';

export class CacheManager {
  private prisma: PrismaClient;
  public embedding: EmbeddingCacheService;
  public vectorSearch: VectorSearchCacheService;
  public llmResponse: LLMResponseCacheService;
  public audioChunk: AudioChunkCacheService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.embedding = new EmbeddingCacheService(prisma);
    this.vectorSearch = new VectorSearchCacheService(prisma);
    this.llmResponse = new LLMResponseCacheService(prisma);
    this.audioChunk = new AudioChunkCacheService(prisma);
  }

  /**
   * Clean up all expired cache entries
   */
  async cleanupAll(): Promise<CleanupResult[]> {
    logger.info('Starting cache cleanup for all cache types');

    const results: CleanupResult[] = [];

    try {
      const [embeddingCount, vectorSearchCount, llmResponseCount, audioChunkCount] =
        await Promise.all([
          this.embedding.cleanup(),
          this.vectorSearch.cleanup(),
          this.llmResponse.cleanup(),
          this.audioChunk.cleanup(),
        ]);

      results.push(
        { cacheType: CacheType.EMBEDDING, deletedCount: embeddingCount },
        { cacheType: CacheType.VECTOR_SEARCH, deletedCount: vectorSearchCount },
        { cacheType: CacheType.LLM_RESPONSE, deletedCount: llmResponseCount },
        { cacheType: CacheType.AUDIO_CHUNK, deletedCount: audioChunkCount }
      );

      const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
      logger.info('Cache cleanup completed', { totalDeleted, results });

      return results;
    } catch (error) {
      logger.error('Cache cleanup failed', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Clean up specific cache type
   */
  async cleanupCacheType(cacheType: CacheType): Promise<number> {
    logger.info('Starting cache cleanup', { cacheType });

    try {
      let deletedCount = 0;

      switch (cacheType) {
        case CacheType.EMBEDDING:
          deletedCount = await this.embedding.cleanup();
          break;
        case CacheType.VECTOR_SEARCH:
          deletedCount = await this.vectorSearch.cleanup();
          break;
        case CacheType.LLM_RESPONSE:
          deletedCount = await this.llmResponse.cleanup();
          break;
        case CacheType.AUDIO_CHUNK:
          deletedCount = await this.audioChunk.cleanup();
          break;
      }

      logger.info('Cache cleanup completed', { cacheType, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Cache cleanup failed', { cacheType, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get cache statistics for all cache types
   */
  async getStats(): Promise<{
    embedding: { totalEntries: number };
    vectorSearch: { totalEntries: number };
    llmResponse: {
      totalEntries: number;
      topCached: Array<{ promptHash: string; hitCount: number; provider: string }>;
    };
    audioChunk: { totalEntries: number; totalSizeBytes: number; avgHitCount: number };
  }> {
    try {
      const [embeddingCount, vectorSearchCount, llmResponseCount, llmTopCached, audioStats] =
        await Promise.all([
          this.prisma.embeddingCache.count({ where: { expiresAt: { gt: new Date() } } }),
          this.prisma.vectorSearchCache.count({ where: { expiresAt: { gt: new Date() } } }),
          this.prisma.lLMResponseCache.count({ where: { expiresAt: { gt: new Date() } } }),
          this.llmResponse.getTopCachedResponses(10),
          this.audioChunk.getStats(),
        ]);

      return {
        embedding: { totalEntries: embeddingCount },
        vectorSearch: { totalEntries: vectorSearchCount },
        llmResponse: { totalEntries: llmResponseCount, topCached: llmTopCached },
        audioChunk: audioStats,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmup(data: {
    embeddings?: Array<{ queryText: string; embedding: number[] }>;
    llmResponses?: Array<{ prompt: string; context?: string; provider: string; response: string }>;
  }): Promise<void> {
    logger.info('Starting cache warmup');

    try {
      const promises: Promise<void>[] = [];

      if (data.embeddings) {
        for (const item of data.embeddings) {
          promises.push(this.embedding.set(item.queryText, { embedding: item.embedding }));
        }
      }

      if (data.llmResponses) {
        for (const item of data.llmResponses) {
          promises.push(
            this.llmResponse.set(
              { prompt: item.prompt, context: item.context, provider: item.provider },
              { response: item.response, provider: item.provider }
            )
          );
        }
      }

      await Promise.all(promises);
      logger.info('Cache warmup completed', {
        embeddingsWarmed: data.embeddings?.length || 0,
        llmResponsesWarmed: data.llmResponses?.length || 0,
      });
    } catch (error) {
      logger.error('Cache warmup failed', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Invalidate all cache entries for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    logger.info('Invalidating cache for user', { userId });

    try {
      await this.vectorSearch.invalidateUser(userId);
      logger.info('User cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate user cache', { userId, error: (error as Error).message });
      throw error;
    }
  }
}
