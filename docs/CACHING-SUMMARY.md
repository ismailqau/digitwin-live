# Caching Implementation Summary

## Overview

**DigitWin Live uses PostgreSQL indexed cache tables for caching** instead of a separate caching service like Redis or Memcached.

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

| Operation | PostgreSQL Cache | Redis |
|-----------|-----------------|-------|
| Simple GET | ~1-2ms | ~0.5-1ms |
| Complex Query | ~2-5ms | N/A (requires app logic) |
| JSONB Query | ~2-3ms | N/A |
| Transactional | ✅ Yes | ❌ No |
| Persistence | ✅ Built-in | ⚠️ Optional |

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
    expires_at: { gt: new Date() }
  }
});

// Set cache
await db.cache_vector_searches.create({
  data: {
    user_id: userId,
    query_hash: hash,
    results: results,
    expires_at: new Date(Date.now() + ttl)
  }
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
  values: [key]
};
```

## Best Practices

### 1. Set Appropriate TTLs

```typescript
const TTL = {
  SHORT: 300,      // 5 minutes - frequently changing data
  MEDIUM: 3600,    // 1 hour - moderately stable data
  LONG: 86400,     // 24 hours - stable data
  WEEK: 604800,    // 7 days - very stable data
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

For DigitWin Live, this approach offers the best balance of performance, simplicity, and cost-effectiveness.

## Additional Resources

- [Caching Architecture](./CACHING-ARCHITECTURE.md) - Detailed architecture
- [Database Architecture](./DATABASE-ARCHITECTURE.md) - Database design
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
