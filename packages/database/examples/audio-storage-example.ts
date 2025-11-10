/**
 * Audio Storage Service Usage Examples
 *
 * This file demonstrates how to use the AudioStorageService
 * for caching and storing audio chunks.
 */

import { Storage } from '@google-cloud/storage';
import { PrismaClient } from '@prisma/client';

import { createAudioCacheCleanupJob } from '../src/jobs/audio-cache-cleanup.job';
import { AudioStorageService } from '../src/services/audio-storage.service';

// Initialize clients
const prisma = new PrismaClient();
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Create audio storage service
const audioService = new AudioStorageService(
  prisma,
  storage,
  process.env.GCS_UPLOADS_BUCKET || 'digitwin-live-uploads',
  parseInt(process.env.CACHE_TTL_SHORT || '300', 10)
);

/**
 * Example 1: Cache audio chunk from TTS
 */
async function example1_cacheAudioChunk() {
  console.log('\n=== Example 1: Cache Audio Chunk ===\n');

  // Simulate audio data from TTS service
  const audioBuffer = Buffer.from('simulated-audio-data');

  // Cache the audio chunk
  const cacheKey = await audioService.cacheAudioChunk(
    {
      text: 'Hello, how are you today?',
      voiceModelId: 'voice-model-123',
      sessionId: 'session-456',
      sequenceNumber: 1,
      settings: {
        speed: 1.0,
        pitch: 0,
      },
    },
    {
      audioData: audioBuffer,
      durationMs: 2500,
      sampleRate: 16000,
      channels: 1,
      compression: 'opus',
      metadata: {
        speaker: 'clone',
        timestamp: Date.now(),
      },
    }
  );

  console.log('Audio cached with key:', cacheKey);
}

/**
 * Example 2: Retrieve audio from cache
 */
async function example2_retrieveFromCache() {
  console.log('\n=== Example 2: Retrieve from Cache ===\n');

  // First, cache some audio
  const audioBuffer = Buffer.from('test-audio-data');
  const cacheKey = await audioService.cacheAudioChunk(
    {
      text: 'Test phrase',
      voiceModelId: 'voice-123',
    },
    {
      audioData: audioBuffer,
      durationMs: 1500,
    }
  );

  // Retrieve from cache
  const cached = await audioService.getAudioChunk(cacheKey);

  if (cached) {
    console.log('Cache HIT!');
    console.log('Duration:', cached.durationMs, 'ms');
    console.log('Format:', cached.format);
    console.log('Sample Rate:', cached.sampleRate, 'Hz');
  } else {
    console.log('Cache MISS - need to generate audio');
  }
}

/**
 * Example 3: Deduplication - same audio parameters
 */
async function example3_deduplication() {
  console.log('\n=== Example 3: Deduplication ===\n');

  const audioBuffer = Buffer.from('duplicate-test-audio');
  const keyParams = {
    text: 'Same text',
    voiceModelId: 'voice-123',
  };

  // Cache first time
  const key1 = await audioService.cacheAudioChunk(keyParams, {
    audioData: audioBuffer,
    durationMs: 1000,
  });

  // Cache second time with same parameters
  const key2 = await audioService.cacheAudioChunk(keyParams, {
    audioData: audioBuffer,
    durationMs: 1000,
  });

  console.log('First cache key:', key1);
  console.log('Second cache key:', key2);
  console.log('Keys are identical:', key1 === key2);
  console.log('Deduplication working: Only one entry stored!');
}

/**
 * Example 4: Archive audio to GCS
 */
async function example4_archiveToGCS() {
  console.log('\n=== Example 4: Archive to GCS ===\n');

  const audioBuffer = Buffer.from('audio-to-archive');

  // Store in GCS for long-term archival
  const storagePath = await audioService.storeAudioInGCS(
    {
      sessionId: 'session-789',
      sequenceNumber: 5,
    },
    audioBuffer,
    {
      speaker: 'clone',
      conversationId: 'conv-123',
      timestamp: Date.now(),
    }
  );

  console.log('Audio archived to GCS:', storagePath);

  // Get signed URL for playback
  const signedUrl = await audioService.getAudioFromGCS(storagePath, {
    expiresIn: 3600, // 1 hour
  });

  console.log('Signed URL (expires in 1 hour):', signedUrl.substring(0, 100) + '...');
}

