# PostgreSQL-Based Caching Architecture

## Overview

The DigitWin Live platform uses **PostgreSQL indexed cache tables** instead of a separate caching service like Redis. This approach simplifies the infrastructure while providing excellent performance through PostgreSQL's advanced indexing capabilities.

## Design Decision

According to the system design document:

> "PostgreSQL-based rate limiting with indexed rate_limits table"  
> "Implement query result caching (PostgreSQL with indexed cache tables)"

The platform uses PostgreSQL indexed cache tables instead of Redis for caching.

## Why PostgreSQL Instead of Redis?

### Advantages

1. **Simplified Infrastructure**
   - No additional service to manage
   - Fewer connection pools to maintain
   - Reduced operational complexity

2. **ACID Compliance**
   - Transactional consistency with main data
   - Atomic cache invalidation
   - No cache coherency issues

3. **Advanced Querying**
   - Complex cache lookups with SQL
   - Join cache data with main tables
   - Flexible expiration policies

4. **Cost Effective**
   - No separate cache service costs
   - Leverage existing database resources
   - Better resource utilization

5. **Unified Monitoring**
   - Single database to monitor
   - Consistent backup strategy
   - Simplified disaster recovery

## Cache Tables

### Structure

All cache tables follow a consistent structure:

```sql
CREATE TABLE cache_<type> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  cache_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_cache_<type>_key ON cache_<type>(cache_key);
CREATE INDEX idx_cache_<type>_expires ON cache_<type>(expires_at);
CREATE INDEX idx_cache_<type>_accessed ON cache_<type>(last_accessed_at);
```

### Cache Types

#### 1. Embeddings Cache (`cache_embeddings`)

```sql
CREATE TABLE cache_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,  -- Hash of text content
  embedding VECTOR(1536) NOT NULL,          -- Vector embedding
  model VARCHAR(100) NOT NULL,              -- Model used (e.g., 'text-embedding-3-small')
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX idx_cache_embeddings_key ON cache_embeddings(cache_key);
CREATE INDEX idx_cache_embeddings_expires ON cache_embeddings(expires_at);
```

**Use Case**: Cache embeddings for frequently queried text to avoid re-computing.

#### 2. LLM Responses Cache (`cache_llm_responses`)

```sql
CREATE TABLE cache_llm_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,  -- Hash of prompt + context
  response TEXT NOT NULL,
  model VARCHAR(100) NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX idx_cache_llm_key ON cache_llm_responses(cache_key);
CREATE INDEX idx_cache_llm_expires ON cache_llm_responses(expires_at);
```

**Use Case**: Cache LLM responses for common questions to reduce API costs.

#### 3. Vector Search Cache (`cache_vector_search`)

```sql
CREATE TABLE cache_vector_search (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,  -- Hash of query vector + filters
  results JSONB NOT NULL,                   -- Array of search results
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX idx_cache_vector_key ON cache_vector_search(cache_key);
CREATE INDEX idx_cache_vector_expires ON cache_vector_search(expires_at);
```

**Use Case**: Cache vector search results for frequently asked questions.

#### 4. Audio Chunks Cache (`cache_audio_chunks`)

```sql
CREATE TABLE cache_audio_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,  -- Hash of text + voice settings
  audio_data BYTEA NOT NULL,
  format VARCHAR(20) NOT NULL,              -- 'opus', 'mp3', etc.
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX idx_cache_audio_key ON cache_audio_chunks(cache_key);
CREATE INDEX idx_cache_audio_expires ON cache_audio_chunks(expires_at);
```

**Use Case**: Cache TTS audio for common phrases to reduce generation time.

## Cache Operations

### Setting Cache

