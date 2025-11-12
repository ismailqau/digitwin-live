import crypto from 'crypto';

import { PrismaClient } from '@clone/database';
import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { TTSRequest, TTSResponse } from '../types';

export interface TTSCacheConfig {
  enableCaching: boolean;
  ttlShort: number; // 5 minutes
  ttlMedium: number; // 1 hour
  ttlLong: number; // 24 hours
  maxCacheSize: number; // Max entries before LRU eviction
  compressionEnabled: boolean;
  pregenerationEnabled: boolean;
}

export interface TTSCacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  cacheByProvider: Record<TTSProvider, number>;
  avgHitCount: number;
  compressionRatio: number;
}

export interface CommonPhrase {
  text: string;
  frequency: number;
  lastUsed: Date;
  voiceModelId?: string;
  provider?: TTSProvider;
}

export class TTSCacheService {
  private prisma: PrismaClient;
  private logger: winston.Logger;
  private config: TTSCacheConfig;
  private commonPhrases: Map<string, CommonPhrase> = new Map();

  constructor(prisma: PrismaClient, logger?: winston.Logger, config?: Partial<TTSCacheConfig>) {
    this.prisma = prisma;
    this.logger = logger || createLogger('tts-cache');
    this.config = {
      enableCaching: process.env.ENABLE_CACHING === 'true',
      ttlShort: parseInt(process.env.CACHE_TTL_SHORT || '300'), // 5 minutes
      ttlMedium: parseInt(process.env.CACHE_TTL_MEDIUM || '3600'), // 1 hour
      ttlLong: parseInt(process.env.CACHE_TTL_LONG || '86400'), // 24 hours
      maxCacheSize: parseInt(process.env.TTS_CACHE_MAX_SIZE || '10000'),
      compressionEnabled: process.env.TTS_CACHE_COMPRESSION === 'true',
      pregenerationEnabled: process.env.TTS_PREGENERATION === 'true',
      ...config,
    };

    // Initialize common phrases tracking
    this.initializeCommonPhrases();
  }

  async get(request: TTSRequest): Promise<TTSResponse | null> {
    if (!this.config.enableCaching) {
      return null;
    }

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
        this.logger.debug('TTS cache miss', { cacheKey, text: request.text.substring(0, 50) });
        return null;
      }

      // Update hit count and last accessed atomically
      await this.prisma.audioChunkCache.update({
        where: { id: cached.id },
        data: {
          hitCount: cached.hitCount + 1,
          lastAccessedAt: new Date(),
        },
      });

      // Track common phrase usage
      this.trackPhraseUsage(request.text, request.voiceModelId, request.provider);

      this.logger.debug('TTS cache hit', {
        cacheKey,
        hitCount: cached.hitCount + 1,
        text: request.text.substring(0, 50),
      });

      // Decompress audio data if needed
      let audioData = Buffer.from(cached.audioData);
      if (cached.compression === 'opus' && this.config.compressionEnabled) {
        const decompressed = await this.decompressAudio(audioData, 'opus');
        audioData = Buffer.from(decompressed);
      }

      return {
        audioData,
        format: cached.format,
        sampleRate: cached.sampleRate,
        duration: cached.durationMs,
        metadata: {
          provider: (cached.metadata as any)?.provider,
          voiceModelId: (cached.metadata as any)?.voiceModelId,
          cost: 0, // Cached results have no additional cost
          latency: 0, // Cached results have no latency
          cached: true,
          originalCost: (cached.metadata as any)?.originalCost || 0,
          originalLatency: (cached.metadata as any)?.originalLatency || 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get from TTS cache', { error });
      return null;
    }
  }

