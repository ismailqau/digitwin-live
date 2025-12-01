/**
 * Tests for EmbeddingCacheService
 */

import { PrismaClient } from '@clone/database';

import { EmbeddingCacheService } from '../embedding-cache.service';

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

const mockPrisma = {
  embeddingCache: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('EmbeddingCacheService', () => {
  let service: EmbeddingCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmbeddingCacheService(mockPrisma);
  });

  describe('get', () => {
    it('should return cached embedding if exists and not expired', async () => {
      const queryText = 'test query';
      const embedding = [0.1, 0.2, 0.3];
      const futureDate = new Date(Date.now() + 10000);

      mockPrisma.embeddingCache.findUnique = jest.fn().mockResolvedValue({
        queryHash: 'test-key',
        embedding,
        expiresAt: futureDate,
      });

      const result = await service.get(queryText);

      expect(result).toEqual({ embedding });
      expect(mockPrisma.embeddingCache.findUnique).toHaveBeenCalledWith({
        where: { queryHash: expect.any(String) },
      });
    });

    it('should return null if cache entry expired', async () => {
      const queryText = 'test query';
      const pastDate = new Date(Date.now() - 10000);

      mockPrisma.embeddingCache.findUnique = jest.fn().mockResolvedValue({
        cacheKey: 'test-key',
        cacheValue: { embedding: [0.1, 0.2] },
        expiresAt: pastDate,
      });

      const result = await service.get(queryText);

      expect(result).toBeNull();
    });

    it('should return null if cache entry does not exist', async () => {
      mockPrisma.embeddingCache.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.get('non-existent query');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should cache embedding with default TTL', async () => {
      const queryText = 'test query';
      const embedding = [0.1, 0.2, 0.3];

      mockPrisma.embeddingCache.upsert = jest.fn().mockResolvedValue({});

      await service.set(queryText, { embedding });

      expect(mockPrisma.embeddingCache.upsert).toHaveBeenCalledWith({
        where: { queryHash: expect.any(String) },
        create: expect.objectContaining({
          queryHash: expect.any(String),
          embedding,
          expiresAt: expect.any(Date),
        }),
        update: expect.objectContaining({
          embedding,
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should cache embedding with custom TTL', async () => {
      const queryText = 'test query';
      const embedding = [0.1, 0.2, 0.3];
      const customTTL = 7200; // 2 hours

      mockPrisma.embeddingCache.upsert = jest.fn().mockResolvedValue({});

      await service.set(queryText, { embedding }, { ttl: customTTL });

      expect(mockPrisma.embeddingCache.upsert).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete cached embedding', async () => {
      const queryText = 'test query';

      mockPrisma.embeddingCache.delete = jest.fn().mockResolvedValue({});

      await service.delete(queryText);

      expect(mockPrisma.embeddingCache.delete).toHaveBeenCalledWith({
        where: { queryHash: expect.any(String) },
      });
    });

    it('should handle deletion of non-existent entry', async () => {
      mockPrisma.embeddingCache.delete = jest.fn().mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should delete expired cache entries', async () => {
      mockPrisma.embeddingCache.deleteMany = jest.fn().mockResolvedValue({ count: 5 });

      const deletedCount = await service.cleanup();

      expect(deletedCount).toBe(5);
      expect(mockPrisma.embeddingCache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should return 0 if no expired entries', async () => {
      mockPrisma.embeddingCache.deleteMany = jest.fn().mockResolvedValue({ count: 0 });

      const deletedCount = await service.cleanup();

      expect(deletedCount).toBe(0);
    });
  });
});
