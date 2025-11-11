import crypto from 'crypto';

import { PrismaClient } from '@clone/database';
import { createLogger } from '@clone/logger';
import winston from 'winston';

import { TTSRequest, TTSResponse } from '../types';

export class TTSCacheService {
  private prisma: PrismaClient;
  private logger: winston.Logger;
  private defaultTTL: number;

  constructor(prisma: PrismaClient, logger?: winston.Logger, ttl = 3600) {
    this.prisma = prisma;
    this.logger = logger || createLogger('tts-cache');
    this.defaultTTL = ttl; // Default 1 hour TTL
  }

  async get(request: TTSRequest): Promise<TTSResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(request);

      const cached = await this.prisma.audioChunkCache.findFirst({
        where: {
          cacheKey,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!cached) {
        return null;
      }

      // Update hit count and last accessed
      await this.prisma.audioChunkCache.update({
        where: { id: cached.id },
        data: {
          hitCount: cached.hitCount + 1,
          lastAccessedAt: new Date(),
        },
      });

      this.logger.debug('TTS cache hit', { cacheKey });

      return {
        audioData: Buffer.from(cached.audioData),
        format: cached.format,
        sampleRate: cached.sampleRate,
        duration: cached.durationMs,
        metadata: {
          provider: (cached.metadata as any)?.provider,
          voiceModelId: (cached.metadata as any)?.voiceModelId,
          cost: 0, // Cached results have no additional cost
          latency: 0, // Cached results have no latency
        },
      };
    } catch (error) {
      this.logger.error('Failed to get from TTS cache', { error });
      return null;
    }
  }

  async set(request: TTSRequest, response: TTSResponse, ttl?: number): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const expiresAt = new Date(Date.now() + (ttl || this.defaultTTL) * 1000);

      await this.prisma.audioChunkCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          audioData: new Uint8Array(response.audioData),
          format: response.format,
          durationMs: response.duration,
          sampleRate: response.sampleRate,
          channels: 1, // Mono
          compression: 'none', // Store uncompressed for now
          metadata: {
            provider: response.metadata.provider,
            voiceModelId: response.metadata.voiceModelId,
            originalCost: response.metadata.cost,
            originalLatency: response.metadata.latency,
            cachedAt: new Date().toISOString(),
          },
          expiresAt,
          hitCount: 0,
          lastAccessedAt: new Date(),
        },
        update: {
          audioData: new Uint8Array(response.audioData),
          format: response.format,
          durationMs: response.duration,
          sampleRate: response.sampleRate,
          metadata: {
            provider: response.metadata.provider,
            voiceModelId: response.metadata.voiceModelId,
            originalCost: response.metadata.cost,
            originalLatency: response.metadata.latency,
            updatedAt: new Date().toISOString(),
          },
          expiresAt,
          lastAccessedAt: new Date(),
        },
      });

      this.logger.debug('TTS result cached', { cacheKey, expiresAt });
    } catch (error) {
      this.logger.error('Failed to cache TTS result', { error });
      // Don't throw - caching failures shouldn't break the main flow
    }
  }

  async delete(request: TTSRequest): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(request);

      await this.prisma.audioChunkCache.deleteMany({
        where: { cacheKey },
      });

      this.logger.debug('TTS cache entry deleted', { cacheKey });
    } catch (error) {
      this.logger.error('Failed to delete from TTS cache', { error });
    }
  }

  async cleanup(): Promise<number> {
    try {
      const result = await this.prisma.audioChunkCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      this.logger.info('TTS cache cleanup completed', { deletedCount: result.count });
      return result.count;
    } catch (error) {
      this.logger.error('Failed to cleanup TTS cache', { error });
      return 0;
    }
  }

  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    try {
      const stats = await this.prisma.audioChunkCache.aggregate({
        _count: { id: true },
        _sum: { hitCount: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      });

      // Calculate total size (approximate)
      const entries = await this.prisma.audioChunkCache.findMany({
        select: { audioData: true },
      });

      const totalSize = entries.reduce((sum, entry) => sum + entry.audioData.length, 0);

      // Calculate hit rate (hits vs total requests)
      const totalHits = stats._sum.hitCount || 0;
      const totalEntries = stats._count.id || 0;
      const hitRate = totalEntries > 0 ? totalHits / totalEntries : 0;

      return {
        totalEntries,
        totalSize,
        hitRate,
        oldestEntry: stats._min.createdAt,
        newestEntry: stats._max.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to get TTS cache stats', { error });
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  private generateCacheKey(request: TTSRequest): string {
    // Create a deterministic cache key based on request parameters
    const keyData = {
      text: request.text,
      voiceModelId: request.voiceModelId,
      provider: request.provider,
      options: {
        sampleRate: request.options?.sampleRate,
        speed: request.options?.speed,
        pitch: request.options?.pitch,
        format: request.options?.format,
        languageCode: request.options?.languageCode,
        voiceName: request.options?.voiceName,
      },
    };

    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }
}