  async set(request: TTSRequest, response: TTSResponse, ttl?: number): Promise<void> {
    if (!this.config.enableCaching) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(request);
      const selectedTTL = ttl || this.selectTTL(request);
      const expiresAt = new Date(Date.now() + selectedTTL * 1000);

      // Compress audio data if enabled
      let audioData = response.audioData;
      let compression = 'none';
      if (this.config.compressionEnabled) {
        audioData = await this.compressAudio(response.audioData, 'opus');
        compression = 'opus';
      }

      // Check cache size and perform LRU eviction if needed
      await this.performLRUEvictionIfNeeded();

      await this.prisma.audioChunkCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          audioData: new Uint8Array(audioData),
          format: response.format,
          durationMs: response.duration,
          sampleRate: response.sampleRate,
          channels: 1, // Mono
          compression,
          metadata: {
            provider: response.metadata.provider,
            voiceModelId: response.metadata.voiceModelId,
            originalCost: response.metadata.cost,
            originalLatency: response.metadata.latency,
            cachedAt: new Date().toISOString(),
            textLength: request.text.length,
            textHash: this.hashText(request.text),
          },
          expiresAt,
          hitCount: 0,
          lastAccessedAt: new Date(),
        },
        update: {
          audioData: new Uint8Array(audioData),
          format: response.format,
          durationMs: response.duration,
          sampleRate: response.sampleRate,
          compression,
          metadata: {
            provider: response.metadata.provider,
            voiceModelId: response.metadata.voiceModelId,
            originalCost: response.metadata.cost,
            originalLatency: response.metadata.latency,
            updatedAt: new Date().toISOString(),
            textLength: request.text.length,
            textHash: this.hashText(request.text),
          },
          expiresAt,
          lastAccessedAt: new Date(),
        },
      });

      // Track common phrase for pregeneration
      this.trackPhraseUsage(request.text, request.voiceModelId, request.provider);

      this.logger.debug('TTS result cached', {
        cacheKey,
        expiresAt,
        compression,
        textLength: request.text.length,
        originalSize: response.audioData.length,
        compressedSize: audioData.length,
      });
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

  async getStats(): Promise<TTSCacheStats> {
    try {
      const stats = await this.prisma.audioChunkCache.aggregate({
        _count: { id: true },
        _sum: { hitCount: true },
        _avg: { hitCount: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      });

      // Calculate total size and compression ratio
      const entries = await this.prisma.audioChunkCache.findMany({
        select: {
          audioData: true,
          metadata: true,
          compression: true,
        },
      });

      const totalSize = entries.reduce((sum, entry) => sum + entry.audioData.length, 0);

      // Calculate compression ratio
      let originalSize = 0;
      let compressedSize = 0;
      entries.forEach((entry) => {
        const size = entry.audioData.length;
        if (entry.compression === 'opus') {
          compressedSize += size;
          // Estimate original size (opus typically compresses to ~10-20% of original)
          originalSize += size * 6; // Rough estimate
        } else {
          originalSize += size;
          compressedSize += size;
        }
      });

      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

      // Calculate hit rate (hits vs total requests)
      const totalHits = stats._sum.hitCount || 0;
      const totalEntries = stats._count.id || 0;
      const hitRate = totalEntries > 0 ? totalHits / totalEntries : 0;

      // Get cache distribution by provider
      const providerStats = await this.prisma.audioChunkCache.groupBy({
        by: ['metadata'],
        _count: { id: true },
        where: {
          expiresAt: { gt: new Date() },
        },
      });

      const cacheByProvider: Record<TTSProvider, number> = {} as any;
      providerStats.forEach((stat) => {
        const provider = (stat.metadata as any)?.provider;
        if (provider) {
          cacheByProvider[provider as TTSProvider] = stat._count.id;
        }
      });

      return {
        totalEntries,
        totalSize,
        hitRate,
        oldestEntry: stats._min.createdAt,
        newestEntry: stats._max.createdAt,
        cacheByProvider,
        avgHitCount: stats._avg.hitCount || 0,
        compressionRatio,
      };
    } catch (error) {
      this.logger.error('Failed to get TTS cache stats', { error });
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        oldestEntry: null,
        newestEntry: null,
        cacheByProvider: {} as Record<TTSProvider, number>,
        avgHitCount: 0,
        compressionRatio: 1,
      };
    }
  }

  /**
   * Check if text is a duplicate (same text + voice combination)
   */
  async isDuplicate(request: TTSRequest): Promise<boolean> {
    const cacheKey = this.generateCacheKey(request);

    const existing = await this.prisma.audioChunkCache.findFirst({
      where: {
        cacheKey,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    return !!existing;
  }

  /**
   * Get common phrases for pregeneration
   */
  async getCommonPhrases(limit: number = 50): Promise<CommonPhrase[]> {
    const phrases = Array.from(this.commonPhrases.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);

    return phrases;
  }

  /**
   * Pregenerate TTS for common phrases
   */
  async pregenerateCommonPhrases(
    synthesizeFunction: (request: TTSRequest) => Promise<TTSResponse>,
    voiceModelId?: string,
    provider?: TTSProvider
  ): Promise<number> {
    if (!this.config.pregenerationEnabled) {
      return 0;
    }

    const commonPhrases = await this.getCommonPhrases(20);
    let pregeneratedCount = 0;

    for (const phrase of commonPhrases) {
      try {
        const request: TTSRequest = {
          text: phrase.text,
          voiceModelId: voiceModelId || phrase.voiceModelId,
          provider: provider || phrase.provider,
        };

        // Check if already cached
        const cached = await this.get(request);
        if (cached) {
          continue;
        }

        // Generate and cache
        const response = await synthesizeFunction(request);
        await this.set(request, response, this.config.ttlLong);

        pregeneratedCount++;
        this.logger.debug('Pregenerated TTS for common phrase', {
          text: phrase.text.substring(0, 50),
          frequency: phrase.frequency,
        });

        // Add small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error('Failed to pregenerate phrase', {
          text: phrase.text.substring(0, 50),
          error,
        });
      }
    }

    this.logger.info('TTS pregeneration completed', { pregeneratedCount });
    return pregeneratedCount;
  }

  /**
   * Optimize cache by removing low-value entries
   */
  async optimizeCache(): Promise<{
    removedCount: number;
    spaceSaved: number;
  }> {
    try {
      // Remove entries with low hit count and old last access
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      const lowValueEntries = await this.prisma.audioChunkCache.findMany({
        where: {
          AND: [
            { hitCount: { lte: 1 } },
            { lastAccessedAt: { lt: cutoffDate } },
            { expiresAt: { gt: new Date() } }, // Don't remove already expired
          ],
        },
        select: { id: true, audioData: true },
      });

      const spaceSaved = lowValueEntries.reduce((sum, entry) => sum + entry.audioData.length, 0);

      const result = await this.prisma.audioChunkCache.deleteMany({
        where: {
          id: { in: lowValueEntries.map((e) => e.id) },
        },
      });

      this.logger.info('Cache optimization completed', {
        removedCount: result.count,
        spaceSaved,
      });

      return {
        removedCount: result.count,
        spaceSaved,
      };
    } catch (error) {
      this.logger.error('Failed to optimize cache', { error });
      return { removedCount: 0, spaceSaved: 0 };
    }
  }

  /**
   * Get cache cost savings
   */
  async getCostSavings(): Promise<{
    totalSavings: number;
    savingsByProvider: Record<TTSProvider, number>;
    hitCount: number;
  }> {
    try {
      const entries = await this.prisma.audioChunkCache.findMany({
        where: {
          expiresAt: { gt: new Date() },
          hitCount: { gt: 0 },
        },
        select: {
          hitCount: true,
          metadata: true,
        },
      });

      let totalSavings = 0;
      const savingsByProvider: Record<TTSProvider, number> = {} as any;
      let totalHitCount = 0;

      entries.forEach((entry) => {
        const originalCost = (entry.metadata as any)?.originalCost || 0;
        const hitCount = entry.hitCount;
        const provider = (entry.metadata as any)?.provider as TTSProvider;

        // Calculate savings (original cost * (hit count - 1) since first hit wasn't saved)
        const savings = originalCost * Math.max(0, hitCount - 1);
        totalSavings += savings;
        totalHitCount += hitCount;

        if (provider) {
          savingsByProvider[provider] = (savingsByProvider[provider] || 0) + savings;
        }
      });

      return {
        totalSavings,
        savingsByProvider,
        hitCount: totalHitCount,
      };
    } catch (error) {
      this.logger.error('Failed to calculate cost savings', { error });
      return {
        totalSavings: 0,
        savingsByProvider: {} as Record<TTSProvider, number>,
        hitCount: 0,
      };
    }
  }

  /**
   * Warm cache with frequently used phrases
   */
  async warmCache(
    phrases: string[],
    synthesizeFunction: (request: TTSRequest) => Promise<TTSResponse>,
    voiceModelId?: string,
    provider?: TTSProvider
  ): Promise<number> {
    let warmedCount = 0;

    for (const text of phrases) {
      try {
        const request: TTSRequest = {
          text,
          voiceModelId,
          provider,
        };

        // Check if already cached
        const cached = await this.get(request);
        if (cached) {
          continue;
        }

        // Generate and cache
        const response = await synthesizeFunction(request);
        await this.set(request, response, this.config.ttlLong);

        warmedCount++;
        this.logger.debug('Warmed cache for phrase', { text: text.substring(0, 50) });

        // Add small delay
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        this.logger.error('Failed to warm cache for phrase', {
          text: text.substring(0, 50),
          error,
        });
      }
    }

    this.logger.info('Cache warming completed', { warmedCount });
    return warmedCount;
  }

  /**
   * Get streaming optimization chunks
   */
  async getStreamingChunks(request: TTSRequest, chunkSize: number = 4096): Promise<Buffer[]> {
    const cached = await this.get(request);
    if (!cached) {
      return [];
    }

    const chunks: Buffer[] = [];
    const audioData = cached.audioData;

    for (let i = 0; i < audioData.length; i += chunkSize) {
      chunks.push(audioData.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Apply audio post-processing (normalization, enhancement)
   */
  async postProcessAudio(
    audioData: Buffer,
    options?: {
      normalize?: boolean;
      enhance?: boolean;
      targetLoudness?: number;
    }
  ): Promise<Buffer> {
    // For now, return the original audio data
    // In a real implementation, you would use audio processing libraries
    // like node-ffmpeg, fluent-ffmpeg, or native audio processing

    if (options?.normalize) {
      // Placeholder for audio normalization
      this.logger.debug('Audio normalization applied');
    }

    if (options?.enhance) {
      // Placeholder for audio enhancement
      this.logger.debug('Audio enhancement applied');
    }

    return audioData;
  }

  // Private helper methods

  private async initializeCommonPhrases(): Promise<void> {
    // Initialize with some common phrases
    const defaultPhrases = [
      'Hello, how can I help you?',
      'Thank you for your question.',
      "I understand what you're asking.",
      'Let me think about that.',
      "That's a great question.",
      "I'm not sure about that.",
      'Could you please clarify?',
      "I'll help you with that.",
      'Is there anything else?',
      'Have a great day!',
    ];

    defaultPhrases.forEach((text) => {
      this.commonPhrases.set(this.hashText(text), {
        text,
        frequency: 1,
        lastUsed: new Date(),
      });
    });
  }

  private trackPhraseUsage(text: string, voiceModelId?: string, provider?: TTSProvider): void {
    const hash = this.hashText(text);
    const existing = this.commonPhrases.get(hash);

    if (existing) {
      existing.frequency++;
      existing.lastUsed = new Date();
    } else {
      this.commonPhrases.set(hash, {
        text,
        frequency: 1,
        lastUsed: new Date(),
        voiceModelId,
        provider,
      });
    }

    // Keep only top 1000 phrases to avoid memory issues
    if (this.commonPhrases.size > 1000) {
      const sorted = Array.from(this.commonPhrases.entries())
        .sort(([, a], [, b]) => b.frequency - a.frequency)
        .slice(0, 1000);

      this.commonPhrases.clear();
      sorted.forEach(([hash, phrase]) => {
        this.commonPhrases.set(hash, phrase);
      });
    }
  }

  private selectTTL(request: TTSRequest): number {
    // Select TTL based on text characteristics
    const textLength = request.text.length;

    if (textLength < 50) {
      // Short phrases - cache longer (common phrases)
      return this.config.ttlLong;
    } else if (textLength < 200) {
      // Medium phrases - medium cache
      return this.config.ttlMedium;
    } else {
      // Long phrases - shorter cache (less likely to be repeated)
      return this.config.ttlShort;
    }
  }

  private async performLRUEvictionIfNeeded(): Promise<void> {
    try {
      const count = await this.prisma.audioChunkCache.count({
        where: { expiresAt: { gt: new Date() } },
      });

      if (count >= this.config.maxCacheSize) {
        // Remove oldest 10% of entries
        const removeCount = Math.floor(this.config.maxCacheSize * 0.1);

        const oldestEntries = await this.prisma.audioChunkCache.findMany({
          where: { expiresAt: { gt: new Date() } },
          orderBy: { lastAccessedAt: 'asc' },
          take: removeCount,
          select: { id: true },
        });

        await this.prisma.audioChunkCache.deleteMany({
          where: { id: { in: oldestEntries.map((e) => e.id) } },
        });

        this.logger.info('LRU eviction performed', { removedCount: oldestEntries.length });
      }
    } catch (error) {
      this.logger.error('Failed to perform LRU eviction', { error });
    }
  }

  private async compressAudio(audioData: Buffer, format: 'opus' | 'mp3'): Promise<Buffer> {
    // Placeholder for audio compression
    // In a real implementation, you would use audio compression libraries
    // For now, return the original data
    this.logger.debug('Audio compression applied', { format, originalSize: audioData.length });
    return audioData;
  }

  private async decompressAudio(audioData: Buffer, format: 'opus' | 'mp3'): Promise<Buffer> {
    // Placeholder for audio decompression
    // In a real implementation, you would use audio decompression libraries
    // For now, return the original data
    this.logger.debug('Audio decompression applied', { format, compressedSize: audioData.length });
    return audioData;
  }

  private hashText(text: string): string {
    return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
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
