/**
 * Tests for CacheManager
 */

import { PrismaClient } from '@clone/database';

import { CacheManager } from '../cache-manager';
import { CacheType } from '../types';

// Mock config to enable caching for tests
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

// Mock Prisma client with all required methods
const mockPrisma = {
  embeddingCache: {
    count: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  vectorSearchCache: {
    count: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  lLMResponseCache: {
    count: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  audioChunkCache: {
    count: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient;

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = new CacheManager(mockPrisma);
  });

  describe('cleanupAll', () => {
    it('should clean up all cache types', async () => {
      // Mock cleanup results
      mockPrisma.embeddingCache.deleteMany = jest.fn().mockResolvedValue({ count: 10 });
      mockPrisma.vectorSearchCache.deleteMany = jest.fn().mockResolvedValue({ count: 5 });
      mockPrisma.lLMResponseCache.deleteMany = jest.fn().mockResolvedValue({ count: 8 });
      mockPrisma.audioChunkCache.deleteMany = jest.fn().mockResolvedValue({ count: 12 });

      const results = await cacheManager.cleanupAll();

      expect(results).toHaveLength(4);
      expect(results).toEqual([
        { cacheType: CacheType.EMBEDDING, deletedCount: 10 },
        { cacheType: CacheType.VECTOR_SEARCH, deletedCount: 5 },
        { cacheType: CacheType.LLM_RESPONSE, deletedCount: 8 },
        { cacheType: CacheType.AUDIO_CHUNK, deletedCount: 12 },
      ]);

      const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
      expect(totalDeleted).toBe(35);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock one service to fail - it should log error but not throw
      mockPrisma.embeddingCache.deleteMany = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      // Other services return normal counts
      mockPrisma.vectorSearchCache.deleteMany = jest.fn().mockResolvedValue({ count: 5 });
      mockPrisma.lLMResponseCache.deleteMany = jest.fn().mockResolvedValue({ count: 8 });
      mockPrisma.audioChunkCache.deleteMany = jest.fn().mockResolvedValue({ count: 12 });

      // Should not throw, but should return 0 for the failed service
      const results = await cacheManager.cleanupAll();

      expect(results).toHaveLength(4);
      expect(results[0].deletedCount).toBe(0); // embedding failed, returns 0
      expect(results[1].deletedCount).toBe(5); // vector search succeeded
      expect(results[2].deletedCount).toBe(8); // llm response succeeded
      expect(results[3].deletedCount).toBe(12); // audio chunk succeeded
    });
  });

  describe('cleanupCacheType', () => {
    it('should clean up specific cache type', async () => {
      mockPrisma.embeddingCache.deleteMany = jest.fn().mockResolvedValue({ count: 15 });

      const deletedCount = await cacheManager.cleanupCacheType(CacheType.EMBEDDING);

      expect(deletedCount).toBe(15);
      expect(mockPrisma.embeddingCache.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('should clean up vector search cache', async () => {
      mockPrisma.vectorSearchCache.deleteMany = jest.fn().mockResolvedValue({ count: 7 });

      const deletedCount = await cacheManager.cleanupCacheType(CacheType.VECTOR_SEARCH);

      expect(deletedCount).toBe(7);
      expect(mockPrisma.vectorSearchCache.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('should clean up LLM response cache', async () => {
      mockPrisma.lLMResponseCache.deleteMany = jest.fn().mockResolvedValue({ count: 20 });

      const deletedCount = await cacheManager.cleanupCacheType(CacheType.LLM_RESPONSE);

      expect(deletedCount).toBe(20);
      expect(mockPrisma.lLMResponseCache.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('should clean up audio chunk cache', async () => {
      mockPrisma.audioChunkCache.deleteMany = jest.fn().mockResolvedValue({ count: 30 });

      const deletedCount = await cacheManager.cleanupCacheType(CacheType.AUDIO_CHUNK);

      expect(deletedCount).toBe(30);
      expect(mockPrisma.audioChunkCache.deleteMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return statistics for all cache types', async () => {
      mockPrisma.embeddingCache.count = jest.fn().mockResolvedValue(100);
      mockPrisma.vectorSearchCache.count = jest.fn().mockResolvedValue(50);
      mockPrisma.lLMResponseCache.count = jest.fn().mockResolvedValue(75);
      mockPrisma.audioChunkCache.count = jest.fn().mockResolvedValue(200);
      mockPrisma.audioChunkCache.aggregate = jest.fn().mockResolvedValue({
        _avg: { hitCount: 5.5 },
      });
      mockPrisma.audioChunkCache.findMany = jest
        .fn()
        .mockResolvedValue([{ audioData: Buffer.alloc(1000) }, { audioData: Buffer.alloc(2000) }]);

      const stats = await cacheManager.getStats();

      expect(stats.embedding.totalEntries).toBe(100);
      expect(stats.vectorSearch.totalEntries).toBe(50);
      expect(stats.llmResponse.totalEntries).toBe(75);
      expect(stats.audioChunk.totalEntries).toBe(200);
      expect(stats.audioChunk.avgHitCount).toBe(5.5);
    });
  });

  describe('warmup', () => {
    it('should warm up cache with embeddings', async () => {
      const embeddingsSpy = jest.spyOn(cacheManager.embedding, 'set').mockResolvedValue();

      await cacheManager.warmup({
        embeddings: [
          { queryText: 'query1', embedding: [0.1, 0.2] },
          { queryText: 'query2', embedding: [0.3, 0.4] },
        ],
      });

      expect(embeddingsSpy).toHaveBeenCalledTimes(2);
      expect(embeddingsSpy).toHaveBeenCalledWith('query1', { embedding: [0.1, 0.2] });
      expect(embeddingsSpy).toHaveBeenCalledWith('query2', { embedding: [0.3, 0.4] });
    });

    it('should warm up cache with LLM responses', async () => {
      const llmSpy = jest.spyOn(cacheManager.llmResponse, 'set').mockResolvedValue();

      await cacheManager.warmup({
        llmResponses: [
          {
            prompt: 'question1',
            context: 'context1',
            provider: 'gemini',
            response: 'answer1',
          },
          {
            prompt: 'question2',
            provider: 'openai',
            response: 'answer2',
          },
        ],
      });

      expect(llmSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateUser', () => {
    it('should invalidate all cache entries for a user', async () => {
      const userId = 'user-123';
      mockPrisma.vectorSearchCache.deleteMany = jest.fn().mockResolvedValue({ count: 10 });

      await cacheManager.invalidateUser(userId);

      expect(mockPrisma.vectorSearchCache.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });
});
