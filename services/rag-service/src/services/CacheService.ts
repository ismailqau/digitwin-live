import crypto from 'crypto';

import { PrismaClient } from '@clone/database';
import { RAGError } from '@clone/errors';
import { logger } from '@clone/logger';

import { SearchResult } from './VectorSearchService';

export interface CacheConfig {
  enabled: boolean;
  ttlShort: number; // seconds
  ttlMedium: number; // seconds
  ttlLong: number; // seconds
}

export class CacheService {
  private prisma: PrismaClient;
  private config: CacheConfig;

  constructor(prisma: PrismaClient, config: CacheConfig) {
    this.prisma = prisma;
    this.config = config;
  }

  /**
   * Generate hash for cache key
   */
  private generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Cache embedding for a query
   */
  async cacheEmbedding(query: string, embedding: number[]): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const queryHash = this.generateHash(query);
      const expiresAt = new Date(Date.now() + this.config.ttlMedium * 1000);

      await this.prisma.embeddingCache.upsert({
        where: { queryHash },
        create: {
          queryHash,
          embedding,
          expiresAt,
        },
        update: {
          embedding,
          expiresAt,
        },
      });

      logger.debug('Embedding cached', { queryHash });
    } catch (error) {
      logger.error('Failed to cache embedding', { error });
      // Don't throw - caching failures shouldn't break the flow
    }
  }

  /**
   * Get cached embedding for a query
   */
  async getCachedEmbedding(query: string): Promise<number[] | null> {
    if (!this.config.enabled) return null;

    try {
      const queryHash = this.generateHash(query);

      const cached = await this.prisma.embeddingCache.findFirst({
        where: {
          queryHash,
          expiresAt: { gt: new Date() },
        },
      });

      if (cached) {
        logger.debug('Embedding cache hit', { queryHash });
        return cached.embedding;
      }

      logger.debug('Embedding cache miss', { queryHash });
      return null;
    } catch (error) {
      logger.error('Failed to get cached embedding', { error });
      return null;
    }
  }

  /**
   * Cache vector search results
   */
  async cacheSearchResults(
    query: string,
    userId: string,
    filters: Record<string, unknown>,
    results: SearchResult[]
  ): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const queryHash = this.generateHash(JSON.stringify({ query, filters }));
      const expiresAt = new Date(Date.now() + this.config.ttlShort * 1000);

      // Check if entry exists
      const existing = await this.prisma.vectorSearchCache.findFirst({
        where: {
          queryHash,
          userId,
        },
      });

      if (existing) {
        // Update existing
        await this.prisma.vectorSearchCache.update({
          where: { id: existing.id },
          data: {
            results: JSON.parse(JSON.stringify(results)),
            expiresAt,
          },
        });
      } else {
        // Create new
        await this.prisma.vectorSearchCache.create({
          data: {
            queryHash,
            userId,
            results: JSON.parse(JSON.stringify(results)),
            expiresAt,
          },
        });
      }

      logger.debug('Search results cached', { queryHash, userId });
    } catch (error) {
      logger.error('Failed to cache search results', { error });
    }
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(
    query: string,
    userId: string,
    filters: Record<string, unknown>
  ): Promise<SearchResult[] | null> {
    if (!this.config.enabled) return null;

    try {
      const queryHash = this.generateHash(JSON.stringify({ query, filters }));

      const cached = await this.prisma.vectorSearchCache.findFirst({
        where: {
          queryHash,
          userId,
          expiresAt: { gt: new Date() },
        },
      });

      if (cached) {
        logger.debug('Search results cache hit', { queryHash, userId });
        return cached.results as unknown as SearchResult[];
      }

      logger.debug('Search results cache miss', { queryHash, userId });
      return null;
    } catch (error) {
      logger.error('Failed to get cached search results', { error });
      return null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<void> {
    try {
      const now = new Date();

      const [embeddingCount, searchCount] = await Promise.all([
        this.prisma.embeddingCache.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        this.prisma.vectorSearchCache.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
      ]);

      logger.info('Cache cleanup completed', {
        embeddingsDeleted: embeddingCount.count,
        searchResultsDeleted: searchCount.count,
      });
    } catch (error) {
      logger.error('Cache cleanup failed', { error });
      throw new RAGError('Cache cleanup failed');
    }
  }
}
