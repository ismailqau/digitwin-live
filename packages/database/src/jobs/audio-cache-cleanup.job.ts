/**
 * Audio Cache Cleanup Job
 *
 * Scheduled job to clean up expired audio cache entries
 * Should be run periodically (e.g., every hour)
 */

import { Storage } from '@google-cloud/storage';
import { PrismaClient } from '@prisma/client';

import { AudioStorageService } from '../services/audio-storage.service';

export interface CleanupJobConfig {
  enableExpiredCleanup: boolean;
  enableLRUCleanup: boolean;
  maxCacheEntries: number;
  enableArchival: boolean;
  archivalThresholdDays: number;
}

export class AudioCacheCleanupJob {
  private audioStorageService: AudioStorageService;
  private config: CleanupJobConfig;

  constructor(prisma: PrismaClient, storage: Storage, config: Partial<CleanupJobConfig> = {}) {
    this.audioStorageService = new AudioStorageService(
      prisma,
      storage,
      process.env.GCS_UPLOADS_BUCKET || 'digitwin-live-uploads',
      parseInt(process.env.CACHE_TTL_SHORT || '300', 10)
    );

    this.config = {
      enableExpiredCleanup: config.enableExpiredCleanup ?? true,
      enableLRUCleanup: config.enableLRUCleanup ?? true,
      maxCacheEntries: config.maxCacheEntries ?? 10000,
      enableArchival: config.enableArchival ?? false,
      archivalThresholdDays: config.archivalThresholdDays ?? 7,
    };
  }

  /**
   * Run the cleanup job
   * Returns statistics about the cleanup operation
   */
  async run(): Promise<{
    expiredDeleted: number;
    lruDeleted: number;
    totalDeleted: number;
    remainingEntries: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let expiredDeleted = 0;
    let lruDeleted = 0;

    try {
      console.log('[AudioCacheCleanup] Starting cleanup job...');

      // Step 1: Clean up expired entries
      if (this.config.enableExpiredCleanup) {
        console.log('[AudioCacheCleanup] Cleaning up expired entries...');
        expiredDeleted = await this.audioStorageService.cleanupExpiredCache();
        console.log(`[AudioCacheCleanup] Deleted ${expiredDeleted} expired entries`);
      }

      // Step 2: LRU cleanup if cache is too large
      if (this.config.enableLRUCleanup) {
        console.log('[AudioCacheCleanup] Running LRU cleanup...');
        lruDeleted = await this.audioStorageService.cleanupLRU(this.config.maxCacheEntries);
        console.log(`[AudioCacheCleanup] Deleted ${lruDeleted} entries via LRU`);
      }

      // Step 3: Get final stats
      const stats = await this.audioStorageService.getCacheStats();
      const duration = Date.now() - startTime;

      console.log('[AudioCacheCleanup] Cleanup completed', {
        expiredDeleted,
        lruDeleted,
        totalDeleted: expiredDeleted + lruDeleted,
        remainingEntries: stats.validEntries,
        duration: `${duration}ms`,
      });

      return {
        expiredDeleted,
        lruDeleted,
        totalDeleted: expiredDeleted + lruDeleted,
        remainingEntries: stats.validEntries,
        duration,
      };
    } catch (error) {
      console.error('[AudioCacheCleanup] Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    return this.audioStorageService.getCacheStats();
  }
}

/**
 * Create and schedule the cleanup job
 * Can be used with cron or other scheduling systems
 */
export function createAudioCacheCleanupJob(
  prisma: PrismaClient,
  storage: Storage,
  config?: Partial<CleanupJobConfig>
): AudioCacheCleanupJob {
  return new AudioCacheCleanupJob(prisma, storage, config);
}

/**
 * Example usage with node-cron:
 *
 * import cron from 'node-cron';
 * import { PrismaClient } from '@prisma/client';
 * import { Storage } from '@google-cloud/storage';
 * import { createAudioCacheCleanupJob } from './audio-cache-cleanup.job';
 *
 * const prisma = new PrismaClient();
 * const storage = new Storage();
 * const cleanupJob = createAudioCacheCleanupJob(prisma, storage);
 *
 * // Run every hour
 * cron.schedule('0 * * * *', async () => {
 *   await cleanupJob.run();
 * });
 */
