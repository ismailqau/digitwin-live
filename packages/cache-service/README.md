# @clone/cache-service-service

PostgreSQL-based caching service for the Real-Time Conversational Clone System.

## Overview

This package provides caching services using PostgreSQL cache tables. **DO NOT use Redis or Memcached** - this project uses PostgreSQL for all caching to simplify infrastructure and reduce costs.

## Features

- **Embedding Cache**: Caches query embeddings to avoid redundant API calls
- **Vector Search Cache**: Caches vector search results for faster retrieval
- **LLM Response Cache**: Caches LLM responses for FAQs and common queries
- **Audio Chunk Cache**: Caches TTS-generated audio chunks
- **Automatic Cleanup**: Removes expired cache entries
- **Cache Statistics**: Tracks cache hits, misses, and performance
- **Cache Warmup**: Pre-populate cache with frequently accessed data

## Installation

```bash
pnpm add @clone/cache-service-service
```

## Usage

### Basic Usage

```typescript
import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';

const prisma = new PrismaClient();
const cacheManager = new CacheManager(prisma);

// Use embedding cache
const embedding = await cacheManager.embedding.get('What is AI?');
if (!embedding) {
  // Generate embedding
  const newEmbedding = await generateEmbedding('What is AI?');
  await cacheManager.embedding.set('What is AI?', { embedding: newEmbedding });
}

// Use LLM response cache
const llmPrompt = {
  prompt: 'Explain quantum computing',
  context: 'User is a beginner',
  provider: 'gemini-flash',
};
const cachedResponse = await cacheManager.llmResponse.get(llmPrompt);
if (!cachedResponse) {
  // Generate response
  const response = await generateLLMResponse(llmPrompt);
  await cacheManager.llmResponse.set(llmPrompt, {
    response,
    provider: 'gemini-flash',
  });
}
```

### Cache Cleanup

```typescript
// Clean up all expired cache entries
const results = await cacheManager.cleanupAll();
console.log('Deleted entries:', results);

// Clean up specific cache type
const deletedCount = await cacheManager.cleanupCacheType(CacheType.EMBEDDING);
```

### Cache Statistics

```typescript
const stats = await cacheManager.getStats();
console.log('Cache statistics:', stats);
```

### Cache Warmup

```typescript
await cacheManager.warmup({
  embeddings: [
    { queryText: 'What is AI?', embedding: [0.1, 0.2, ...] },
    { queryText: 'How does ML work?', embedding: [0.3, 0.4, ...] },
  ],
  llmResponses: [
    {
      prompt: 'Explain AI',
      provider: 'gemini-flash',
      response: 'AI is...',
    },
  ],
});
```

## Environment Variables

```bash
# Enable/disable caching
ENABLE_CACHING=true

# Cache TTL settings (in seconds)
CACHE_TTL_SHORT=300      # 5 minutes
CACHE_TTL_MEDIUM=3600    # 1 hour
CACHE_TTL_LONG=86400     # 24 hours
```

## Cache Tables

All cache tables follow this pattern:

```sql
CREATE TABLE cache_<type> (
  id UUID PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL,
  cache_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_cache_<type>_key ON cache_<type>(cache_key);
CREATE INDEX idx_cache_<type>_expires ON cache_<type>(expires_at);
```

## Cache Services

### EmbeddingCacheService

Caches query embeddings to avoid redundant API calls to embedding services.

- **Default TTL**: 1 hour (CACHE_TTL_MEDIUM)
- **Key**: SHA-256 hash of query text

### VectorSearchCacheService

Caches vector search results to avoid redundant database queries.

- **Default TTL**: 5 minutes (CACHE_TTL_SHORT)
- **Key**: SHA-256 hash of query embedding + filters + userId

### LLMResponseCacheService

Caches LLM responses for FAQs and common queries.

- **Default TTL**: 1 hour (CACHE_TTL_MEDIUM)
- **Key**: SHA-256 hash of prompt + context + provider
- **Features**: Hit count tracking, top cached responses

### AudioChunkCacheService

Caches TTS-generated audio chunks to avoid redundant synthesis.

- **Default TTL**: 5 minutes (CACHE_TTL_SHORT)
- **Key**: SHA-256 hash of text + voice model + provider + settings
- **Features**: LRU cleanup, cache statistics, storage path tracking

## Best Practices

1. **Enable caching in production**: Set `ENABLE_CACHING=true`
2. **Run cleanup regularly**: Schedule cleanup job every hour
3. **Monitor cache stats**: Track hit rates and adjust TTLs
4. **Warm up cache**: Pre-populate with frequently accessed data
5. **Use appropriate TTLs**: Short for dynamic data, long for static data

## Automatic Cleanup

Implement automatic cleanup using a cron job or scheduled task:

```typescript
import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';

const prisma = new PrismaClient();
const cacheManager = new CacheManager(prisma);

// Run every hour
setInterval(
  async () => {
    const results = await cacheManager.cleanupAll();
    console.log('Cache cleanup completed:', results);
  },
  60 * 60 * 1000
);
```

## Architecture

This package follows the PostgreSQL caching architecture documented in:

- `docs/CACHING-ARCHITECTURE.md`
- `docs/CACHING-SUMMARY.md`

## License

MIT
