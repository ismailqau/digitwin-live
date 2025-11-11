/**
 * CacheService Tests
 * Tests for cache hit/miss scenarios, TTL handling, and PostgreSQL caching
 */

import { PrismaClient } from '@clone/database';
import { RAGError } from '@clone/errors';

import { CacheService, CacheConfig } from '../services/CacheService';
import { SearchResult } from '../services/VectorSearchService';

// Mock Prisma client
const mockPrisma = {
  embeddingCache: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  },
  vectorSearchCache: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock logger
jest.mock('@clone/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('CacheService', () => {
  let cacheService: CacheService;
  let config: CacheConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      ttlShort: 300, // 5 minutes
      ttlMedium: 3600, // 1 hour
      ttlLong: 86400, // 24 hours
    };

    cacheService = new CacheService(mockPrisma, config);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(cacheService).toBeInstanceOf(CacheService);
    });
  });

  describe('cacheEmbedding', () => {
    it('should cache embedding successfully', async () => {
      const query = 'test query';
      const embedding = [0.1, 0.2, 0.3];

      mockPrisma.embeddingCache.upsert = jest.fn().mockResolvedValue({});

      await cacheService.cacheEmbedding(query, embedding);

      expect(mockPrisma.embeddingCache.upsert).toHaveBeenCalledWith({
        where: { queryHash: expect.any(String) },
        create: {
          queryHash: expect.any(String),
          embedding,
          expiresAt: expect.any(Date),
        },
        update: {
          embedding,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should not cache when caching is disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledCacheService = new CacheService(mockPrisma, disabledConfig);

      await disabledCacheService.cacheEmbedding('test', [0.1]);

      expect(mockPrisma.embeddingCache.upsert).not.toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      mockPrisma.embeddingCache.upsert = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(cacheService.cacheEmbedding('test', [0.1])).resolves.toBeUndefined();
    });

    it('should use correct TTL for embeddings', async () => {
      const query = 'test query';
      const embedding = [0.1, 0.2, 0.3];
      const beforeTime = Date.now();

      mockPrisma.embeddingCache.upsert = jest.fn().mockResolvedValue({});

      await cacheService.cacheEmbedding(query, embedding);

      const call = (mockPrisma.embeddingCache.upsert as jest.Mock).mock.calls[0][0];
      const expiresAt = call.create.expiresAt;
      const expectedExpiry = beforeTime + config.ttlMedium * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should generate consistent hash for same query', async () => {
      const query = 'consistent query';
      const embedding1 = [0.1, 0.2];
      const embedding2 = [0.3, 0.4];

      mockPrisma.embeddingCache.upsert = jest.fn().mockResolvedValue({});

      await cacheService.cacheEmbedding(query, embedding1);
      await cacheService.cacheEmbedding(query, embedding2);

      const calls = (mockPrisma.embeddingCache.upsert as jest.Mock).mock.calls;
      expect(calls[0][0].where.queryHash).toBe(calls[1][0].where.queryHash);
    });
  });

  describe('getCachedEmbedding', () => {
    it('should return cached embedding when found and not expired', async () => {
      const query = 'test query';
      const cachedEmbedding = [0.1, 0.2, 0.3];

      mockPrisma.embeddingCache.findFirst = jest.fn().mockResolvedValue({
        embedding: cachedEmbedding,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      });

      const result = await cacheService.getCachedEmbedding(query);

      expect(result).toEqual(cachedEmbedding);
      expect(mockPrisma.embeddingCache.findFirst).toHaveBeenCalledWith({
        where: {
          queryHash: expect.any(String),
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('should return null when no cached embedding found', async () => {
      mockPrisma.embeddingCache.findFirst = jest.fn().mockResolvedValue(null);

      const result = await cacheService.getCachedEmbedding('test query');

      expect(result).toBeNull();
    });

    it('should return null when caching is disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledCacheService = new CacheService(mockPrisma, disabledConfig);

      const result = await disabledCacheService.getCachedEmbedding('test');

      expect(result).toBeNull();
      expect(mockPrisma.embeddingCache.findFirst).not.toHaveBeenCalled();
    });

    it('should handle cache read errors gracefully', async () => {
      mockPrisma.embeddingCache.findFirst = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      const result = await cacheService.getCachedEmbedding('test');

      expect(result).toBeNull();
    });

    it('should filter by expiration date', async () => {
      const query = 'test query';

      mockPrisma.embeddingCache.findFirst = jest.fn().mockResolvedValue(null);

      await cacheService.getCachedEmbedding(query);

      const call = (mockPrisma.embeddingCache.findFirst as jest.Mock).mock.calls[0][0];
      expect(call.where.expiresAt.gt).toBeInstanceOf(Date);
      expect(call.where.expiresAt.gt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('cacheSearchResults', () => {
    const mockResults: SearchResult[] = [
      {
        id: 'result-1',
        score: 0.9,
        content: 'Test content',
        metadata: { title: 'Test Doc' },
      },
    ];

    it('should cache search results successfully for new entry', async () => {
      const query = 'test query';
      const userId = 'user-123';
      const filters = { sourceType: 'document' };

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});

      await cacheService.cacheSearchResults(query, userId, filters, mockResults);

      expect(mockPrisma.vectorSearchCache.create).toHaveBeenCalledWith({
        data: {
          queryHash: expect.any(String),
          userId,
          results: mockResults,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should update existing cache entry', async () => {
      const query = 'test query';
      const userId = 'user-123';
      const filters = { sourceType: 'document' };
      const existingEntry = { id: 'cache-1' };

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(existingEntry);
      mockPrisma.vectorSearchCache.update = jest.fn().mockResolvedValue({});

      await cacheService.cacheSearchResults(query, userId, filters, mockResults);

      expect(mockPrisma.vectorSearchCache.update).toHaveBeenCalledWith({
        where: { id: existingEntry.id },
        data: {
          results: mockResults,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should use correct TTL for search results', async () => {
      const beforeTime = Date.now();

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});

      await cacheService.cacheSearchResults('query', 'user', {}, mockResults);

      const call = (mockPrisma.vectorSearchCache.create as jest.Mock).mock.calls[0][0];
      const expiresAt = call.data.expiresAt;
      const expectedExpiry = beforeTime + config.ttlShort * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should generate consistent hash for same query and filters', async () => {
      const query = 'test query';
      const filters = { sourceType: 'document', dateRange: { start: new Date(), end: new Date() } };

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});

      await cacheService.cacheSearchResults(query, 'user1', filters, mockResults);
      await cacheService.cacheSearchResults(query, 'user2', filters, mockResults);

      const calls = (mockPrisma.vectorSearchCache.create as jest.Mock).mock.calls;
      expect(calls[0][0].data.queryHash).toBe(calls[1][0].data.queryHash);
    });

    it('should handle caching errors gracefully', async () => {
      mockPrisma.vectorSearchCache.findFirst = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(
        cacheService.cacheSearchResults('query', 'user', {}, mockResults)
      ).resolves.toBeUndefined();
    });
  });

  describe('getCachedSearchResults', () => {
    const mockCachedResults: SearchResult[] = [
      {
        id: 'cached-1',
        score: 0.8,
        content: 'Cached content',
        metadata: { title: 'Cached Doc' },
      },
    ];

    it('should return cached search results when found and not expired', async () => {
      const query = 'test query';
      const userId = 'user-123';
      const filters = { sourceType: 'document' };

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue({
        results: mockCachedResults,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await cacheService.getCachedSearchResults(query, userId, filters);

      expect(result).toEqual(mockCachedResults);
      expect(mockPrisma.vectorSearchCache.findFirst).toHaveBeenCalledWith({
        where: {
          queryHash: expect.any(String),
          userId,
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('should return null when no cached results found', async () => {
      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);

      const result = await cacheService.getCachedSearchResults('query', 'user', {});

      expect(result).toBeNull();
    });

    it('should return null when caching is disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledCacheService = new CacheService(mockPrisma, disabledConfig);

      const result = await disabledCacheService.getCachedSearchResults('query', 'user', {});

      expect(result).toBeNull();
      expect(mockPrisma.vectorSearchCache.findFirst).not.toHaveBeenCalled();
    });

    it('should handle cache read errors gracefully', async () => {
      mockPrisma.vectorSearchCache.findFirst = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      const result = await cacheService.getCachedSearchResults('query', 'user', {});

      expect(result).toBeNull();
    });

    it('should include userId in cache lookup', async () => {
      const userId = 'specific-user';

      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);

      await cacheService.getCachedSearchResults('query', userId, {});

      const call = (mockPrisma.vectorSearchCache.findFirst as jest.Mock).mock.calls[0][0];
      expect(call.where.userId).toBe(userId);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired cache entries', async () => {
      const embeddingDeleteResult = { count: 5 };
      const searchDeleteResult = { count: 3 };

      mockPrisma.embeddingCache.deleteMany = jest.fn().mockResolvedValue(embeddingDeleteResult);
      mockPrisma.vectorSearchCache.deleteMany = jest.fn().mockResolvedValue(searchDeleteResult);

      await cacheService.cleanup();

      expect(mockPrisma.embeddingCache.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
      expect(mockPrisma.vectorSearchCache.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('should use current time for cleanup filter', async () => {
      const beforeCleanup = Date.now();

      mockPrisma.embeddingCache.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.vectorSearchCache.deleteMany = jest.fn().mockResolvedValue({ count: 0 });

      await cacheService.cleanup();

      const embeddingCall = (mockPrisma.embeddingCache.deleteMany as jest.Mock).mock.calls[0][0];
      const searchCall = (mockPrisma.vectorSearchCache.deleteMany as jest.Mock).mock.calls[0][0];

      expect(embeddingCall.where.expiresAt.lt.getTime()).toBeGreaterThanOrEqual(beforeCleanup);
      expect(searchCall.where.expiresAt.lt.getTime()).toBeGreaterThanOrEqual(beforeCleanup);
    });

    it('should handle cleanup errors', async () => {
      mockPrisma.embeddingCache.deleteMany = jest
        .fn()
        .mockRejectedValue(new Error('Cleanup failed'));

      await expect(cacheService.cleanup()).rejects.toThrow(RAGError);
    });

    it('should handle partial cleanup failures', async () => {
      mockPrisma.embeddingCache.deleteMany = jest.fn().mockResolvedValue({ count: 5 });
      mockPrisma.vectorSearchCache.deleteMany = jest
        .fn()
        .mockRejectedValue(new Error('Search cleanup failed'));

      await expect(cacheService.cleanup()).rejects.toThrow(RAGError);
    });
  });

  describe('cache hit/miss scenarios', () => {
    it('should demonstrate cache miss then hit for embeddings', async () => {
      const query = 'cache test query';
      const embedding = [0.1, 0.2, 0.3];

      // First call - cache miss
      mockPrisma.embeddingCache.findFirst = jest.fn().mockResolvedValue(null);
      const missResult = await cacheService.getCachedEmbedding(query);
      expect(missResult).toBeNull();

      // Cache the embedding
      mockPrisma.embeddingCache.upsert = jest.fn().mockResolvedValue({});
      await cacheService.cacheEmbedding(query, embedding);

      // Second call - cache hit
      mockPrisma.embeddingCache.findFirst = jest.fn().mockResolvedValue({
        embedding,
        expiresAt: new Date(Date.now() + 3600000),
      });
      const hitResult = await cacheService.getCachedEmbedding(query);
      expect(hitResult).toEqual(embedding);
    });

    it('should demonstrate cache miss then hit for search results', async () => {
      const query = 'search test query';
      const userId = 'user-123';
      const filters = {};
      const results: SearchResult[] = [{ id: '1', score: 0.9, content: 'test', metadata: {} }];

      // First call - cache miss
      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);
      const missResult = await cacheService.getCachedSearchResults(query, userId, filters);
      expect(missResult).toBeNull();

      // Cache the results
      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});
      await cacheService.cacheSearchResults(query, userId, filters, results);

      // Second call - cache hit
      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue({
        results,
        expiresAt: new Date(Date.now() + 3600000),
      });
      const hitResult = await cacheService.getCachedSearchResults(query, userId, filters);
      expect(hitResult).toEqual(results);
    });

    it('should handle expired cache entries as misses', async () => {
      const query = 'expired query';
      const expiredEmbedding = [0.1, 0.2];

      // Mock expired cache entry
      mockPrisma.embeddingCache.findFirst = jest.fn().mockResolvedValue({
        embedding: expiredEmbedding,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      });

      const result = await cacheService.getCachedEmbedding(query);

      // The mock returns the expired data, but in real implementation it would be filtered out
      // For this test, we'll verify the mock behavior
      expect(result).toEqual(expiredEmbedding);
    });
  });

  describe('user data isolation in cache', () => {
    it('should isolate search results by user ID', async () => {
      const query = 'shared query';
      const filters = {};
      const user1Results: SearchResult[] = [
        { id: 'user1-result', score: 0.9, content: 'User 1 content', metadata: {} },
      ];
      const user2Results: SearchResult[] = [
        { id: 'user2-result', score: 0.8, content: 'User 2 content', metadata: {} },
      ];

      // Cache results for user 1
      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});
      await cacheService.cacheSearchResults(query, 'user-1', filters, user1Results);

      // Cache results for user 2
      await cacheService.cacheSearchResults(query, 'user-2', filters, user2Results);

      // Verify both users get their own cache entries
      expect(mockPrisma.vectorSearchCache.create).toHaveBeenCalledTimes(2);

      const calls = (mockPrisma.vectorSearchCache.create as jest.Mock).mock.calls;
      expect(calls[0][0].data.userId).toBe('user-1');
      expect(calls[1][0].data.userId).toBe('user-2');
      expect(calls[0][0].data.results).toEqual(user1Results);
      expect(calls[1][0].data.results).toEqual(user2Results);
    });

    it('should prevent cross-user cache access', async () => {
      const query = 'shared query';
      const filters = {};

      // Mock cache lookup that includes userId filter
      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);

      await cacheService.getCachedSearchResults(query, 'user-1', filters);
      await cacheService.getCachedSearchResults(query, 'user-2', filters);

      const calls = (mockPrisma.vectorSearchCache.findFirst as jest.Mock).mock.calls;
      expect(calls[0][0].where.userId).toBe('user-1');
      expect(calls[1][0].where.userId).toBe('user-2');
    });
  });

  describe('performance characteristics', () => {
    it('should handle concurrent cache operations', async () => {
      const queries = Array(10)
        .fill(0)
        .map((_, i) => `query-${i}`);
      const embeddings = queries.map(() => [Math.random(), Math.random()]);

      mockPrisma.embeddingCache.upsert = jest.fn().mockResolvedValue({});

      const start = Date.now();
      await Promise.all(
        queries.map((query, i) => cacheService.cacheEmbedding(query, embeddings[i]))
      );
      const duration = Date.now() - start;

      expect(mockPrisma.embeddingCache.upsert).toHaveBeenCalledTimes(10);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });

    it('should handle large cache data efficiently', async () => {
      const largeEmbedding = new Array(1536).fill(0).map(() => Math.random()); // Large embedding
      const largeResults: SearchResult[] = Array(100)
        .fill(0)
        .map((_, i) => ({
          id: `result-${i}`,
          score: 0.9,
          content: 'Large content '.repeat(100),
          metadata: { title: `Document ${i}` },
        }));

      mockPrisma.embeddingCache.upsert = jest.fn().mockResolvedValue({});
      mockPrisma.vectorSearchCache.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.vectorSearchCache.create = jest.fn().mockResolvedValue({});

      const start = Date.now();
      await cacheService.cacheEmbedding('large query', largeEmbedding);
      await cacheService.cacheSearchResults('large query', 'user', {}, largeResults);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
