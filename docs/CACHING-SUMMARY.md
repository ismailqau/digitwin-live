# Caching Implementation Summary

## Overview

**DigiTwin Live uses PostgreSQL indexed cache tables for caching** instead of a separate caching service like Redis or Memcached.

## Why PostgreSQL Instead of Redis?

### Advantages

✅ **Simplified Infrastructure**

- No separate caching service to manage
- Fewer moving parts = easier deployment
- Reduced operational complexity

✅ **Cost Effective**

- No additional Redis/Memcached instances
- Single database for both data and cache
- Lower infrastructure costs

✅ **ACID Compliance**

- Transactional consistency between cache and data
- No cache invalidation race conditions
- Reliable cache updates

✅ **Advanced Querying**

- Complex cache queries with SQL
- JSONB support for structured cache data
- Full-text search capabilities

✅ **Excellent Performance**

- PostgreSQL 15+ with proper indexing is very fast
- B-tree and GIN indexes for quick lookups
- Query result caching built-in

### Performance Characteristics

| Operation     | PostgreSQL Cache | Redis                    |
| ------------- | ---------------- | ------------------------ |
| Simple GET    | ~1-2ms           | ~0.5-1ms                 |
| Complex Query | ~2-5ms           | N/A (requires app logic) |
| JSONB Query   | ~2-3ms           | N/A                      |
| Transactional | ✅ Yes           | ❌ No                    |
| Persistence   | ✅ Built-in      | ⚠️ Optional              |

## Implementation

### Cache Tables

```sql
-- Vector search results cache
CREATE TABLE cache_vector_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  query_hash VARCHAR(64) NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_cache_vector_user_hash
  ON cache_vector_searches(user_id, query_hash);
CREATE INDEX idx_cache_vector_expires
  ON cache_vector_searches(expires_at);

-- LLM responses cache
CREATE TABLE cache_llm_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash VARCHAR(64) NOT NULL,
  response TEXT NOT NULL,
  model VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_cache_llm_hash
  ON cache_llm_responses(prompt_hash);
CREATE INDEX idx_cache_llm_expires
  ON cache_llm_responses(expires_at);
```

### Usage Example

```typescript
// Get from cache
const cached = await db.cache_vector_searches.findFirst({
  where: {
    user_id: userId,
    query_hash: hash,
    expires_at: { gt: new Date() },
  },
});

// Set cache
await db.cache_vector_searches.create({
  data: {
    user_id: userId,
    query_hash: hash,
    results: results,
    expires_at: new Date(Date.now() + ttl),
  },
});
```

## Configuration

### Environment Variables

```bash
# Enable/disable caching
ENABLE_CACHING=true

# Cache TTL settings (in seconds)
CACHE_TTL_SHORT=300      # 5 minutes
CACHE_TTL_MEDIUM=3600    # 1 hour
CACHE_TTL_LONG=86400     # 24 hours
```

### No Additional Services Required

Unlike Redis-based caching, no additional services need to be:

- Installed
- Configured
- Monitored
- Scaled
- Backed up separately

Everything is handled by PostgreSQL!

## Maintenance

### Cache Cleanup

Expired cache entries are automatically cleaned up:

```sql
-- Automatic cleanup (run via cron or scheduled job)
DELETE FROM cache_vector_searches WHERE expires_at < NOW();
DELETE FROM cache_llm_responses WHERE expires_at < NOW();
DELETE FROM cache_audio_chunks WHERE expires_at < NOW();
```

### Monitoring

Monitor cache performance using PostgreSQL's built-in tools:

```sql
-- Cache hit rate
SELECT
  table_name,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries
FROM information_schema.tables
WHERE table_name LIKE 'cache_%'
GROUP BY table_name;

-- Cache size
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'cache_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Migration from Redis

If you're migrating from Redis to PostgreSQL caching:

### 1. Remove Redis Dependencies

```bash
# Remove from package.json
npm uninstall redis ioredis

# Remove from docker-compose.yml
# Remove Redis service definition

# Remove from Kubernetes
# Remove Redis deployment and service
```

### 2. Update Code

```typescript
// Before (Redis)
await redis.get(key);
await redis.set(key, value, 'EX', ttl);
await redis.del(key);

// After (PostgreSQL)
await cacheService.get(key);
await cacheService.set(key, value, ttl);
await cacheService.delete(key);
```

### 3. Remove Environment Variables

```bash
# Remove these from .env
# REDIS_URL
# REDIS_HOST
# REDIS_PORT
# REDIS_PASSWORD
```

### 4. Update Infrastructure

- Remove Redis from Terraform/CloudFormation
- Remove Redis monitoring/alerts
- Update deployment scripts
- Update documentation

## Performance Optimization

### Indexing Strategy

```sql
-- B-tree indexes for exact matches
CREATE INDEX idx_cache_key ON cache_table(cache_key);

-- GIN indexes for JSONB queries
CREATE INDEX idx_cache_data ON cache_table USING GIN(data);

-- Partial indexes for active cache only
CREATE INDEX idx_cache_active
  ON cache_table(cache_key)
  WHERE expires_at > NOW();
