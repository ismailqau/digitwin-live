# Audio Caching and Storage Architecture

## Overview

The audio caching and storage system provides efficient management of audio chunks for the Real-Time Conversational Clone platform. It implements a multi-tier strategy combining PostgreSQL caching with Google Cloud Storage (GCS) for long-term archival.

## Architecture

### Multi-Tier Storage Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     Audio Pipeline                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  TTS Service → Audio Chunk → Cache Check → PostgreSQL Cache │
│                                    ↓                          │
│                              Cache Miss                       │
│                                    ↓                          │
│                            Generate Audio                     │
│                                    ↓                          │
│                          Store in Cache (TTL: 5min)          │
│                                    ↓                          │
│                    Archive to GCS (conversation history)     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Storage Tiers

1. **L1: PostgreSQL Cache** (Short-term, 5 minutes TTL)
   - Fast access for active conversations
   - Automatic deduplication
   - TTL-based expiration

2. **L2: Google Cloud Storage** (Long-term archival)
   - Conversation history storage
   - Signed URL access
   - Lifecycle policies for cost optimization

## Database Schema

### Audio Chunk Cache Table

```sql
CREATE TABLE audio_chunk_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,  -- Hash of text + voice settings
  audio_data BYTEA NOT NULL,                -- Compressed audio (Opus codec)
  format VARCHAR(20) DEFAULT 'opus',
  duration_ms INTEGER NOT NULL,
  sample_rate INTEGER DEFAULT 16000,
  channels INTEGER DEFAULT 1,
  compression VARCHAR(20) DEFAULT 'opus',
  storage_path VARCHAR(500),                -- GCS path for archived audio
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_audio_cache_key ON audio_chunk_cache(cache_key);
CREATE INDEX idx_audio_cache_expires ON audio_chunk_cache(expires_at);
CREATE INDEX idx_audio_cache_accessed ON audio_chunk_cache(last_accessed_at);
CREATE INDEX idx_audio_cache_storage ON audio_chunk_cache(storage_path);
```

## Audio Storage Service

### Key Features

1. **Deduplication**: Hash-based cache keys prevent duplicate storage
2. **Compression**: Opus codec for efficient storage (60-80% size reduction)
3. **TTL Management**: Automatic expiration after 5 minutes (CACHE_TTL_SHORT)
4. **Hit Tracking**: Monitor cache effectiveness
5. **LRU Eviction**: Automatic cleanup when cache grows too large
6. **GCS Archival**: Long-term storage for conversation history

### Usage Example

```typescript
import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import { AudioStorageService } from '@clone/database';

const prisma = new PrismaClient();
const storage = new Storage();

const audioService = new AudioStorageService(
  prisma,
  storage,
  'digitwin-live-uploads', // GCS bucket name
  300 // TTL in seconds (5 minutes)
);

// Cache audio chunk
const cacheKey = await audioService.cacheAudioChunk(
  {
    text: 'Hello, how are you?',
    voiceModelId: 'voice-model-123',
    sessionId: 'session-456',
    sequenceNumber: 1,
  },
  {
    audioData: audioBuffer,
    durationMs: 2500,
    sampleRate: 16000,
    channels: 1,
    compression: 'opus',
  }
);

// Retrieve from cache
const cached = await audioService.getAudioChunk(cacheKey);

if (cached) {
  console.log('Cache hit!', cached.durationMs);
} else {
  console.log('Cache miss - generate audio');
}

// Archive to GCS for conversation history
const storagePath = await audioService.storeAudioInGCS({ sessionId: 'session-456' }, audioBuffer, {
  speaker: 'clone',
  timestamp: Date.now(),
});

// Get signed URL for playback
const signedUrl = await audioService.getAudioFromGCS(storagePath, {
  expiresIn: 3600, // 1 hour
});
```

## Cache Key Generation

Cache keys are generated using SHA-256 hash of:

- Text content (for TTS)
- Voice model ID
- Session ID
- Sequence number
- Voice settings (speed, pitch, etc.)

This ensures:

- **Deduplication**: Same audio parameters = same cache key
- **Uniqueness**: Different parameters = different cache key
- **Security**: Hash prevents cache key prediction

```typescript
// Example cache key generation
const keyData = {
  text: 'Hello world',
  voiceModelId: 'voice-123',
  sessionId: 'session-456',
  sequenceNumber: 1,
  settings: { speed: 1.0, pitch: 0 },
};

const cacheKey = createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
// Result: "a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4..."
```

