import { PrismaClient } from '@prisma/client';

/**
 * Rate Limit Repository
 * Handles rate limiting using PostgreSQL with token bucket algorithm
 */
export class RateLimitRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check and increment rate limit
   * Returns true if request is allowed, false if rate limit exceeded
   */
  async checkAndIncrement(
    userId: string,
    endpoint: string,
    limit: number,
    windowSeconds = 60
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const windowStart = this.getWindowStart(windowSeconds);

    // Try to find existing rate limit record
    const existing = await this.prisma.rateLimit.findUnique({
      where: {
        userId_endpoint_windowStart: {
          userId,
          endpoint,
          windowStart,
        },
      },
    });

    if (!existing) {
      // Create new rate limit record
      await this.prisma.rateLimit.create({
        data: {
          userId,
          endpoint,
          windowStart,
          requestCount: 1,
        },
      });

      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: new Date(windowStart.getTime() + windowSeconds * 1000),
      };
    }

    // Check if limit exceeded
    if (existing.requestCount >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(windowStart.getTime() + windowSeconds * 1000),
      };
    }

    // Increment request count
    const updated = await this.prisma.rateLimit.update({
      where: {
        id: existing.id,
      },
      data: {
        requestCount: {
          increment: 1,
        },
      },
    });

    return {
      allowed: true,
      remaining: limit - updated.requestCount,
      resetAt: new Date(windowStart.getTime() + windowSeconds * 1000),
    };
  }

  /**
   * Get current rate limit status
   */
  async getStatus(
    userId: string,
    endpoint: string,
    limit: number,
    windowSeconds = 60
  ): Promise<{ requestCount: number; remaining: number; resetAt: Date }> {
    const windowStart = this.getWindowStart(windowSeconds);

    const existing = await this.prisma.rateLimit.findUnique({
      where: {
        userId_endpoint_windowStart: {
          userId,
          endpoint,
          windowStart,
        },
      },
    });

    const requestCount = existing?.requestCount || 0;
    const remaining = Math.max(0, limit - requestCount);
    const resetAt = new Date(windowStart.getTime() + windowSeconds * 1000);

    return {
      requestCount,
      remaining,
      resetAt,
    };
  }

  /**
   * Reset rate limit for a user and endpoint
   */
  async reset(userId: string, endpoint: string): Promise<void> {
    await this.prisma.rateLimit.deleteMany({
      where: {
        userId,
        endpoint,
      },
    });
  }

  /**
   * Clean old rate limit records
   */
  async cleanOldRecords(olderThanHours = 24): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const result = await this.prisma.rateLimit.deleteMany({
      where: {
        windowStart: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get rate limit statistics for a user
   */
  async getUserStatistics(
    userId: string,
    hoursBack = 24
  ): Promise<{
    totalRequests: number;
    requestsByEndpoint: Record<string, number>;
  }> {
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const records = await this.prisma.rateLimit.findMany({
      where: {
        userId,
        windowStart: {
          gte: cutoffDate,
        },
      },
    });

    const totalRequests = records.reduce((sum, r) => sum + r.requestCount, 0);

    const requestsByEndpoint = records.reduce((acc, r) => {
      acc[r.endpoint] = (acc[r.endpoint] || 0) + r.requestCount;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests,
      requestsByEndpoint,
    };
  }

  /**
   * Get window start time for rate limiting
   */
  private getWindowStart(windowSeconds: number): Date {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    return new Date(windowStart);
  }
}