```

### Connection Pooling

```typescript
// Use connection pooling for better performance
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Query Optimization

```typescript
// Use prepared statements
const query = {
  name: 'get-cache',
  text: 'SELECT * FROM cache_table WHERE cache_key = $1 AND expires_at > NOW()',
  values: [key],
};
```

## Best Practices

### 1. Set Appropriate TTLs

```typescript
const TTL = {
  SHORT: 300, // 5 minutes - frequently changing data
  MEDIUM: 3600, // 1 hour - moderately stable data
  LONG: 86400, // 24 hours - stable data
  WEEK: 604800, // 7 days - very stable data
};
```

### 2. Use Cache Keys Wisely

```typescript
// Good: Specific, versioned cache keys
const key = `user:${userId}:profile:v2`;

// Bad: Generic cache keys
const key = `profile`;
```

### 3. Handle Cache Misses Gracefully

```typescript
async function getData(key: string) {
  // Try cache first
  const cached = await cache.get(key);
  if (cached) return cached;

  // Fetch from source
  const data = await fetchFromSource();

  // Store in cache
  await cache.set(key, data, TTL.MEDIUM);

  return data;
}
```

### 4. Implement Cache Warming

```typescript
// Pre-populate cache for common queries
async function warmCache() {
  const commonQueries = await getCommonQueries();

  for (const query of commonQueries) {
    const result = await executeQuery(query);
    await cache.set(query.key, result, TTL.LONG);
  }
}
```

## Monitoring and Metrics

### Key Metrics to Track

1. **Cache Hit Rate**: Percentage of requests served from cache
2. **Cache Size**: Total size of cache tables
3. **Query Performance**: Average query time for cache lookups
4. **Expiration Rate**: How often cache entries expire
5. **Cleanup Performance**: Time taken for cache cleanup

### Alerting

Set up alerts for:

- Cache hit rate drops below 70%
- Cache size exceeds 80% of allocated space
- Cache query time exceeds 10ms (p95)
- Cleanup job failures

## Conclusion

PostgreSQL-based caching provides:

- ✅ Simplified infrastructure
- ✅ Lower costs
- ✅ ACID compliance
- ✅ Excellent performance
- ✅ Advanced querying capabilities
- ✅ No additional services to manage

For DigiTwin Live, this approach offers the best balance of performance, simplicity, and cost-effectiveness.

## Additional Resources

- [Caching Architecture](./CACHING-ARCHITECTURE.md) - Detailed architecture
- [Database Architecture](./DATABASE-ARCHITECTURE.md) - Database design
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

## @clone/cache-service Package

### Overview

The `@clone/cache-service` package provides a unified caching interface for all cache operations in DigiTwin Live. It implements the PostgreSQL-based caching strategy with type-safe APIs and automatic cleanup.

### Installation

```bash
pnpm add @clone/cache-service
```

### Usage

```typescript
import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';

const prisma = new PrismaClient();
const cacheManager = new CacheManager(prisma);

// Embedding cache
const embedding = await cacheManager.embedding.get('What is AI?');
if (!embedding) {
  const newEmbedding = await generateEmbedding('What is AI?');
  await cacheManager.embedding.set('What is AI?', { embedding: newEmbedding });
}

// LLM response cache
const llmPrompt = {
  prompt: 'Explain quantum computing',
  context: 'User is a beginner',
  provider: 'gemini-flash',
};
const cachedResponse = await cacheManager.llmResponse.get(llmPrompt);
if (!cachedResponse) {
  const response = await generateLLMResponse(llmPrompt);
  await cacheManager.llmResponse.set(llmPrompt, {
    response,
    provider: 'gemini-flash',
  });
}

// Vector search cache
const searchQuery = {
  embedding: [0.1, 0.2, ...],
  topK: 5,
  userId: 'user-123',
};
const cachedResults = await cacheManager.vectorSearch.get(searchQuery);

// Audio chunk cache
const audioKey = {
  text: 'Hello world',
  voiceModelId: 'voice-123',
  provider: 'xtts-v2',
};
const cachedAudio = await cacheManager.audioChunk.get(audioKey);
```

### Cache Services

#### EmbeddingCacheService

Caches query embeddings to avoid redundant API calls.

- **Default TTL**: 1 hour (CACHE_TTL_MEDIUM)
- **Key**: SHA-256 hash of query text
- **Table**: `embedding_cache`

#### VectorSearchCacheService

Caches vector search results to avoid redundant database queries.

- **Default TTL**: 5 minutes (CACHE_TTL_SHORT)
- **Key**: SHA-256 hash of query embedding + filters + userId
- **Table**: `vector_search_cache`

#### LLMResponseCacheService

Caches LLM responses for FAQs and common queries.

- **Default TTL**: 1 hour (CACHE_TTL_MEDIUM)
- **Key**: SHA-256 hash of prompt + context + provider
- **Table**: `llm_response_cache`
- **Features**: Hit count tracking, top cached responses

#### AudioChunkCacheService

Caches TTS-generated audio chunks to avoid redundant synthesis.

