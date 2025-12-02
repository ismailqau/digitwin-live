import { PrismaClient } from '@prisma/client';

export class RateLimitCleanupService {
  private prisma: PrismaClient;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private resetInterval: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Start scheduled cleanup jobs
   */
  start(): void {
    console.log('[RateLimitCleanupService] Starting cleanup jobs');

    // Run cleanup every hour
    this.cleanupInterval = setInterval(
      async () => {
        try {
          await this.cleanupExpiredRecords();
        } catch (error) {
          console.error('[RateLimitCleanupService] Cleanup error:', error);
        }
      },
      60 * 60 * 1000
    ); // 1 hour

    // Run daily reset at midnight UTC
    this.resetInterval = setInterval(async () => {
      try {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0) {
          await this.resetDailyLimits();
        }
      } catch (error) {
        console.error('[RateLimitCleanupService] Reset error:', error);
      }
    }, 60 * 1000); // Check every minute

    // Run initial cleanup
    this.cleanupExpiredRecords().catch((error) => {
      console.error('[RateLimitCleanupService] Initial cleanup error:', error);
    });

    // Run initial reset check
    this.resetDailyLimits().catch((error) => {
      console.error('[RateLimitCleanupService] Initial reset error:', error);
    });
  }

  /**
   * Stop scheduled cleanup jobs
   */
  stop(): void {
    console.log('[RateLimitCleanupService] Stopping cleanup jobs');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
    }
  }

  /**
   * Clean up expired rate limit records
   */
  private async cleanupExpiredRecords(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 3600000);

      const result = await this.prisma.rateLimit.deleteMany({
        where: {
          windowStart: {
            lt: oneHourAgo,
          },
        },
      });

      if (result.count > 0) {
        console.log(
          `[RateLimitCleanupService] Cleaned up ${result.count} expired rate limit records`
        );
      }
    } catch (error) {
      console.error('[RateLimitCleanupService] Error cleaning up expired records:', error);
      throw error;
    }
  }

  /**
   * Reset daily conversation minutes for all users
   * Should be called once per day at midnight UTC
   */
  private async resetDailyLimits(): Promise<void> {
    try {
      const result = await this.prisma.user.updateMany({
        data: {
          conversationMinutesUsed: 0,
        },
      });

      console.log(`[RateLimitCleanupService] Reset daily limits for ${result.count} users`);
    } catch (error) {
      console.error('[RateLimitCleanupService] Error resetting daily limits:', error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getStats(): Promise<{
    totalRateLimitRecords: number;
    expiredRecords: number;
    usersWithLimits: number;
  }> {
    try {
      const totalRecords = await this.prisma.rateLimit.count();

      const oneHourAgo = new Date(Date.now() - 3600000);
      const expiredRecords = await this.prisma.rateLimit.count({
        where: {
          windowStart: {
            lt: oneHourAgo,
          },
        },
      });

      const usersWithLimits = await this.prisma.rateLimit.findMany({
        distinct: ['userId'],
        select: { userId: true },
      });

      return {
        totalRateLimitRecords: totalRecords,
        expiredRecords,
        usersWithLimits: usersWithLimits.length,
      };
    } catch (error) {
      console.error('[RateLimitCleanupService] Error getting stats:', error);
      throw error;
    }
  }
}

// Singleton instance
let cleanupService: RateLimitCleanupService;

export function getRateLimitCleanupService(prisma: PrismaClient): RateLimitCleanupService {
  if (!cleanupService) {
    cleanupService = new RateLimitCleanupService(prisma);
  }
  return cleanupService;
}
