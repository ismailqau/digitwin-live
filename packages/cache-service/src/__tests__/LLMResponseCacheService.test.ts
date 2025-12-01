/**
 * Tests for LLMResponseCacheService
 */

import { PrismaClient } from '@clone/database';

import { LLMResponseCacheService } from '../llm-response-cache.service';

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
  lLMResponseCache: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('LLMResponseCacheService', () => {
  let service: LLMResponseCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LLMResponseCacheService(mockPrisma);
  });

  describe('get with hit count tracking', () => {
    it('should return cached response and increment hit count', async () => {
      const prompt = 'test prompt';
      const context = 'test context';
      const provider = 'gemini';
      const response = 'test response';
      const futureDate = new Date(Date.now() + 10000);

      mockPrisma.lLMResponseCache.findFirst = jest.fn().mockResolvedValue({
        id: 'cache-1',
        promptHash: 'test-key',
        response,
        provider,
        hitCount: 5,
        expiresAt: futureDate,
        createdAt: new Date(),
      });

      mockPrisma.lLMResponseCache.update = jest.fn().mockResolvedValue({});

      const result = await service.get({ prompt, context, provider });

      expect(result).toEqual({ response, provider });
      expect(mockPrisma.lLMResponseCache.update).toHaveBeenCalledWith({
        where: { id: 'cache-1' },
        data: {
          hitCount: { increment: 1 },
        },
      });
    });

    it('should return null if cache entry does not exist', async () => {
      mockPrisma.lLMResponseCache.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.get({
        prompt: 'non-existent',
        provider: 'gemini',
      });

      expect(result).toBeNull();
      expect(mockPrisma.lLMResponseCache.update).not.toHaveBeenCalled();
    });

    it('should return null if cache expired', async () => {
      const pastDate = new Date(Date.now() - 10000);

      mockPrisma.lLMResponseCache.findFirst = jest.fn().mockResolvedValue({
        id: 'cache-1',
        cacheKey: 'test-key',
        cacheValue: { response: 'test' },
        hitCount: 5,
        expiresAt: pastDate,
      });

      const result = await service.get({
        prompt: 'test',
        provider: 'gemini',
      });

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should cache LLM response with initial hit count of 0', async () => {
      const prompt = 'test prompt';
      const context = 'test context';
      const provider = 'gemini';
      const response = 'test response';

      mockPrisma.lLMResponseCache.create = jest.fn().mockResolvedValue({});

      await service.set({ prompt, context, provider }, { response, provider });

      expect(mockPrisma.lLMResponseCache.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          promptHash: expect.any(String),
          response,
          provider,
          hitCount: 0,
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should cache response without context', async () => {
      const prompt = 'test prompt';
      const provider = 'openai';
      const response = 'test response';

      mockPrisma.lLMResponseCache.create = jest.fn().mockResolvedValue({});

      await service.set({ prompt, provider }, { response, provider });

      expect(mockPrisma.lLMResponseCache.create).toHaveBeenCalled();
    });
  });

  describe('getTopCachedResponses', () => {
    it('should return top cached responses by hit count', async () => {
      const topResponses = [
        {
          cacheKey: 'key1',
          cacheValue: { response: 'response1' },
          hitCount: 100,
          metadata: { prompt: 'prompt1', provider: 'gemini' },
        },
        {
          cacheKey: 'key2',
          cacheValue: { response: 'response2' },
          hitCount: 50,
          metadata: { prompt: 'prompt2', provider: 'openai' },
        },
      ];

      mockPrisma.lLMResponseCache.findMany = jest.fn().mockResolvedValue(topResponses);

      const result = await service.getTopCachedResponses(10);

      expect(result).toEqual(topResponses);
      expect(mockPrisma.lLMResponseCache.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: {
          hitCount: 'desc',
        },
        take: 10,
        select: {
          promptHash: true,
          hitCount: true,
          provider: true,
        },
      });
    });

    it('should return empty array if no cached responses', async () => {
      mockPrisma.lLMResponseCache.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getTopCachedResponses(10);

      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete cached response', async () => {
      const prompt = 'test prompt';
      const provider = 'gemini';

      mockPrisma.lLMResponseCache.deleteMany = jest.fn().mockResolvedValue({ count: 1 });

      await service.delete({ prompt, provider });

      expect(mockPrisma.lLMResponseCache.deleteMany).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should delete expired cache entries', async () => {
      mockPrisma.lLMResponseCache.deleteMany = jest.fn().mockResolvedValue({ count: 15 });

      const deletedCount = await service.cleanup();

      expect(deletedCount).toBe(15);
      expect(mockPrisma.lLMResponseCache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('hit count tracking', () => {
    it('should track multiple cache hits', async () => {
      const key = { prompt: 'test', provider: 'gemini' };
      const futureDate = new Date(Date.now() + 10000);

      // First hit
      mockPrisma.lLMResponseCache.findFirst = jest.fn().mockResolvedValue({
        id: 'cache-1',
        promptHash: 'test-key',
        response: 'test',
        provider: 'gemini',
        hitCount: 0,
        expiresAt: futureDate,
        createdAt: new Date(),
      });
      mockPrisma.lLMResponseCache.update = jest.fn().mockResolvedValue({});

      await service.get(key);
      expect(mockPrisma.lLMResponseCache.update).toHaveBeenCalledWith({
        where: { id: 'cache-1' },
        data: {
          hitCount: { increment: 1 },
        },
      });

      // Second hit
      mockPrisma.lLMResponseCache.findFirst = jest.fn().mockResolvedValue({
        id: 'cache-1',
        promptHash: 'test-key',
        response: 'test',
        provider: 'gemini',
        hitCount: 1,
        expiresAt: futureDate,
        createdAt: new Date(),
      });

      await service.get(key);
      expect(mockPrisma.lLMResponseCache.update).toHaveBeenCalledTimes(2);
    });
  });
});
