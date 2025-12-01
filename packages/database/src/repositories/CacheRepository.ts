import {
  PrismaClient,
  EmbeddingCache,
  VectorSearchCache,
  LLMResponseCache,
  Prisma,
} from '@prisma/client';

/**
 * Cache Repository
 * Handles all caching operations using PostgreSQL as L2 cache
 */
export class CacheRepository {
  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // Embedding Cache
  // ============================================================================

  async getEmbedding(queryHash: string): Promise<number[] | null> {
    const cached = await this.prisma.embeddingCache.findUnique({
      where: { queryHash },
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      await this.prisma.embeddingCache.delete({
        where: { queryHash },
      });
      return null;
    }

    return cached.embedding;
  }

  async setEmbedding(
    queryHash: string,
    embedding: number[],
    ttlSeconds = 3600
  ): Promise<EmbeddingCache> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    return this.prisma.embeddingCache.upsert({
      where: { queryHash },
      create: {
        queryHash,
        embedding,
        expiresAt,
      },
      update: {
        embedding,
        expiresAt,
      },
    });
  }

  async deleteEmbedding(queryHash: string): Promise<void> {
    await this.prisma.embeddingCache.delete({
      where: { queryHash },
    });
  }

  async cleanExpiredEmbeddings(): Promise<number> {
    const result = await this.prisma.embeddingCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  // ============================================================================
  // Vector Search Cache
  // ============================================================================

  async getVectorSearchResults(
    queryHash: string,
    userId: string
  ): Promise<Prisma.JsonValue | null> {
    const cached = await this.prisma.vectorSearchCache.findFirst({
      where: {
        queryHash,
        userId,
      },
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      await this.prisma.vectorSearchCache.delete({
        where: { id: cached.id },
      });
      return null;
    }

    return cached.results;
  }

  async setVectorSearchResults(
    queryHash: string,
    userId: string,
    results: Prisma.JsonValue,
    ttlSeconds = 1800
  ): Promise<VectorSearchCache> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Delete existing cache for this query/user
    await this.prisma.vectorSearchCache.deleteMany({
      where: {
        queryHash,
        userId,
      },
    });

    return this.prisma.vectorSearchCache.create({
      data: {
        queryHash,
        userId,
        results: results as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  }

  async deleteVectorSearchCache(userId: string): Promise<number> {
    const result = await this.prisma.vectorSearchCache.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  async cleanExpiredVectorSearchCache(): Promise<number> {
    const result = await this.prisma.vectorSearchCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  // ============================================================================
  // LLM Response Cache
  // ============================================================================

  async getLLMResponse(promptHash: string): Promise<string | null> {
    const cached = await this.prisma.lLMResponseCache.findFirst({
      where: { promptHash },
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      await this.prisma.lLMResponseCache.delete({
        where: { id: cached.id },
      });
      return null;
    }

    // Increment hit count
    await this.prisma.lLMResponseCache.update({
      where: { id: cached.id },
      data: {
        hitCount: {
          increment: 1,
        },
      },
    });

    return cached.response;
  }

  async setLLMResponse(
    promptHash: string,
    response: string,
    provider: string,
    ttlSeconds = 3600
  ): Promise<LLMResponseCache> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Check if already exists
    const existing = await this.prisma.lLMResponseCache.findFirst({
      where: { promptHash },
    });

    if (existing) {
      return this.prisma.lLMResponseCache.update({
        where: { id: existing.id },
        data: {
          response,
          provider,
          expiresAt,
        },
      });
    }

    return this.prisma.lLMResponseCache.create({
      data: {
        promptHash,
        response,
        provider,
        expiresAt,
      },
    });
  }

  async deleteLLMResponseCache(promptHash: string): Promise<void> {
    await this.prisma.lLMResponseCache.deleteMany({
      where: { promptHash },
    });
  }

  async cleanExpiredLLMResponseCache(): Promise<number> {
    const result = await this.prisma.lLMResponseCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  async getCacheStatistics(): Promise<{
    embeddingCacheSize: number;
    vectorSearchCacheSize: number;
    llmResponseCacheSize: number;
    llmCacheHitRate: number;
  }> {
    const [embeddingCount, vectorSearchCount, llmResponses] = await Promise.all([
      this.prisma.embeddingCache.count(),
      this.prisma.vectorSearchCache.count(),
      this.prisma.lLMResponseCache.findMany({
        select: {
          hitCount: true,
        },
      }),
    ]);

    const totalHits = llmResponses.reduce((sum: number, r) => sum + r.hitCount, 0);
    const llmCacheHitRate = llmResponses.length > 0 ? totalHits / llmResponses.length : 0;

    return {
      embeddingCacheSize: embeddingCount,
      vectorSearchCacheSize: vectorSearchCount,
      llmResponseCacheSize: llmResponses.length,
      llmCacheHitRate,
    };
  }

  /**
   * Clean all expired cache entries
   */
  async cleanAllExpiredCache(): Promise<{
    embeddingsDeleted: number;
    vectorSearchDeleted: number;
    llmResponsesDeleted: number;
  }> {
    const [embeddingsDeleted, vectorSearchDeleted, llmResponsesDeleted] = await Promise.all([
      this.cleanExpiredEmbeddings(),
      this.cleanExpiredVectorSearchCache(),
      this.cleanExpiredLLMResponseCache(),
    ]);

    return {
      embeddingsDeleted,
      vectorSearchDeleted,
      llmResponsesDeleted,
    };
  }
}
