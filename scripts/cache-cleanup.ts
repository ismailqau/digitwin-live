#!/usr/bin/env ts-node
/**
 * Cache cleanup script
 * Runs automatic cleanup of expired cache entries
 *
 * Usage:
 *   pnpm cache:cleanup
 *
 * Schedule with cron:
 *   0 * * * * cd /path/to/project && pnpm cache:cleanup
 */

import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';

async function main() {
  const prisma = new PrismaClient();
  const cacheManager = new CacheManager(prisma);

  try {
    logger.info('Starting cache cleanup...');

    const results = await cacheManager.cleanupAll();

    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

    logger.info('Cache cleanup completed', {
      totalDeleted,
      results: results.map((r) => ({
        type: r.cacheType,
        deleted: r.deletedCount,
      })),
    });

    // Get cache statistics after cleanup
    const stats = await cacheManager.getStats();
    logger.info('Cache statistics', stats);

    process.exit(0);
  } catch (error) {
    logger.error('Cache cleanup failed', { error: (error as Error).message });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
