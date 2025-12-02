import { PrismaClient } from '@prisma/client';

export interface RateLimitConfig {
  free: {
    conversationMinutesPerDay: number;
    apiRequestsPerHour: number;
    uploadRequestsPerMinute: number;
    batchUploadRequestsPerMinute: number;
    searchRequestsPerMinute: number;
  };
  pro: {
    conversationMinutesPerDay: number;
    apiRequestsPerHour: number;
    uploadRequestsPerMinute: number;
    batchUploadRequestsPerMinute: number;
    searchRequestsPerMinute: number;
  };
  enterprise: {
    conversationMinutesPerDay: number;
    apiRequestsPerHour: number;
    uploadRequestsPerMinute: number;
    batchUploadRequestsPerMinute: number;
    searchRequestsPerMinute: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until retry is allowed
}

export class RateLimitService {
  private prisma: PrismaClient;
  private config: RateLimitConfig;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.config = {
      free: {
        conversationMinutesPerDay: 60,
        apiRequestsPerHour: 100,
        uploadRequestsPerMinute: 10,
        batchUploadRequestsPerMinute: 2,
        searchRequestsPerMinute: 30,
      },
      pro: {
        conversationMinutesPerDay: Number.MAX_SAFE_INTEGER, // Unlimited
        apiRequestsPerHour: 1000,
        uploadRequestsPerMinute: 50,
        batchUploadRequestsPerMinute: 10,
        searchRequestsPerMinute: 100,
      },
      enterprise: {
        conversationMinutesPerDay: Number.MAX_SAFE_INTEGER, // Unlimited
        apiRequestsPerHour: Number.MAX_SAFE_INTEGER, // Unlimited
        uploadRequestsPerMinute: Number.MAX_SAFE_INTEGER, // Unlimited
        batchUploadRequestsPerMinute: Number.MAX_SAFE_INTEGER, // Unlimited
        searchRequestsPerMinute: Number.MAX_SAFE_INTEGER, // Unlimited
      },
    };
  }

  /**
   * Check if a user has exceeded their rate limit for a specific endpoint
   * Uses sliding window algorithm with PostgreSQL
   */
  async checkRateLimit(
    userId: string,
    endpoint: string,
    subscriptionTier: 'free' | 'pro' | 'enterprise'
  ): Promise<RateLimitResult> {
    const tierConfig = this.config[subscriptionTier];
    const limit = this.getEndpointLimit(endpoint, tierConfig);

    if (limit === Number.MAX_SAFE_INTEGER) {
      // Unlimited tier
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(Date.now() + 3600000), // 1 hour from now
      };
    }

    const windowMs = this.getWindowMs(endpoint);
    const windowStart = new Date(Date.now() - windowMs);

    // Get or create rate limit record using sliding window
    const rateLimitRecord = await this.prisma.rateLimit.findFirst({
      where: {
        userId,
        endpoint,
        windowStart: {
          gte: windowStart,
        },
      },
      orderBy: {
        windowStart: 'desc',
      },
    });

