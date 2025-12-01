/**
 * Embedding cache service using PostgreSQL EmbeddingCache table
 * Caches query embeddings to avoid redundant API calls
 */

import crypto from 'crypto';

import { config } from '@clone/config';
import { PrismaClient } from '@clone/database';

import { BaseCacheService } from './base-cache.service';
import { CacheOptions } from './types';

export interface EmbeddingCacheEntry {
  embedding: number[];
}

export class EmbeddingCacheService extends BaseCacheService<EmbeddingCacheEntry, string> {
  constructor(prisma: PrismaClient) {
    super(prisma, config.cache.ttlMedium); // 1 hour default
  }

  /**
   * Generate cache key from query text
   */
  protected generateCacheKey(queryText: string): string {
    return crypto.createHash('sha256').update(queryText.trim().toLowerCase()).digest('hex');
  }

  /**
   * Get embedding from cache
   */
  async get(queryText: string, _options?: CacheOptions): Promise<EmbeddingCacheEntry | null> {
    if (!this.isCacheEnabled()) {
      return null;
    }

    try {
      const queryHash = this.generateCacheKey(queryText);

      const cached = await this.prisma.embeddingCache.findUnique({
        where: { queryHash },
      });

      if (!cached) {
        this.logCacheMiss(queryHash);
        return null;
      }

      if (this.isExpired(cached.expiresAt)) {
        // Delete expired entry
        await this.delete(queryText);
        this.logCacheMiss(queryHash);
        return null;
      }

      this.logCacheHit(queryHash);
      return { embedding: cached.embedding };
    } catch (error) {
      this.handleCacheError(error as Error, 'get');
      return null;
    }
  }

  /**
   * Set embedding in cache
   */
  async set(queryText: string, value: EmbeddingCacheEntry, options?: CacheOptions): Promise<void> {
    if (!this.isCacheEnabled()) {
      return;
    }

    try {
      const queryHash = this.generateCacheKey(queryText);
      const expiresAt = this.calculateExpiresAt(options?.ttl);

      await this.prisma.embeddingCache.upsert({
        where: { queryHash },
        create: {
          queryHash,
          embedding: value.embedding,
          expiresAt,
        },
        update: {
          embedding: value.embedding,
          expiresAt,
        },
      });

      this.logCacheSet(queryHash, options?.ttl || this.defaultTTL);
    } catch (error) {
      this.handleCacheError(error as Error, 'set');
    }
  }

  /**
   * Delete embedding from cache
   */
  async delete(queryText: string): Promise<void> {
    if (!this.isCacheEnabled()) {
      return;
    }

    try {
      const queryHash = this.generateCacheKey(queryText);

      await this.prisma.embeddingCache.delete({
        where: { queryHash },
      });

      this.logCacheDelete(queryHash);
    } catch (error) {
      this.handleCacheError(error as Error, 'delete');
    }
  }

  /**
   * Clean up expired embeddings
   */
  async cleanup(): Promise<number> {
    if (!this.isCacheEnabled()) {
      return 0;
    }

    try {
      const result = await this.prisma.embeddingCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return result.count;
    } catch (error) {
      this.handleCacheError(error as Error, 'cleanup');
      return 0;
    }
  }
}
