import { createHash } from 'crypto';

import { createLogger } from '@clone/logger';

import { ASRCacheEntry } from './types';

const logger = createLogger('asr-cache');

/**
 * ASR Cache Service using PostgreSQL
 * Caches transcription results for repeated audio phrases
 */
export class ASRCacheService {
  private memoryCache: Map<string, ASRCacheEntry> = new Map();
  private readonly maxMemoryCacheSize = 1000;

  /**
   * Generate cache key from audio data
   */
  generateCacheKey(audioData: Buffer, languageCode: string): string {
    const hash = createHash('sha256').update(audioData).digest('hex');
    return `asr:${languageCode}:${hash}`;
  }

  /**
   * Get cached transcript from memory cache
   * In production, this would query PostgreSQL cache_asr_results table
   */
  async get(cacheKey: string): Promise<ASRCacheEntry | null> {
    // Check memory cache first
    const cached = this.memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      logger.debug('ASR cache hit (memory)', { cacheKey });
      return cached;
    }

    // TODO: Query PostgreSQL cache_asr_results table
    // const result = await db.cache_asr_results.findFirst({
    //   where: {
    //     cache_key: cacheKey,
    //     expires_at: { gt: new Date() }
    //   }
    // });

    return null;
  }

  /**
   * Store transcript in cache
   * In production, this would insert into PostgreSQL cache_asr_results table
   */
  async set(
    cacheKey: string,
    transcript: string,
    confidence: number,
    languageCode: string,
    ttl: number
  ): Promise<void> {
    const entry: ASRCacheEntry = {
      audioHash: cacheKey,
      transcript,
      confidence,
      languageCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttl * 1000),
    };

    // Store in memory cache
    this.memoryCache.set(cacheKey, entry);

    // Evict oldest entries if cache is too large
    if (this.memoryCache.size > this.maxMemoryCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    // TODO: Insert into PostgreSQL cache_asr_results table
    // await db.cache_asr_results.create({
    //   data: {
    //     cache_key: cacheKey,
    //     cache_value: { transcript, confidence, languageCode },
    //     expires_at: entry.expiresAt
    //   }
    // });

    logger.debug('ASR result cached', { cacheKey, transcript: transcript.substring(0, 50) });
  }

  /**
   * Delete cached entry
   */
  async delete(cacheKey: string): Promise<void> {
    this.memoryCache.delete(cacheKey);

    // TODO: Delete from PostgreSQL
    // await db.cache_asr_results.deleteMany({
    //   where: { cache_key: cacheKey }
    // });
  }

  /**
   * Clear expired entries
   * Should be run periodically
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    let deletedCount = 0;

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
    }

    // TODO: Clean PostgreSQL cache
    // await db.$executeRaw`
    //   DELETE FROM cache_asr_results WHERE expires_at < NOW()
    // `;

    if (deletedCount > 0) {
      logger.info('ASR cache cleanup completed', { deletedCount });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      maxMemoryCacheSize: this.maxMemoryCacheSize,
    };
  }
}
