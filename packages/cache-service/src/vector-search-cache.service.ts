/**
 * Vector search cache service using PostgreSQL VectorSearchCache table
 * Caches vector search results to avoid redundant searches
 */

import crypto from 'crypto';

import { config } from '@clone/config';
import { PrismaClient } from '@clone/database';

import { BaseCacheService } from './base-cache.service';
import { CacheOptions } from './types';

export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;
}

export interface VectorSearchCacheEntry {
  results: VectorSearchResult[];
}

export interface VectorSearchQuery {
  embedding: number[];
  topK: number;
  userId: string;
  filters?: Record<string, any>;
}

export class VectorSearchCacheService extends BaseCacheService<
  VectorSearchCacheEntry,
  VectorSearchQuery
> {
  constructor(prisma: PrismaClient) {
    super(prisma, config.cache.ttlShort); // 5 minutes default
  }

  /**
   * Generate cache key from query parameters
   */
  protected generateCacheKey(query: VectorSearchQuery): string {
    const keyData = {
      embedding: query.embedding.slice(0, 10), // Use first 10 dimensions for key
      topK: query.topK,
      userId: query.userId,
      filters: query.filters || {},
    };
    return crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Get search results from cache
   */
  async get(
    query: VectorSearchQuery,
    _options?: CacheOptions
  ): Promise<VectorSearchCacheEntry | null> {
    if (!this.isCacheEnabled()) {
      return null;
    }

    try {
      const queryHash = this.generateCacheKey(query);

      const cached = await this.prisma.vectorSearchCache.findFirst({
        where: {
          queryHash,
          userId: query.userId,
        },
      });

      if (!cached) {
        this.logCacheMiss(queryHash);
        return null;
      }

      if (this.isExpired(cached.expiresAt)) {
        // Delete expired entry
        await this.prisma.vectorSearchCache.delete({
          where: { id: cached.id },
        });
        this.logCacheMiss(queryHash);
        return null;
      }

      this.logCacheHit(queryHash);
      return { results: cached.results as unknown as VectorSearchResult[] };
    } catch (error) {
      this.handleCacheError(error as Error, 'get');
      return null;
    }
  }

  /**
   * Set search results in cache
   */
  async set(
    query: VectorSearchQuery,
    value: VectorSearchCacheEntry,
    options?: CacheOptions
  ): Promise<void> {
    if (!this.isCacheEnabled()) {
      return;
    }

    try {
      const queryHash = this.generateCacheKey(query);
      const expiresAt = this.calculateExpiresAt(options?.ttl);

      await this.prisma.vectorSearchCache.create({
        data: {
          queryHash,
          userId: query.userId,
          results: value.results as any,
          expiresAt,
        },
      });

      this.logCacheSet(queryHash, options?.ttl || this.defaultTTL);
    } catch (error) {
      this.handleCacheError(error as Error, 'set');
    }
  }

  /**
   * Delete search results from cache
   */
  async delete(query: VectorSearchQuery): Promise<void> {
    if (!this.isCacheEnabled()) {
      return;
    }

    try {
      const queryHash = this.generateCacheKey(query);

      await this.prisma.vectorSearchCache.deleteMany({
        where: {
          queryHash,
          userId: query.userId,
        },
      });

      this.logCacheDelete(queryHash);
    } catch (error) {
      this.handleCacheError(error as Error, 'delete');
    }
  }

  /**
   * Invalidate all cache entries for a user
   */
  async invalidateUser(userId: string): Promise<number> {
    if (!this.isCacheEnabled()) {
      return 0;
    }

    try {
      const result = await this.prisma.vectorSearchCache.deleteMany({
        where: { userId },
      });

      return result.count;
    } catch (error) {
      this.handleCacheError(error as Error, 'invalidateUser');
      return 0;
    }
  }

  /**
   * Clean up expired search results
   */
  async cleanup(): Promise<number> {
    if (!this.isCacheEnabled()) {
      return 0;
    }

    try {
      const result = await this.prisma.vectorSearchCache.deleteMany({
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
