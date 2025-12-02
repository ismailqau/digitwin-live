/**
 * Cleanup job for running data retention policies
 * This can be run as a cron job or scheduled task
 */

import { logger as defaultLogger } from '@clone/logger';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'winston';

import { DataRetentionService } from './data-retention';

export class CleanupJob {
  private logger: Logger;
  private dataRetention: DataRetentionService;

  constructor(prisma: PrismaClient, logger?: Logger) {
    this.logger = logger || defaultLogger;
    this.dataRetention = new DataRetentionService(prisma, this.logger);
  }

  /**
   * Run the cleanup job
   */
  async run(): Promise<void> {
    this.logger.info('Starting cleanup job');
    const startTime = Date.now();

    try {
      const results = await this.dataRetention.runAllCleanupJobs();

      const duration = Date.now() - startTime;
      this.logger.info('Cleanup job completed successfully', {
        duration,
        results,
      });
    } catch (error) {
      this.logger.error('Cleanup job failed', { error });
      throw error;
    }
  }

  /**
   * Run specific cleanup task
   */
  async runTask(
    task: 'conversations' | 'auditLogs' | 'cache' | 'softDeleted' | 'rateLimits'
  ): Promise<void> {
    this.logger.info(`Running cleanup task: ${task}`);

    try {
      switch (task) {
        case 'conversations':
          await this.dataRetention.cleanupConversationHistory();
          break;
        case 'auditLogs':
          await this.dataRetention.cleanupAuditLogs();
          break;
        case 'cache':
          await this.dataRetention.cleanupExpiredCache();
          break;
        case 'softDeleted':
          await this.dataRetention.cleanupSoftDeletedResources();
          break;
        case 'rateLimits':
          await this.dataRetention.cleanupRateLimits();
          break;
      }

      this.logger.info(`Cleanup task completed: ${task}`);
    } catch (error) {
      this.logger.error(`Cleanup task failed: ${task}`, { error });
      throw error;
    }
  }
}

/**
 * CLI entry point for running cleanup job
 */
export async function runCleanupJob(): Promise<void> {
  const prisma = new PrismaClient();
  const job = new CleanupJob(prisma);

  try {
    await job.run();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    defaultLogger.error('Cleanup job failed', { error });
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runCleanupJob();
}