/**
 * Example 5: Archive entire conversation
 */
async function example5_archiveConversation() {
  console.log('\n=== Example 5: Archive Conversation ===\n');

  const sessionId = 'session-999';

  // Cache multiple audio chunks for a conversation
  for (let i = 0; i < 5; i++) {
    await audioService.cacheAudioChunk(
      {
        sessionId,
        sequenceNumber: i,
      },
      {
        audioData: Buffer.from(`audio-chunk-${i}`),
        durationMs: 1000 + i * 100,
        metadata: { sessionId },
      }
    );
  }

  // Archive all audio for this conversation
  const archivedCount = await audioService.archiveConversationAudio(sessionId);

  console.log(`Archived ${archivedCount} audio chunks for session ${sessionId}`);
}

/**
 * Example 6: Cleanup expired cache
 */
async function example6_cleanupExpired() {
  console.log('\n=== Example 6: Cleanup Expired Cache ===\n');

  // Clean up expired entries
  const deletedCount = await audioService.cleanupExpiredCache();

  console.log(`Deleted ${deletedCount} expired cache entries`);
}

/**
 * Example 7: LRU cleanup
 */
async function example7_lruCleanup() {
  console.log('\n=== Example 7: LRU Cleanup ===\n');

  // Keep only 100 most recent entries
  const deletedCount = await audioService.cleanupLRU(100);

  console.log(`Deleted ${deletedCount} old entries via LRU eviction`);
}

/**
 * Example 8: Get cache statistics
 */
async function example8_cacheStats() {
  console.log('\n=== Example 8: Cache Statistics ===\n');

  const stats = await audioService.getCacheStats();

  console.log('Cache Statistics:');
  console.log('  Total Entries:', stats.totalEntries);
  console.log('  Valid Entries:', stats.validEntries);
  console.log('  Expired Entries:', stats.expiredEntries);
  console.log('  Total Hits:', stats.totalHits);
  console.log('  Avg Hits/Entry:', stats.avgHitsPerEntry.toFixed(2));
  console.log('  Hit Rate:', ((stats.totalHits / stats.totalEntries) * 100).toFixed(2) + '%');
}

/**
 * Example 9: Invalidate cache by pattern
 */
async function example9_invalidateByPattern() {
  console.log('\n=== Example 9: Invalidate by Pattern ===\n');

  // Invalidate all audio for a specific session
  const deletedCount = await audioService.invalidateCacheByPattern({
    sessionId: 'session-456',
  });

  console.log(`Invalidated ${deletedCount} cache entries for session-456`);
}

/**
 * Example 10: Scheduled cleanup job
 */
async function example10_scheduledCleanup() {
  console.log('\n=== Example 10: Scheduled Cleanup Job ===\n');

  // Create cleanup job
  const cleanupJob = createAudioCacheCleanupJob(prisma, storage, {
    enableExpiredCleanup: true,
    enableLRUCleanup: true,
    maxCacheEntries: 10000,
  });

  // Run cleanup
  const result = await cleanupJob.run();

  console.log('Cleanup Job Results:');
  console.log('  Expired Deleted:', result.expiredDeleted);
  console.log('  LRU Deleted:', result.lruDeleted);
  console.log('  Total Deleted:', result.totalDeleted);
  console.log('  Remaining Entries:', result.remainingEntries);
  console.log('  Duration:', result.duration, 'ms');
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await example1_cacheAudioChunk();
    await example2_retrieveFromCache();
    await example3_deduplication();
    await example4_archiveToGCS();
    await example5_archiveConversation();
    await example6_cleanupExpired();
    await example7_lruCleanup();
    await example8_cacheStats();
    await example9_invalidateByPattern();
    await example10_scheduledCleanup();

    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  example1_cacheAudioChunk,
  example2_retrieveFromCache,
  example3_deduplication,
  example4_archiveToGCS,
  example5_archiveConversation,
  example6_cleanupExpired,
  example7_lruCleanup,
  example8_cacheStats,
  example9_invalidateByPattern,
  example10_scheduledCleanup,
};
