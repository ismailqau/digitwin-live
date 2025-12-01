/**
 * Base cache service for PostgreSQL-based caching
 * Provides common caching operations for all cache types
 */

import { config } from '@clone/config';
import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';

import { CacheOptions } from './types';

export abstract class BaseCacheService<T = unknown, K = unknown> {
  protected prisma: PrismaClient;
  protected defaultTTL: number;
  protected cacheEnabled: boolean;

  constructor(prisma: PrismaClient, defaultTTL?: number) {
    this.prisma = prisma;
    this.defaultTTL = defaultTTL || config.cache.ttlMedium;
    this.cacheEnabled = config.cache.enabled;
  }

  /**
   * Generate cache key from input
   */
  protected abstract generateCacheKey(input: K): string;

  /**
   * Get value from cache
   */
  abstract get(key: K, options?: CacheOptions): Promise<T | null>;

  /**
   * Set value in cache
   */
  abstract set(key: K, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete value from cache
   */
  abstract delete(key: K): Promise<void>;

  /**
   * Check if cache is enabled
   */
  protected isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  /**
   * Calculate expiration date
   */
  protected calculateExpiresAt(ttl?: number): Date {
    const ttlSeconds = ttl || this.defaultTTL;
    return new Date(Date.now() + ttlSeconds * 1000);
  }

  /**
   * Check if entry is expired
   */
  protected isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Log cache hit
   */
  protected logCacheHit(key: string): void {
    logger.debug('Cache hit', { key, service: this.constructor.name });
  }

  /**
   * Log cache miss
   */
  protected logCacheMiss(key: string): void {
    logger.debug('Cache miss', { key, service: this.constructor.name });
  }

  /**
   * Log cache set
   */
  protected logCacheSet(key: string, ttl: number): void {
    logger.debug('Cache set', { key, ttl, service: this.constructor.name });
  }

  /**
   * Log cache delete
   */
  protected logCacheDelete(key: string): void {
    logger.debug('Cache delete', { key, service: this.constructor.name });
  }

  /**
   * Handle cache error
   */
  protected handleCacheError(error: Error, operation: string): void {
    logger.error('Cache operation failed', {
      operation,
      error: error.message,
      service: this.constructor.name,
    });
  }
}