## GCS Storage Structure

Audio files are organized by date and session:

```
digitwin-live-uploads/
└── audio-chunks/
    └── 2025/
        └── 11/
            └── 10/
                └── session-456/
                    ├── a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4.opus
                    ├── b4g6c9d3f2e5a8c7d6e9f2b3c5d8e1a4.opus
                    └── ...
```

## Cleanup Jobs

### Automatic Cleanup

The `AudioCacheCleanupJob` runs periodically to:

1. **Delete expired entries** (TTL-based)
2. **LRU eviction** (keep most recent 10,000 entries)
3. **Archive old audio** (optional, for conversation history)

### Setup with Cron

```typescript
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import { createAudioCacheCleanupJob } from '@clone/database';

const prisma = new PrismaClient();
const storage = new Storage();

const cleanupJob = createAudioCacheCleanupJob(prisma, storage, {
  enableExpiredCleanup: true,
  enableLRUCleanup: true,
  maxCacheEntries: 10000,
  enableArchival: false,
});

// Run every hour
cron.schedule('0 * * * *', async () => {
  const result = await cleanupJob.run();
  console.log('Cleanup completed:', result);
});
```

### Manual Cleanup

```typescript
// Clean up expired entries
const expiredCount = await audioService.cleanupExpiredCache();
console.log(`Deleted ${expiredCount} expired entries`);

// LRU cleanup (keep 10,000 most recent)
const lruCount = await audioService.cleanupLRU(10000);
console.log(`Deleted ${lruCount} old entries`);

// Invalidate by pattern
const invalidated = await audioService.invalidateCacheByPattern({
  sessionId: 'session-456',
});
console.log(`Invalidated ${invalidated} entries`);
```

## Audio Compression

### Opus Codec

The system uses Opus codec for audio compression:

- **Compression ratio**: 60-80% size reduction
- **Quality**: Transparent quality at 32-64 kbps
- **Latency**: Low latency suitable for real-time streaming
- **Format**: Industry standard for voice

### Compression Example

```typescript
// Original PCM audio: 16 kHz, 16-bit, mono
// Size: 32 KB/second

// Compressed Opus audio: 32 kbps
// Size: 4 KB/second

// Savings: 87.5% reduction
```

## Performance Optimization

### Cache Hit Rate

Monitor cache effectiveness:

```typescript
const stats = await audioService.getCacheStats();

console.log({
  totalEntries: stats.totalEntries,
  validEntries: stats.validEntries,
  totalHits: stats.totalHits,
  avgHitsPerEntry: stats.avgHitsPerEntry,
  hitRate: stats.totalHits / stats.totalEntries,
});
```

### Optimization Tips

1. **Increase TTL** for frequently repeated phrases
2. **Pre-warm cache** for common responses
3. **Monitor hit rates** and adjust strategy
4. **Use LRU eviction** to manage cache size
5. **Archive to GCS** for conversation history

## Cost Optimization

### Storage Costs

| Storage Tier     | Cost/GB/Month | Use Case                         |
| ---------------- | ------------- | -------------------------------- |
| PostgreSQL Cache | $0.17         | Active conversations (5 min TTL) |
| GCS Standard     | $0.020        | Recent history (< 30 days)       |
| GCS Nearline     | $0.010        | Archive (30-90 days)             |
| GCS Coldline     | $0.004        | Long-term archive (> 90 days)    |

### Cost Calculation

```
Assumptions:
- 100 conversations/day
- 10 minutes/conversation
- 4 KB/second compressed audio
- 5-minute cache TTL

Daily cache storage: 100 × 10 min × 4 KB/s × 60 s/min = 240 MB
Monthly cache storage: 240 MB × 30 days = 7.2 GB

PostgreSQL cache cost: 7.2 GB × $0.17 = $1.22/month

GCS archive (30 days): 7.2 GB × $0.020 = $0.14/month

Total: $1.36/month for 100 conversations/day
```

### Lifecycle Policies

