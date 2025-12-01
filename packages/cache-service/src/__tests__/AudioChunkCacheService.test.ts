/**
 * Tests for AudioChunkCacheService with LRU eviction
 */

import { PrismaClient } from '@clone/database';

import { AudioChunkCacheService } from '../audio-chunk-cache.service';

// Mock config
jest.mock('@clone/config', () => ({
  config: {
    cache: {
      enabled: true,
      ttlShort: 300,
      ttlMedium: 3600,
      ttlLong: 86400,
    },
  },
}));

const mockPrisma = {
  audioChunkCache: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('AudioChunkCacheService', () => {
  let service: AudioChunkCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AudioChunkCacheService(mockPrisma);
  });

  describe('get', () => {
    it('should return cached audio chunk and update access time', async () => {
      const audioKey = {
        text: 'test text',
        voiceModelId: 'voice-1',
        provider: 'xtts' as const,
      };
      const audioData = Buffer.from('audio data');
      const futureDate = new Date(Date.now() + 10000);

      mockPrisma.audioChunkCache.findUnique = jest.fn().mockResolvedValue({
        id: 'cache-1',
        cacheKey: 'test-key',
        audioData,
        format: 'wav',
        durationMs: 1000,
        sampleRate: 22050,
        channels: 1,
        compression: 'none',
        storagePath: null,
        metadata: {},
        hitCount: 5,
        lastAccessedAt: new Date(),
        expiresAt: futureDate,
        createdAt: new Date(),
      });

      mockPrisma.audioChunkCache.update = jest.fn().mockResolvedValue({});

      const result = await service.get(audioKey);

      expect(result).toEqual({
        audioData,
        format: 'wav',
        durationMs: 1000,
        sampleRate: 22050,
        channels: 1,
        compression: 'none',
        metadata: {},
      });
      expect(mockPrisma.audioChunkCache.update).toHaveBeenCalledWith({
        where: { cacheKey: expect.any(String) },
        data: {
          hitCount: { increment: 1 },
          lastAccessedAt: expect.any(Date),
        },
      });
    });

    it('should return null if cache entry does not exist', async () => {
      mockPrisma.audioChunkCache.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.get({
        text: 'non-existent',
        voiceModelId: 'voice-1',
        provider: 'xtts',
      });

      expect(result).toBeNull();
    });

    it('should return null if cache expired', async () => {
      const pastDate = new Date(Date.now() - 10000);

      mockPrisma.audioChunkCache.findUnique = jest.fn().mockResolvedValue({
        id: 'cache-1',
        cacheKey: 'test-key',
        audioData: Buffer.from('audio'),
        format: 'wav',
        sampleRate: 22050,
        hitCount: 5,
        expiresAt: pastDate,
      });

      const result = await service.get({
        text: 'test',
        voiceModelId: 'voice-1',
        provider: 'xtts',
      });

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should cache audio chunk with metadata', async () => {
      const audioKey = {
        text: 'test text',
        voiceModelId: 'voice-1',
        provider: 'xtts' as const,
      };
      const audioData = Buffer.from('audio data');

      mockPrisma.audioChunkCache.upsert = jest.fn().mockResolvedValue({});

      await service.set(audioKey, {
        audioData,
        format: 'wav',
        durationMs: 1000,
        sampleRate: 22050,
        channels: 1,
        compression: 'none',
      });

      expect(mockPrisma.audioChunkCache.upsert).toHaveBeenCalledWith({
        where: { cacheKey: expect.any(String) },
        create: expect.objectContaining({
          cacheKey: expect.any(String),
          audioData,
          format: 'wav',
          sampleRate: 22050,
          hitCount: 0,
          expiresAt: expect.any(Date),
        }),
        update: expect.objectContaining({
          audioData,
          format: 'wav',
          sampleRate: 22050,
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockPrisma.audioChunkCache.count = jest.fn().mockResolvedValue(100);
      mockPrisma.audioChunkCache.aggregate = jest.fn().mockResolvedValue({
        _avg: { hitCount: 10.5 },
      });
      mockPrisma.audioChunkCache.findMany = jest.fn().mockResolvedValue([
        {
          audioData: Buffer.alloc(1000),
          metadata: { provider: 'xtts' },
        },
        {
          audioData: Buffer.alloc(2000),
          metadata: { provider: 'google' },
        },
      ]);

      const stats = await service.getStats();

      expect(stats.totalEntries).toBe(100);
      expect(stats.avgHitCount).toBe(10.5);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently accessed entries when max size exceeded', async () => {
      const maxEntries = 100;
      const currentEntries = 150;

      mockPrisma.audioChunkCache.count = jest.fn().mockResolvedValue(currentEntries);
      mockPrisma.audioChunkCache.findMany = jest.fn().mockResolvedValue([
        { id: '1', lastAccessedAt: new Date('2024-01-01') },
        { id: '2', lastAccessedAt: new Date('2024-01-02') },
        { id: '3', lastAccessedAt: new Date('2024-01-03') },
      ]);
      mockPrisma.audioChunkCache.deleteMany = jest.fn().mockResolvedValue({ count: 50 });

      const deletedCount = await service.cleanupLRU(maxEntries);

      expect(deletedCount).toBe(50);
      expect(mockPrisma.audioChunkCache.findMany).toHaveBeenCalledWith({
        orderBy: {
          lastAccessedAt: 'asc',
        },
        take: 50,
        select: {
          id: true,
        },
      });
      expect(mockPrisma.audioChunkCache.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['1', '2', '3'],
          },
        },
      });
    });

    it('should not evict if under max size', async () => {
      const maxEntries = 100;
      const currentEntries = 50;

      mockPrisma.audioChunkCache.count = jest.fn().mockResolvedValue(currentEntries);

      const deletedCount = await service.cleanupLRU(maxEntries);

      expect(deletedCount).toBe(0);
      expect(mockPrisma.audioChunkCache.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should delete expired cache entries', async () => {
      mockPrisma.audioChunkCache.deleteMany = jest.fn().mockResolvedValue({ count: 20 });

      const deletedCount = await service.cleanup();

      expect(deletedCount).toBe(20);
      expect(mockPrisma.audioChunkCache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete cached audio chunk', async () => {
      const audioKey = {
        text: 'test text',
        voiceModelId: 'voice-1',
        provider: 'xtts' as const,
      };

      mockPrisma.audioChunkCache.delete = jest.fn().mockResolvedValue({});

      await service.delete(audioKey);

      expect(mockPrisma.audioChunkCache.delete).toHaveBeenCalled();
    });
  });
});
