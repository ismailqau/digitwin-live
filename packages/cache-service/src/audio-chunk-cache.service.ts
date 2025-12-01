/**
 * Audio chunk cache service using PostgreSQL AudioChunkCache table
 * Caches TTS-generated audio chunks to avoid redundant synthesis
 */

import crypto from 'crypto';

import { config } from '@clone/config';
import { PrismaClient } from '@clone/database';

import { BaseCacheService } from './base-cache.service';
import { CacheOptions } from './types';

export interface AudioChunkCacheEntry {
  audioData: Buffer;
  format: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  compression: string;
  storagePath?: string;
  metadata?: Record<string, any>;
}

export interface AudioChunkKey {
  text: string;
  voiceModelId: string;
  provider: string;
  settings?: Record<string, any>;
}

export class AudioChunkCacheService extends BaseCacheService<AudioChunkCacheEntry, AudioChunkKey> {
  constructor(prisma: PrismaClient) {
    super(prisma, config.cache.ttlShort); // 5 minutes default
  }

  /**
   * Generate cache key from audio parameters
   */
  protected generateCacheKey(audioKey: AudioChunkKey): string {
    const keyData = {
      text: audioKey.text.trim(),
      voiceModelId: audioKey.voiceModelId,
      provider: audioKey.provider,
      settings: audioKey.settings || {},
    };
    return crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Get audio chunk from cache
   */
  async get(
    audioKey: AudioChunkKey,
    _options?: CacheOptions
  ): Promise<AudioChunkCacheEntry | null> {
    if (!this.isCacheEnabled()) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(audioKey);

      const cached = await this.prisma.audioChunkCache.findUnique({
        where: { cacheKey },
      });

      if (!cached) {
        this.logCacheMiss(cacheKey);
        return null;
      }

      if (this.isExpired(cached.expiresAt)) {
        // Delete expired entry
        await this.delete(audioKey);
        this.logCacheMiss(cacheKey);
        return null;
      }

      // Update hit count and last accessed time
      await this.prisma.audioChunkCache.update({
        where: { cacheKey },
        data: {
          hitCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });

      this.logCacheHit(cacheKey);
      return {
        audioData: Buffer.from(cached.audioData),
        format: cached.format,
        durationMs: cached.durationMs,
        sampleRate: cached.sampleRate,
        channels: cached.channels,
        compression: cached.compression,
        storagePath: cached.storagePath || undefined,
        metadata: cached.metadata as Record<string, any>,
      };
    } catch (error) {
      this.handleCacheError(error as Error, 'get');
      return null;
    }
  }

  /**
   * Set audio chunk in cache
   */
  async set(
    audioKey: AudioChunkKey,
    value: AudioChunkCacheEntry,
    options?: CacheOptions
  ): Promise<void> {
    if (!this.isCacheEnabled()) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(audioKey);
      const expiresAt = this.calculateExpiresAt(options?.ttl);

      await this.prisma.audioChunkCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          audioData: Buffer.from(value.audioData) as any,
          format: value.format,
          durationMs: value.durationMs,
          sampleRate: value.sampleRate,
          channels: value.channels,
          compression: value.compression,
          storagePath: value.storagePath,
          metadata: value.metadata || {},
          expiresAt,
          hitCount: 0,
        },
        update: {
          audioData: Buffer.from(value.audioData) as any,
          format: value.format,
          durationMs: value.durationMs,
          sampleRate: value.sampleRate,
          channels: value.channels,
          compression: value.compression,
          storagePath: value.storagePath,
          metadata: value.metadata || {},
          expiresAt,
        },
      });

      this.logCacheSet(cacheKey, options?.ttl || this.defaultTTL);
    } catch (error) {
      this.handleCacheError(error as Error, 'set');
    }
  }

  /**
   * Delete audio chunk from cache
   */
  async delete(audioKey: AudioChunkKey): Promise<void> {
    if (!this.isCacheEnabled()) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(audioKey);

      await this.prisma.audioChunkCache.delete({
        where: { cacheKey },
      });

      this.logCacheDelete(cacheKey);
    } catch (error) {
      this.handleCacheError(error as Error, 'delete');
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSizeBytes: number;
    avgHitCount: number;
    mostAccessed: Array<{ cacheKey: string; hitCount: number }>;
  }> {
    if (!this.isCacheEnabled()) {
      return {
        totalEntries: 0,
        totalSizeBytes: 0,
        avgHitCount: 0,
        mostAccessed: [],
      };
    }

    try {
      const [totalEntries, aggregates, mostAccessed] = await Promise.all([
        this.prisma.audioChunkCache.count({
          where: {
            expiresAt: { gt: new Date() },
          },
        }),
        this.prisma.audioChunkCache.aggregate({
          where: {
            expiresAt: { gt: new Date() },
          },
          _avg: {
            hitCount: true,
          },
        }),
        this.prisma.audioChunkCache.findMany({
          where: {
            expiresAt: { gt: new Date() },
          },
          orderBy: {
            hitCount: 'desc',
          },
          take: 10,
          select: {
            cacheKey: true,
            hitCount: true,
          },
        }),
      ]);

      // Calculate total size (approximate)
      const sampleEntries = await this.prisma.audioChunkCache.findMany({
        take: 100,
        select: {
          audioData: true,
        },
      });

      const avgSize =
        sampleEntries.length > 0
          ? sampleEntries.reduce((sum, entry) => sum + entry.audioData.length, 0) /
            sampleEntries.length
          : 0;

      return {
        totalEntries,
        totalSizeBytes: Math.round(avgSize * totalEntries),
        avgHitCount: aggregates._avg.hitCount || 0,
        mostAccessed,
      };
    } catch (error) {
      this.handleCacheError(error as Error, 'getStats');
      return {
        totalEntries: 0,
        totalSizeBytes: 0,
        avgHitCount: 0,
        mostAccessed: [],
      };
    }
  }

  /**
   * Clean up expired audio chunks
   */
  async cleanup(): Promise<number> {
    if (!this.isCacheEnabled()) {
      return 0;
    }

    try {
      const result = await this.prisma.audioChunkCache.deleteMany({
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

  /**
   * Clean up least recently accessed entries when cache is full
   */
  async cleanupLRU(maxEntries: number): Promise<number> {
    if (!this.isCacheEnabled()) {
      return 0;
    }

    try {
      const totalEntries = await this.prisma.audioChunkCache.count();

      if (totalEntries <= maxEntries) {
        return 0;
      }

      const entriesToDelete = totalEntries - maxEntries;

      // Get least recently accessed entries
      const oldestEntries = await this.prisma.audioChunkCache.findMany({
        orderBy: {
          lastAccessedAt: 'asc',
        },
        take: entriesToDelete,
        select: {
          id: true,
        },
      });

      const result = await this.prisma.audioChunkCache.deleteMany({
        where: {
          id: {
            in: oldestEntries.map((e) => e.id),
          },
        },
      });

      return result.count;
    } catch (error) {
      this.handleCacheError(error as Error, 'cleanupLRU');
      return 0;
    }
  }
}
