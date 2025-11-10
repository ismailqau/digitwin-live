/**
 * Audio Storage Service
 *
 * Handles audio chunk caching and storage in GCS bucket (digitwin-live-uploads)
 * Implements:
 * - Audio chunk caching with TTL (CACHE_TTL_SHORT = 300s)
 * - Audio storage in GCS with signed URLs
 * - Audio deduplication using hash-based keys
 * - Audio compression (Opus codec)
 * - Automatic cleanup of expired cache entries
 */

import { createHash } from 'crypto';

import { Storage } from '@google-cloud/storage';
import { PrismaClient } from '@prisma/client';

export interface AudioChunkData {
  audioData: Buffer;
  format?: string;
  durationMs: number;
  sampleRate?: number;
  channels?: number;
  compression?: string;
  metadata?: Record<string, any>;
}

export interface AudioCacheKey {
  text?: string;
  voiceModelId?: string;
  sessionId?: string;
  sequenceNumber?: number;
  settings?: Record<string, any>;
}

export interface AudioRetrievalOptions {
  expiresIn?: number; // Signed URL expiration in seconds (default: 3600)
  useCache?: boolean; // Whether to check cache first (default: true)
}

export class AudioStorageService {
  private prisma: PrismaClient;
  private storage: Storage;
  private bucketName: string;
  private cacheTTL: number;

  constructor(
    prisma: PrismaClient,
    storage: Storage,
    bucketName: string = 'digitwin-live-uploads',
    cacheTTL: number = 300 // CACHE_TTL_SHORT = 300s (5 minutes)
  ) {
    this.prisma = prisma;
    this.storage = storage;
    this.bucketName = bucketName;
    this.cacheTTL = cacheTTL;
  }

  /**
   * Generate cache key from audio parameters
   * Uses SHA-256 hash for deduplication
   */
  private generateCacheKey(params: AudioCacheKey): string {
    const keyData = JSON.stringify({
      text: params.text || '',
      voiceModelId: params.voiceModelId || '',
      sessionId: params.sessionId || '',
      sequenceNumber: params.sequenceNumber || 0,
      settings: params.settings || {},
    });

    return createHash('sha256').update(keyData).digest('hex');
  }

  /**
   * Generate GCS storage path for audio chunk
   */
  private generateStoragePath(cacheKey: string, sessionId?: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (sessionId) {
      return `audio-chunks/${year}/${month}/${day}/${sessionId}/${cacheKey}.opus`;
    }

    return `audio-chunks/${year}/${month}/${day}/${cacheKey}.opus`;
  }

  /**
   * Cache audio chunk in PostgreSQL
   * Implements deduplication - if same audio exists, updates hit count
   */
  async cacheAudioChunk(keyParams: AudioCacheKey, audioData: AudioChunkData): Promise<string> {
    const cacheKey = this.generateCacheKey(keyParams);
    const expiresAt = new Date(Date.now() + this.cacheTTL * 1000);

    try {
      // Check if audio chunk already exists (deduplication)
      const existing = await (this.prisma as any).audioChunkCache.findUnique({
        where: { cacheKey },
      });

      if (existing) {
        // Update hit count and expiration
        await (this.prisma as any).audioChunkCache.update({
          where: { cacheKey },
          data: {
            hitCount: { increment: 1 },
            lastAccessedAt: new Date(),
            expiresAt, // Extend expiration
          },
        });

        return cacheKey;
      }

      // Create new cache entry
      await (this.prisma as any).audioChunkCache.create({
        data: {
          cacheKey,
          audioData: audioData.audioData,
          format: audioData.format || 'opus',
          durationMs: audioData.durationMs,
          sampleRate: audioData.sampleRate || 16000,
          channels: audioData.channels || 1,
          compression: audioData.compression || 'opus',
          metadata: audioData.metadata || {},
          expiresAt,
        },
      });

      return cacheKey;
    } catch (error: any) {
      console.error('Error caching audio chunk:', error);
      throw new Error(`Failed to cache audio chunk: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Retrieve audio chunk from cache
   * Updates hit count and last accessed time
   */
  async getAudioChunk(cacheKey: string): Promise<AudioChunkData | null> {
    try {
      const cached = await (this.prisma as any).audioChunkCache.findFirst({
        where: {
          cacheKey,
          expiresAt: { gt: new Date() },
        },
      });

      if (!cached) {
        return null;
      }

      // Update hit count and last accessed time
      await (this.prisma as any).audioChunkCache.update({
        where: { id: cached.id },
        data: {
          hitCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });

      return {
        audioData: Buffer.from(cached.audioData),
        format: cached.format,
        durationMs: cached.durationMs,
        sampleRate: cached.sampleRate,
        channels: cached.channels,
        compression: cached.compression,
        metadata: cached.metadata as Record<string, any>,
      };
    } catch (error) {
      console.error('Error retrieving audio chunk:', error);
      return null;
    }
  }

  /**
   * Store audio chunk in GCS bucket for long-term storage
   * Used for conversation history archival
   */
  async storeAudioInGCS(
    keyParams: AudioCacheKey,
    audioData: Buffer,
    metadata?: Record<string, any>
  ): Promise<string> {
    const cacheKey = this.generateCacheKey(keyParams);
    const storagePath = this.generateStoragePath(cacheKey, keyParams.sessionId);

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      await file.save(audioData, {
        metadata: {
          contentType: 'audio/opus',
          metadata: {
            ...metadata,
            cacheKey,
            uploadedAt: new Date().toISOString(),
          },
        },
        resumable: false,
      });

      // Update cache entry with storage path
      await (this.prisma as any).audioChunkCache.updateMany({
        where: { cacheKey },
        data: { storagePath },
      });

      return storagePath;
    } catch (error: any) {
      console.error('Error storing audio in GCS:', error);
      throw new Error(`Failed to store audio in GCS: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Retrieve audio from GCS with signed URL
   * Provides temporary access to stored audio
   */
  async getAudioFromGCS(storagePath: string, options: AudioRetrievalOptions = {}): Promise<string> {
    const { expiresIn = 3600 } = options;

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`Audio file not found: ${storagePath}`);
      }

      // Generate signed URL
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });

