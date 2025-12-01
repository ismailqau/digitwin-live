/**
 * Tests for VectorSearchCacheService
 */

import { PrismaClient } from '@clone/database';

import { VectorSearchCacheService } from '../vector-search-cache.service';

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
  vectorSearchCache: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('VectorSearchCacheService', () => {
  let service: VectorSearchCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VectorSearchCacheService(mockPrisma);
  });

  describe('get with user isolation', () => {
    it('should return cached results for specific user', async () => {
      const userId = 'user-123';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const results = [
        { id: '1', score: 0.9, content: 'result 1', metadata: {} },
        { id: '2', score: 0.8, content: 'result 2', metadata: {} },
      ];
      const futureDate = new Date(Date.now() + 10000);

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue({
        id: 'cache-id',
        queryHash: 'test-key',
        userId,
        results,
        expiresAt: futureDate,
      });

      const result = await service.get({ userId, embedding, topK: 5 });

      expect(result).toEqual({ results });
      expect(mockPrisma.vectorSearchCache.findFirst).toHaveBeenCalledWith({
        where: {
          queryHash: expect.any(String),
          userId,
        },
      });
    });

    it('should not return results for different user', async () => {
      const userId = 'user-123';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.get({ userId, embedding, topK: 5 });

      expect(result).toBeNull();
    });

    it('should return null if cache expired', async () => {
      const userId = 'user-123';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const pastDate = new Date(Date.now() - 10000);

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue({
        id: 'cache-id',
        queryHash: 'test-key',
        userId,
        results: [],
        expiresAt: pastDate,
      });

      mockPrisma.vectorSearchCache.delete = jest.fn().mockResolvedValue({});

      const result = await service.get({ userId, embedding, topK: 5 });

      expect(result).toBeNull();
    });
  });

  describe('set with user isolation', () => {
    it('should cache results with userId', async () => {
      const userId = 'user-123';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const results = [{ id: '1', score: 0.9, content: 'result 1', metadata: {} }];

      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});

      await service.set({ userId, embedding, topK: 5 }, { results });

      expect(mockPrisma.vectorSearchCache.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          queryHash: expect.any(String),
          userId,
          results,
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should use custom TTL when provided', async () => {
      const userId = 'user-123';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const results = [{ id: '1', score: 0.9, content: 'result 1', metadata: {} }];
      const customTTL = 600;

      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});

      await service.set({ userId, embedding, topK: 5 }, { results }, { ttl: customTTL });

      expect(mockPrisma.vectorSearchCache.create).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete cached search results', async () => {
      const userId = 'user-123';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      mockPrisma.vectorSearchCache.deleteMany = jest.fn().mockResolvedValue({ count: 1 });

      await service.delete({ userId, embedding, topK: 5 });

      expect(mockPrisma.vectorSearchCache.deleteMany).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should delete expired cache entries', async () => {
      mockPrisma.vectorSearchCache.deleteMany = jest.fn().mockResolvedValue({ count: 10 });

      const deletedCount = await service.cleanup();

      expect(deletedCount).toBe(10);
      expect(mockPrisma.vectorSearchCache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('user data isolation', () => {
    it('should only access data for specified user', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      // User 1 caches results
      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});
      await service.set(
        { userId: user1, embedding, topK: 5 },
        { results: [{ id: '1', score: 0.9, content: 'test', metadata: {} }] }
      );

      // User 2 tries to get results - should not find user 1's cache
      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);
      const result = await service.get({ userId: user2, embedding, topK: 5 });

      expect(result).toBeNull();
      expect(mockPrisma.vectorSearchCache.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: user2,
        }),
      });
    });
  });
});
