#!/usr/bin/env ts-node
/**
 * Cache statistics script
 * Displays cache statistics for all cache types
 *
 * Usage:
 *   pnpm cache:stats
 */

import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';

async function main() {
  const prisma = new PrismaClient();
  const cacheManager = new CacheManager(prisma);

  try {
    logger.info('Fetching cache statistics...');

    const stats = await cacheManager.getStats();

    console.log('\n=== Cache Statistics ===\n');

    console.log('Embedding Cache:');
    console.log(`  Total Entries: ${stats.embedding.totalEntries}`);
    console.log('');

    console.log('Vector Search Cache:');
    console.log(`  Total Entries: ${stats.vectorSearch.totalEntries}`);
    console.log('');

    console.log('LLM Response Cache:');
    console.log(`  Total Entries: ${stats.llmResponse.totalEntries}`);
    if (stats.llmResponse.topCached.length > 0) {
      console.log('  Top Cached Responses:');
      stats.llmResponse.topCached.forEach((item, index) => {
        console.log(
          `    ${index + 1}. Hash: ${item.promptHash.substring(0, 16)}... (${item.hitCount} hits, ${item.provider})`
        );
      });
    }
    console.log('');

    console.log('Audio Chunk Cache:');
    console.log(`  Total Entries: ${stats.audioChunk.totalEntries}`);
    console.log(`  Total Size: ${(stats.audioChunk.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Average Hit Count: ${stats.audioChunk.avgHitCount.toFixed(2)}`);
    if (stats.audioChunk.mostAccessed.length > 0) {
      console.log('  Most Accessed:');
      stats.audioChunk.mostAccessed.slice(0, 5).forEach((item, index) => {
        console.log(
          `    ${index + 1}. Hash: ${item.cacheKey.substring(0, 16)}... (${item.hitCount} hits)`
        );
      });
    }
    console.log('');

    const totalEntries =
      stats.embedding.totalEntries +
      stats.vectorSearch.totalEntries +
      stats.llmResponse.totalEntries +
      stats.audioChunk.totalEntries;

    console.log(`Total Cache Entries: ${totalEntries}`);
    console.log('');

    process.exit(0);
  } catch (error) {
    logger.error('Failed to fetch cache statistics', { error: (error as Error).message });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