Configure GCS lifecycle policies to automatically transition old audio:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
        "condition": { "age": 30 }
      },
      {
        "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" },
        "condition": { "age": 90 }
      },
      {
        "action": { "type": "Delete" },
        "condition": { "age": 365 }
      }
    ]
  }
}
```

## Monitoring

### Key Metrics

1. **Cache hit rate**: Percentage of cache hits vs misses
2. **Cache size**: Total entries and storage size
3. **Cleanup frequency**: How often cleanup runs
4. **GCS storage**: Total archived audio size
5. **Access patterns**: Most frequently accessed audio

### Monitoring Queries

```sql
-- Cache hit rate
SELECT
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry,
  (SUM(hit_count)::float / COUNT(*)) as hit_rate
FROM audio_chunk_cache
WHERE expires_at > NOW();

-- Cache size by age
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as entries,
  SUM(LENGTH(audio_data)) as total_bytes
FROM audio_chunk_cache
WHERE expires_at > NOW()
GROUP BY hour
ORDER BY hour DESC;

-- Most frequently accessed audio
SELECT
  cache_key,
  hit_count,
  duration_ms,
  created_at,
  last_accessed_at
FROM audio_chunk_cache
WHERE expires_at > NOW()
ORDER BY hit_count DESC
LIMIT 10;
```

## Troubleshooting

### Low Cache Hit Rate

**Symptoms**: High TTS generation costs, slow response times

**Solutions**:

1. Increase TTL for stable content
2. Pre-warm cache for common phrases
3. Check cache key generation (ensure consistency)
4. Monitor for cache eviction issues

### Cache Growing Too Large

**Symptoms**: High database storage costs, slow queries

**Solutions**:

1. Reduce TTL for less frequently accessed audio
2. Enable LRU eviction with lower threshold
3. Increase cleanup frequency
4. Archive to GCS more aggressively

### GCS Access Errors

**Symptoms**: Failed to retrieve archived audio

**Solutions**:

1. Check GCS bucket permissions
2. Verify service account credentials
3. Check signed URL expiration
4. Verify storage path exists

## Best Practices

1. **Use appropriate TTL**: 5 minutes for active conversations
2. **Monitor cache hit rates**: Aim for > 50% hit rate
3. **Regular cleanup**: Run cleanup job hourly
4. **Archive strategically**: Only archive important conversations
5. **Compress audio**: Always use Opus codec
6. **Monitor costs**: Track storage and bandwidth usage
7. **Test signed URLs**: Verify expiration and access
8. **Implement retry logic**: Handle transient GCS errors

## Environment Variables

```bash
# Cache configuration
CACHE_TTL_SHORT=300              # 5 minutes for audio chunks
ENABLE_CACHING=true              # Enable caching

# GCS configuration
GCS_UPLOADS_BUCKET=digitwin-live-uploads
GCS_PROJECT_ID=digitwinlive-prod
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Cleanup configuration
AUDIO_CACHE_MAX_ENTRIES=10000    # Max cache entries before LRU eviction
AUDIO_CACHE_CLEANUP_INTERVAL=3600 # Cleanup every hour (seconds)
```

## Related Documentation

- [Caching Architecture](./CACHING-ARCHITECTURE.md) - Overall caching strategy
- [Caching Summary](./CACHING-SUMMARY.md) - Quick reference
- [GCP Infrastructure](./GCP-INFRASTRUCTURE.md) - GCS bucket setup
- [Audio Processing](./AUDIO-PROCESSING.md) - Audio pipeline overview

## Migration Guide

### From In-Memory to PostgreSQL Cache

```typescript
// Before (in-memory)
const cache = new Map<string, Buffer>();
cache.set(key, audioBuffer);
const cached = cache.get(key);

// After (PostgreSQL)
await audioService.cacheAudioChunk(keyParams, audioData);
const cached = await audioService.getAudioChunk(cacheKey);
```

### From Redis to PostgreSQL Cache

```typescript
// Before (Redis)
await redis.setex(key, 300, audioBuffer);
const cached = await redis.get(key);

// After (PostgreSQL)
await audioService.cacheAudioChunk(keyParams, audioData);
const cached = await audioService.getAudioChunk(cacheKey);
```

## Conclusion

The audio caching and storage system provides efficient, cost-effective management of audio chunks for the Real-Time Conversational Clone platform. By combining PostgreSQL caching with GCS archival, it achieves:

- **Fast access** for active conversations (< 5ms cache lookups)
- **Cost efficiency** through compression and lifecycle policies
- **Scalability** with automatic cleanup and LRU eviction
- **Reliability** with GCS archival for conversation history

For questions or issues, refer to the troubleshooting section or contact the platform team.