- **Default TTL**: 5 minutes (CACHE_TTL_SHORT)
- **Key**: SHA-256 hash of text + voice model + provider + settings
- **Table**: `audio_chunk_cache`
- **Features**: LRU cleanup, cache statistics, storage path tracking

### Automatic Cleanup

Run cache cleanup regularly using the provided scripts:

```bash
# Clean up all expired cache entries
pnpm cache:cleanup

# View cache statistics
pnpm cache:stats
```

Schedule cleanup with cron:

```bash
# Run every hour
0 * * * * cd /path/to/project && pnpm cache:cleanup
```

### Cache Statistics

Get detailed cache statistics:

```typescript
const stats = await cacheManager.getStats();
console.log('Cache statistics:', stats);
```

Output:

```
=== Cache Statistics ===

Embedding Cache:
  Total Entries: 1234

Vector Search Cache:
  Total Entries: 567

LLM Response Cache:
  Total Entries: 890
  Top Cached Responses:
    1. Hash: a1b2c3d4e5f6g7h8... (45 hits, gemini-flash)
    2. Hash: i9j0k1l2m3n4o5p6... (32 hits, gpt-4-turbo)

Audio Chunk Cache:
  Total Entries: 456
  Total Size: 12.34 MB
  Average Hit Count: 3.45
  Most Accessed:
    1. Hash: q7r8s9t0u1v2w3x4... (78 hits)
    2. Hash: y5z6a7b8c9d0e1f2... (56 hits)

Total Cache Entries: 3147
```

### Cache Warmup

Pre-populate cache with frequently accessed data:

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

### User Cache Invalidation

Invalidate all cache entries for a specific user:

```typescript
await cacheManager.invalidateUser('user-123');
```

### Package Documentation

For detailed documentation, see:

- [packages/cache-service/README.md](../packages/cache-service/README.md)
- Package source: `packages/cache-service/src/`

### Integration Examples

#### RAG Service Integration

```typescript
import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';

export class RAGService {
  private cacheManager: CacheManager;

  constructor(prisma: PrismaClient) {
    this.cacheManager = new CacheManager(prisma);
  }

  async embedQuery(queryText: string): Promise<number[]> {
    // Try cache first
    const cached = await this.cacheManager.embedding.get(queryText);
    if (cached) {
      return cached.embedding;
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(queryText);

    // Store in cache
    await this.cacheManager.embedding.set(queryText, { embedding });

    return embedding;
  }

  async searchVectors(query: VectorSearchQuery): Promise<SearchResult[]> {
    // Try cache first
    const cached = await this.cacheManager.vectorSearch.get(query);
    if (cached) {
      return cached.results;
    }

    // Perform search
    const results = await this.performVectorSearch(query);

    // Store in cache
    await this.cacheManager.vectorSearch.set(query, { results });

    return results;
  }
}
```

#### LLM Service Integration

```typescript
import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';

export class LLMService {
  private cacheManager: CacheManager;

  constructor(prisma: PrismaClient) {
    this.cacheManager = new CacheManager(prisma);
  }

  async generateResponse(llmPrompt: LLMPrompt): Promise<string> {
    // Try cache first
    const cached = await this.cacheManager.llmResponse.get(llmPrompt);
    if (cached) {
      return cached.response;
    }

    // Generate response
    const response = await this.callLLM(llmPrompt);

    // Store in cache
    await this.cacheManager.llmResponse.set(llmPrompt, {
      response,
      provider: llmPrompt.provider,
    });

    return response;
  }
}
```

#### TTS Service Integration

```typescript
import { CacheManager } from '@clone/cache-service';
import { PrismaClient } from '@clone/database';

export class TTSService {
  private cacheManager: CacheManager;

  constructor(prisma: PrismaClient) {
    this.cacheManager = new CacheManager(prisma);
  }

  async synthesize(audioKey: AudioChunkKey): Promise<Buffer> {
    // Try cache first
    const cached = await this.cacheManager.audioChunk.get(audioKey);
    if (cached) {
      return cached.audioData;
    }

    // Synthesize audio
    const audioData = await this.synthesizeAudio(audioKey);

    // Store in cache
    await this.cacheManager.audioChunk.set(audioKey, {
      audioData,
      format: 'opus',
      durationMs: 1000,
      sampleRate: 16000,
      channels: 1,
      compression: 'opus',
    });

    return audioData;
  }
}
```

### Best Practices with @clone/cache-service

1. **Always check cache first**: Implement cache-aside pattern
2. **Use appropriate TTLs**: Short for dynamic data, long for static data
3. **Handle cache misses gracefully**: Always have a fallback
4. **Monitor cache hit rates**: Aim for >70% hit rate
5. **Run cleanup regularly**: Schedule hourly cleanup jobs
6. **Warm up cache on startup**: Pre-populate frequently accessed data
7. **Invalidate on updates**: Clear cache when underlying data changes

### Performance Tips

1. **Batch operations**: Use Promise.all() for multiple cache operations
2. **Use connection pooling**: Configure Prisma connection pool
3. **Monitor query performance**: Use PostgreSQL EXPLAIN ANALYZE
4. **Index optimization**: Ensure proper indexes on cache tables
5. **Cleanup scheduling**: Run cleanup during low-traffic periods