```typescript
async function setCache(type: string, key: string, value: any, ttl: number = 3600): Promise<void> {
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await db.query(
    `
    INSERT INTO cache_${type} (cache_key, cache_value, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (cache_key) 
    DO UPDATE SET 
      cache_value = $2,
      expires_at = $3,
      hit_count = cache_${type}.hit_count + 1,
      last_accessed_at = NOW()
  `,
    [key, JSON.stringify(value), expiresAt]
  );
}
```

### Getting Cache

```typescript
async function getCache(type: string, key: string): Promise<any | null> {
  const result = await db.query(
    `
    UPDATE cache_${type}
    SET 
      hit_count = hit_count + 1,
      last_accessed_at = NOW()
    WHERE cache_key = $1 
      AND expires_at > NOW()
    RETURNING cache_value
  `,
    [key]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return JSON.parse(result.rows[0].cache_value);
}
```

### Invalidating Cache

```typescript
// Invalidate specific key
async function invalidateCache(type: string, key: string): Promise<void> {
  await db.query(
    `
    DELETE FROM cache_${type}
    WHERE cache_key = $1
  `,
    [key]
  );
}

// Invalidate by pattern
async function invalidateCachePattern(type: string, pattern: string): Promise<void> {
  await db.query(
    `
    DELETE FROM cache_${type}
    WHERE cache_key LIKE $1
  `,
    [pattern]
  );
}

// Clear expired entries
async function clearExpiredCache(type: string): Promise<void> {
  await db.query(`
    DELETE FROM cache_${type}
    WHERE expires_at < NOW()
  `);
}
```

## Cache TTL Strategy

### TTL Configuration

```bash
# Short TTL (5 minutes) - Frequently changing data
CACHE_TTL_SHORT=300

# Medium TTL (1 hour) - Moderately stable data
CACHE_TTL_MEDIUM=3600

# Long TTL (24 hours) - Rarely changing data
CACHE_TTL_LONG=86400
```

### TTL by Cache Type

| Cache Type    | TTL         | Reason                                |
| ------------- | ----------- | ------------------------------------- |
| Embeddings    | Long (24h)  | Embeddings don't change for same text |
| LLM Responses | Medium (1h) | Responses may need updates            |
| Vector Search | Medium (1h) | Knowledge base may be updated         |
| Audio Chunks  | Long (24h)  | Audio doesn't change for same input   |

## Performance Optimization

### Indexes

All cache tables have indexes on:

- `cache_key` - Fast lookups
- `expires_at` - Fast expiration cleanup
- `last_accessed_at` - LRU eviction

### Automatic Cleanup

Run periodic cleanup to remove expired entries:

```sql
-- Cleanup job (run every hour)
DELETE FROM cache_embeddings WHERE expires_at < NOW();
DELETE FROM cache_llm_responses WHERE expires_at < NOW();
DELETE FROM cache_vector_search WHERE expires_at < NOW();
DELETE FROM cache_audio_chunks WHERE expires_at < NOW();
```

### LRU Eviction

If cache tables grow too large, implement LRU eviction:

```sql
-- Keep only most recently accessed entries
DELETE FROM cache_embeddings
WHERE id IN (
  SELECT id FROM cache_embeddings
  ORDER BY last_accessed_at ASC
  LIMIT (
    SELECT COUNT(*) - 10000
    FROM cache_embeddings
  )
);
```

## Monitoring

### Cache Hit Rate

```sql
SELECT
  'embeddings' as cache_type,
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_entries
FROM cache_embeddings

UNION ALL

SELECT
  'llm_responses',
  COUNT(*),
  SUM(hit_count),
  AVG(hit_count),
  COUNT(*) FILTER (WHERE expires_at > NOW())
FROM cache_llm_responses;
```

### Cache Size

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'cache_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Cache Performance

```sql
-- Most frequently accessed cache entries
SELECT
  cache_key,
  hit_count,
  created_at,
  last_accessed_at
FROM cache_embeddings
ORDER BY hit_count DESC
LIMIT 10;
```

## Migration from Redis

If migrating from Redis to PostgreSQL caching:

1. **Create cache tables**

   ```sql
   -- Run migration scripts to create cache tables
   ```

2. **Update application code**

   ```typescript
   // Replace Redis calls with PostgreSQL cache functions
   // Before: await redis.get(key)
   // After: await getCache('embeddings', key)
   ```

3. **Remove Redis dependencies**

   ```bash
   # Remove Redis from package.json
   npm uninstall redis ioredis

   # Remove Redis environment variables
   # REDIS_URL, REDIS_HOST, etc.
   ```

4. **Update deployment**
   ```yaml
   # Remove Redis service from docker-compose.yml
   # Remove Redis from Kubernetes manifests
   ```

## Best Practices

1. **Use appropriate TTLs**
   - Short TTL for frequently changing data
   - Long TTL for stable data

2. **Implement cache warming**
   - Pre-populate cache for common queries
   - Warm cache after deployments

3. **Monitor cache hit rates**
   - Track cache effectiveness
   - Adjust TTLs based on hit rates

4. **Regular cleanup**
   - Schedule periodic cleanup jobs
   - Implement LRU eviction if needed

5. **Cache key design**
   - Use consistent hashing for keys
   - Include version in keys for easy invalidation

## Troubleshooting

### Low Cache Hit Rate

```sql
-- Check if entries are expiring too quickly
SELECT
  AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_ttl_seconds
FROM cache_embeddings;

-- Increase TTL if needed
UPDATE cache_embeddings
SET expires_at = expires_at + INTERVAL '1 hour'
WHERE expires_at > NOW();
```

### Cache Growing Too Large

```sql
-- Check cache size
SELECT pg_size_pretty(pg_total_relation_size('cache_embeddings'));

-- Implement aggressive cleanup
DELETE FROM cache_embeddings
WHERE last_accessed_at < NOW() - INTERVAL '7 days';
```

### Slow Cache Lookups

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM cache_embeddings
WHERE cache_key = 'test-key' AND expires_at > NOW();

-- Rebuild indexes if needed
REINDEX TABLE cache_embeddings;
```

## Conclusion

PostgreSQL-based caching provides a robust, performant, and cost-effective solution for the DigitWin Live platform. By leveraging PostgreSQL's advanced indexing and JSONB support, we achieve excellent cache performance without the complexity of managing a separate caching service.
