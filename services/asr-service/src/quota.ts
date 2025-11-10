import { createLogger } from '@clone/logger';

import { asrConfig } from './config';

const logger = createLogger('asr-quota');

interface QuotaUsage {
  requestCount: number;
  audioMinutes: number;
  windowStart: Date;
}

/**
 * ASR Quota Management Service
 * Implements rate limiting and quota tracking
 */
export class ASRQuotaService {
  private requestsPerMinute: Map<string, number[]> = new Map();
  private dailyUsage: Map<string, QuotaUsage> = new Map();

  /**
   * Check if request is within rate limit
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Get recent requests for this user
    let requests = this.requestsPerMinute.get(userId) || [];

    // Remove requests older than 1 minute
    requests = requests.filter((timestamp) => timestamp > oneMinuteAgo);

    // Check if under limit
    if (requests.length >= asrConfig.quotaLimit.requestsPerMinute) {
      logger.warn('Rate limit exceeded', {
        userId,
        requestCount: requests.length,
        limit: asrConfig.quotaLimit.requestsPerMinute,
      });
      return false;
    }

    // Add current request
    requests.push(now);
    this.requestsPerMinute.set(userId, requests);

    return true;
  }

  /**
   * Check if user has remaining daily quota
   */
  async checkDailyQuota(userId: string): Promise<boolean> {
    const usage = this.getDailyUsage(userId);

    if (usage.audioMinutes >= asrConfig.quotaLimit.audioMinutesPerDay) {
      logger.warn('Daily quota exceeded', {
        userId,
        audioMinutes: usage.audioMinutes,
        limit: asrConfig.quotaLimit.audioMinutesPerDay,
      });
      return false;
    }

    return true;
  }

  /**
   * Record audio usage
   */
  async recordUsage(userId: string, audioMinutes: number): Promise<void> {
    const usage = this.getDailyUsage(userId);
    usage.audioMinutes += audioMinutes;
    usage.requestCount++;

    this.dailyUsage.set(userId, usage);

    logger.debug('ASR usage recorded', {
      userId,
      audioMinutes,
      totalAudioMinutes: usage.audioMinutes,
      requestCount: usage.requestCount,
    });
  }

  /**
   * Get daily usage for user
   */
  private getDailyUsage(userId: string): QuotaUsage {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let usage = this.dailyUsage.get(userId);

    // Reset if new day
    if (!usage || usage.windowStart < startOfDay) {
      usage = {
        requestCount: 0,
        audioMinutes: 0,
        windowStart: startOfDay,
      };
      this.dailyUsage.set(userId, usage);
    }

    return usage;
  }

  /**
   * Get remaining quota for user
   */
  async getRemainingQuota(userId: string): Promise<{
    remainingRequests: number;
    remainingMinutes: number;
  }> {
    const usage = this.getDailyUsage(userId);

    return {
      remainingRequests: Math.max(
        0,
        asrConfig.quotaLimit.requestsPerMinute - (this.requestsPerMinute.get(userId)?.length || 0)
      ),
      remainingMinutes: Math.max(0, asrConfig.quotaLimit.audioMinutesPerDay - usage.audioMinutes),
    };
  }

  /**
   * Clean up old data
   */
  cleanup(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const yesterday = new Date(Date.now() - 86400000);

    // Clean rate limit data
    for (const [userId, requests] of this.requestsPerMinute.entries()) {
      const filtered = requests.filter((timestamp) => timestamp > oneMinuteAgo);
      if (filtered.length === 0) {
        this.requestsPerMinute.delete(userId);
      } else {
        this.requestsPerMinute.set(userId, filtered);
      }
    }

    // Clean daily usage data
    for (const [userId, usage] of this.dailyUsage.entries()) {
      if (usage.windowStart < yesterday) {
        this.dailyUsage.delete(userId);
      }
    }
  }
}
