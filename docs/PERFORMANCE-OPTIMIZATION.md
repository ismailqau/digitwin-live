# Performance Optimization Guide

This document describes the performance optimization strategies implemented in the Real-Time Conversational Clone System.

## Table of Contents

- [Caching Strategy](#caching-strategy)
- [API Response Optimization](#api-response-optimization)
- [Background Job Processing](#background-job-processing)
- [Network Optimization](#network-optimization)
- [Best Practices](#best-practices)

## Caching Strategy

### PostgreSQL-Based Caching

**IMPORTANT**: This project uses PostgreSQL for ALL caching, NOT Redis or Memcached.

#### Cache Tables

The system implements four cache tables:

1. **EmbeddingCache** - Caches query embeddings (TTL: 1 hour)
2. **VectorSearchCache** - Caches vector search results (TTL: 5 minutes)
3. **LLMResponseCache** - Caches LLM responses (TTL: 1 hour)
4. **AudioChunkCache** - Caches TTS audio chunks (TTL: 5 minutes)

#### Cache Service Usage

```typescript
import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';

const prisma = new PrismaClient();
const cacheManager = new CacheManager(prisma);

// Cache embedding
await cacheManager.embedding.set('query text', { embedding: [0.1, 0.2, ...] });

// Get cached embedding
const cached = await cacheManager.embedding.get('query text');

// Cache vector search results
await cacheManager.vectorSearch.set(
  { embedding, topK: 5, userId: 'user-id' },
  { results: [...] }
);

// Cache LLM response
await cacheManager.llmResponse.set(
  { prompt: 'question', context: 'context', provider: 'gemini' },
  { response: 'answer', provider: 'gemini' }
);

// Cache audio chunk
await cacheManager.audioChunk.set(
  { text: 'hello', voiceModelId: 'model-id', provider: 'xtts-v2' },
  { audioData: buffer, format: 'opus', durationMs: 1000, ... }
);
```

#### Cache Cleanup

Automatic cleanup runs periodically to remove expired entries:

```typescript
// Clean all cache types
const results = await cacheManager.cleanupAll();

// Clean specific cache type
const deletedCount = await cacheManager.cleanupCacheType(CacheType.EMBEDDING);
```

#### Environment Variables

```bash
ENABLE_CACHING=true
CACHE_TTL_SHORT=300      # 5 minutes
CACHE_TTL_MEDIUM=3600    # 1 hour
CACHE_TTL_LONG=86400     # 24 hours
```

## API Response Optimization

### Response Compression

Automatic gzip/brotli compression for responses > 1KB:

```typescript
import { compressionMiddleware } from './middleware/compression.middleware';

app.use(compressionMiddleware);
```

### Pagination

Consistent pagination across all list endpoints:

```typescript
import { paginationMiddleware } from './middleware/pagination.middleware';

app.use(paginationMiddleware);

// In route handler
app.get('/api/v1/documents', async (req, res) => {
  const { page, limit, offset } = req.pagination;

  const documents = await prisma.knowledgeDocument.findMany({
    skip: offset,
    take: limit,
  });

  const total = await prisma.knowledgeDocument.count();

  res.paginate(documents, total);
});
```

Query parameters:

- `?page=1` - Page number (default: 1)
- `?limit=20` - Items per page (default: 20, max: 100)
- `?sortBy=createdAt` - Sort field
- `?sortOrder=desc` - Sort order (asc/desc)

### Field Filtering

GraphQL-style field selection for partial responses:

```typescript
import { fieldFilteringMiddleware } from './middleware/fieldFiltering.middleware';

app.use(fieldFilteringMiddleware);
```

Usage:

```
GET /api/v1/documents?fields=id,title,uploadedAt
```

### ETags

Conditional requests with ETags for efficient caching:

```typescript
import { etagMiddleware } from './middleware/etag.middleware';

app.use(etagMiddleware);
```

Client sends `If-None-Match` header, server returns `304 Not Modified` if content unchanged.

## Background Job Processing

### Job Queue Setup

Uses BullMQ with Redis for reliable job queuing:

```typescript
import { getQueueManager, JobType, JobPriority } from '@clone/job-queue';

const queueManager = getQueueManager();

// Add job to queue
await queueManager.addJob(
  JobType.DOCUMENT_PROCESSING,
  {
    userId: 'user-id',
    documentId: 'doc-id',
    filename: 'document.pdf',
    storagePath: 'gs://bucket/path',
    contentType: 'application/pdf',
  },
  {
    priority: JobPriority.NORMAL,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  }
);
```

### Job Types

1. **Document Processing** - Extract text, chunk, embed, store
2. **Voice Model Training** - Train custom voice models
3. **Face Model Creation** - Process face images/video
4. **Cache Cleanup** - Periodic cache maintenance

### Job Workers

Create workers to process jobs:

```typescript
queueManager.createWorker(
  JobType.DOCUMENT_PROCESSING,
  async (job) => {
    const { documentId, storagePath } = job.data;

    // Update progress
    await queueManager.updateJobProgress(job, {
      percentage: 25,
      message: 'Extracting text...',
    });

    // Process document
    const result = await processDocument(documentId, storagePath);

    return {
      success: true,
      data: result,
    };
  },
  2 // Concurrency
);
```

### Job Monitoring

```typescript
// Get job status
const status = await queueManager.getJobStatus(JobType.DOCUMENT_PROCESSING, jobId);

// Get queue statistics
const stats = await queueManager.getQueueStats(JobType.DOCUMENT_PROCESSING);
// Returns: { waiting, active, completed, failed, delayed }

// Cancel job
await queueManager.cancelJob(JobType.DOCUMENT_PROCESSING, jobId);
```

### Environment Variables

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional-password
```

## Network Optimization

### Network Quality Detection

Monitors connection quality and adapts streaming parameters:

```typescript
import { NetworkQualityMonitor } from './utils/networkQuality';

const monitor = new NetworkQualityMonitor();

// Start monitoring
monitor.startMonitoring(() => {
  socket.emit('ping');
}, 10000); // Every 10 seconds

// Record pong response
socket.on('pong', () => {
  monitor.recordPong();
});

// Get network quality
const quality = monitor.getNetworkQuality();
// Returns: 'excellent' | 'good' | 'fair' | 'poor'

// Get recommended settings
const settings = monitor.getRecommendedSettings();
// Returns: { videoQuality, audioQuality, compressionLevel, bufferSize }
```

### Adaptive Quality

System automatically adjusts quality based on network conditions:

| Network Quality | Video Quality  | Audio Quality | Compression | Buffer |
| --------------- | -------------- | ------------- | ----------- | ------ |
| Excellent       | 512x512, 20fps | High          | Level 4     | 200ms  |
| Good            | 256x256, 15fps | High          | Level 6     | 500ms  |
| Fair            | 128x128, 10fps | Medium        | Level 7     | 1000ms |
| Poor            | Audio only     | Low           | Level 9     | 2000ms |

### WebSocket Compression

Per-message deflate compression for WebSocket messages:

```typescript
import { WebSocketCompression } from './utils/compression';

const compression = new WebSocketCompression({
  enabled: true,
  threshold: 1024, // Compress messages > 1KB
  level: 6,
});

// Use with Socket.io
const io = new Server(server, {
  ...compression.getSocketIOOptions(),
});
```

### Reconnection Logic

Exponential backoff for automatic reconnection:

```typescript
import { ReconnectionManager } from './utils/reconnection';

const reconnection = new ReconnectionManager({
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  maxAttempts: 0, // Infinite
  backoffMultiplier: 2,
});

// Schedule reconnection
reconnection.scheduleReconnect(async () => {
  try {
    await connectToServer();
    return true; // Success
  } catch (error) {
    return false; // Failed, will retry
  }
});

// Cancel reconnection
reconnection.cancel();

// Reset state
reconnection.reset();
```

## Best Practices

### Caching

1. **Use appropriate TTLs**:
   - Short (5 min): Frequently changing data (search results, audio chunks)
   - Medium (1 hour): Semi-static data (embeddings, LLM responses)
   - Long (24 hours): Static data (rarely changes)

2. **Cache invalidation**:
   - Invalidate on data updates
   - Use event-based triggers
   - Run periodic cleanup jobs

3. **Monitor cache hit rates**:
   ```typescript
   const stats = await cacheManager.getStats();
   console.log('Cache stats:', stats);
   ```

### API Optimization

1. **Always use pagination** for list endpoints
2. **Enable compression** for all responses
3. **Use ETags** for cacheable resources
4. **Implement field filtering** for large objects
5. **Set appropriate Cache-Control headers**

### Background Jobs

1. **Use appropriate priorities**:
   - Critical: User-facing operations
   - High: Time-sensitive tasks
   - Normal: Standard processing
   - Low: Maintenance tasks

2. **Implement retry logic** with exponential backoff
3. **Monitor job queues** for bottlenecks
4. **Set reasonable timeouts** for long-running jobs
5. **Clean up old jobs** periodically

### Network Optimization

1. **Monitor network quality** continuously
2. **Adapt quality settings** based on conditions
3. **Use compression** for large messages
4. **Implement reconnection logic** with backoff
5. **Buffer appropriately** for smooth playback
6. **Provide audio-only fallback** for poor connections

## Related Documentation

- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [Caching Summary](./CACHING-SUMMARY.md)
- [Database Architecture](./DATABASE-ARCHITECTURE.md)
- [GCP Management](./GCP-MANAGEMENT.md)