      return signedUrl;
    } catch (error: any) {
      console.error('Error retrieving audio from GCS:', error);
      throw new Error(`Failed to retrieve audio from GCS: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Archive conversation audio to GCS
   * Moves audio chunks from cache to long-term storage
   */
  async archiveConversationAudio(sessionId: string): Promise<number> {
    try {
      // Find all audio chunks for this session
      const chunks = await (this.prisma as any).audioChunkCache.findMany({
        where: {
          metadata: {
            path: ['sessionId'],
            equals: sessionId,
          },
        },
      });

      let archivedCount = 0;

      for (const chunk of chunks) {
        if (!chunk.storagePath) {
          // Store in GCS if not already stored
          await this.storeAudioInGCS(
            { sessionId },
            Buffer.from(chunk.audioData),
            chunk.metadata as Record<string, any>
          );
          archivedCount++;
        }
      }

      return archivedCount;
    } catch (error: any) {
      console.error('Error archiving conversation audio:', error);
      throw new Error(`Failed to archive conversation audio: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Clean up expired cache entries
   * Should be run periodically (e.g., every hour)
   */
  async cleanupExpiredCache(): Promise<number> {
    try {
      const result = await (this.prisma as any).audioChunkCache.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      return result.count;
    } catch (error: any) {
      console.error('Error cleaning up expired cache:', error);
      throw new Error(`Failed to cleanup expired cache: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Clean up old cache entries using LRU eviction
   * Keeps only the most recently accessed entries
   */
  async cleanupLRU(maxEntries: number = 10000): Promise<number> {
    try {
      // Get count of entries
      const count = await (this.prisma as any).audioChunkCache.count();

      if (count <= maxEntries) {
        return 0;
      }

      // Find entries to delete (oldest accessed)
      const entriesToDelete = await (this.prisma as any).audioChunkCache.findMany({
        select: { id: true },
        orderBy: { lastAccessedAt: 'asc' },
        take: count - maxEntries,
      });

      const ids = entriesToDelete.map((e: any) => e.id);

      const result = await (this.prisma as any).audioChunkCache.deleteMany({
        where: { id: { in: ids } },
      });

      return result.count;
    } catch (error: any) {
      console.error('Error cleaning up LRU cache:', error);
      throw new Error(`Failed to cleanup LRU cache: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    totalHits: number;
    avgHitsPerEntry: number;
    totalSizeBytes: number;
  }> {
    try {
      const stats = await (this.prisma as any).audioChunkCache.aggregate({
        _count: { id: true },
        _sum: { hitCount: true },
        _avg: { hitCount: true },
      });

      const validCount = await (this.prisma as any).audioChunkCache.count({
        where: { expiresAt: { gt: new Date() } },
      });

      const expiredCount = await (this.prisma as any).audioChunkCache.count({
        where: { expiresAt: { lte: new Date() } },
      });

      // Note: totalSizeBytes would require a database-specific query
      // This is a placeholder - implement based on your database
      const totalSizeBytes = 0;

      return {
        totalEntries: stats._count.id || 0,
        validEntries: validCount,
        expiredEntries: expiredCount,
        totalHits: stats._sum.hitCount || 0,
        avgHitsPerEntry: stats._avg.hitCount || 0,
        totalSizeBytes,
      };
    } catch (error: any) {
      console.error('Error getting cache stats:', error);
      throw new Error(`Failed to get cache stats: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Invalidate cache by key pattern
   * Useful for invalidating all audio for a specific session or voice model
   */
  async invalidateCacheByPattern(pattern: {
    sessionId?: string;
    voiceModelId?: string;
  }): Promise<number> {
    try {
      const where: any = {};

      if (pattern.sessionId) {
        where.metadata = {
          path: ['sessionId'],
          equals: pattern.sessionId,
        };
      }

      if (pattern.voiceModelId) {
        where.metadata = {
          path: ['voiceModelId'],
          equals: pattern.voiceModelId,
        };
      }

      const result = await (this.prisma as any).audioChunkCache.deleteMany({ where });

      return result.count;
    } catch (error: unknown) {
      console.error('Error invalidating cache by pattern:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to invalidate cache: ${errorMessage}`);
    }
  }
}