    if (!rateLimitRecord) {
      // First request in this window
      await this.prisma.rateLimit.create({
        data: {
          userId,
          endpoint,
          windowStart: new Date(),
          requestCount: 1,
        },
      });

      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: new Date(Date.now() + windowMs),
      };
    }

    // Check if we've exceeded the limit
    if (rateLimitRecord.requestCount >= limit) {
      const resetAt = new Date(rateLimitRecord.windowStart.getTime() + windowMs);
      const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Increment the request count
    await this.prisma.rateLimit.update({
      where: {
        id: rateLimitRecord.id,
      },
      data: {
        requestCount: rateLimitRecord.requestCount + 1,
        updatedAt: new Date(),
      },
    });

    const remaining = limit - (rateLimitRecord.requestCount + 1);
    const resetAt = new Date(rateLimitRecord.windowStart.getTime() + windowMs);

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Check conversation time limit for the day
   */
  async checkConversationTimeLimit(
    userId: string,
    subscriptionTier: 'free' | 'pro' | 'enterprise',
    additionalMinutes: number
  ): Promise<RateLimitResult> {
    const tierConfig = this.config[subscriptionTier];
    const dailyLimit = tierConfig.conversationMinutesPerDay;

    if (dailyLimit === Number.MAX_SAFE_INTEGER) {
      // Unlimited tier
      return {
        allowed: true,
        remaining: dailyLimit,
        resetAt: this.getTodayMidnight(),
      };
    }

    // Get user's conversation minutes used today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const minutesUsedToday = user.conversationMinutesUsed;
    const totalMinutesAfterRequest = minutesUsedToday + additionalMinutes;

    if (totalMinutesAfterRequest > dailyLimit) {
      const resetAt = this.getTodayMidnight();
      resetAt.setDate(resetAt.getDate() + 1); // Tomorrow at midnight

      return {
        allowed: false,
        remaining: Math.max(0, dailyLimit - minutesUsedToday),
        resetAt,
        retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: dailyLimit - totalMinutesAfterRequest,
      resetAt: this.getTodayMidnight(),
    };
  }

  /**
   * Update conversation minutes used for a user
   */
  async updateConversationMinutes(userId: string, additionalMinutes: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        conversationMinutesUsed: {
          increment: additionalMinutes,
        },
      },
    });
  }

  /**
   * Reset conversation minutes at the start of each day
   * Should be called by a scheduled job
   */
  async resetDailyConversationMinutes(): Promise<void> {
    await this.prisma.user.updateMany({
      data: {
        conversationMinutesUsed: 0,
      },
    });
  }

  /**
   * Clean up expired rate limit records
   * Should be called by a scheduled job
   */
  async cleanupExpiredRecords(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 3600000);

    await this.prisma.rateLimit.deleteMany({
      where: {
        windowStart: {
          lt: oneHourAgo,
        },
      },
    });
  }

  /**
   * Get rate limit statistics for a user
   */
  async getUserRateLimitStats(userId: string): Promise<{
    subscriptionTier: string;
    conversationMinutesUsed: number;
    conversationMinutesLimit: number;
    conversationMinutesRemaining: number;
    apiRequestsPerHourLimit: number;
    uploadRequestsPerMinuteLimit: number;
    batchUploadRequestsPerMinuteLimit: number;
    searchRequestsPerMinuteLimit: number;
    resetAt: Date;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const tierConfig = this.config[user.subscriptionTier as 'free' | 'pro' | 'enterprise'];

    return {
      subscriptionTier: user.subscriptionTier,
      conversationMinutesUsed: user.conversationMinutesUsed,
      conversationMinutesLimit: tierConfig.conversationMinutesPerDay,
      conversationMinutesRemaining: Math.max(
        0,
        tierConfig.conversationMinutesPerDay - user.conversationMinutesUsed
      ),
      apiRequestsPerHourLimit: tierConfig.apiRequestsPerHour,
      uploadRequestsPerMinuteLimit: tierConfig.uploadRequestsPerMinute,
      batchUploadRequestsPerMinuteLimit: tierConfig.batchUploadRequestsPerMinute,
      searchRequestsPerMinuteLimit: tierConfig.searchRequestsPerMinute,
      resetAt: this.getTodayMidnight(),
    };
  }

  /**
   * Get the rate limit for a specific endpoint
   */
  private getEndpointLimit(endpoint: string, tierConfig: RateLimitConfig['free']): number {
    if (endpoint.includes('/upload') && endpoint.includes('/batch')) {
      return tierConfig.batchUploadRequestsPerMinute;
    }
    if (endpoint.includes('/upload')) {
      return tierConfig.uploadRequestsPerMinute;
    }
    if (endpoint.includes('/search')) {
      return tierConfig.searchRequestsPerMinute;
    }
    return tierConfig.apiRequestsPerHour;
  }

  /**
   * Get the window duration in milliseconds for an endpoint
   */
  private getWindowMs(endpoint: string): number {
    if (endpoint.includes('/upload') || endpoint.includes('/search')) {
      return 60 * 1000; // 1 minute
    }
    return 60 * 60 * 1000; // 1 hour
  }

  /**
   * Get today's midnight in UTC
   */
  private getTodayMidnight(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}

// Singleton instance
let rateLimitService: RateLimitService;

export function getRateLimitService(prisma: PrismaClient): RateLimitService {
  if (!rateLimitService) {
    rateLimitService = new RateLimitService(prisma);
  }
  return rateLimitService;
}
