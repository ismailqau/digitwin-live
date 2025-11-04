---
inclusion: always
---

# Caching Guidelines

## Cache Implementation

**IMPORTANT**: This project uses **PostgreSQL indexed cache tables** for caching, NOT Redis or Memcached.

### Why PostgreSQL Cache?

1. **Simplified Infrastructure**: No separate caching service to manage
2. **Cost Effective**: Single database for data and cache
3. **ACID Compliance**: Transactional consistency
4. **Advanced Querying**: SQL and JSONB support
5. **Excellent Performance**: Proper indexing provides sub-5ms lookups

### Cache Tables

All cache tables follow this pattern:

```sql
CREATE TABLE cache_<type> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) NOT NULL,
  cache_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_cache_<type>_key ON cache_<type>(cache_key);
CREATE INDEX idx_cache_<type>_expires ON cache_<type>(expires_at);
```

### Usage in Code

```typescript
// Get from cache
const cached = await db.cache_table.findFirst({
  where: {
    cache_key: key,
    expires_at: { gt: new Date() }
  }
});

// Set cache
await db.cache_table.create({
  data: {
    cache_key: key,
    cache_value: value,
    expires_at: new Date(Date.now() + ttl * 1000)
  }
});

// Delete from cache
await db.cache_table.deleteMany({
  where: { cache_key: key }
});
```

### Environment Variables

```bash
ENABLE_CACHING=true
CACHE_TTL_SHORT=300      # 5 minutes
CACHE_TTL_MEDIUM=3600    # 1 hour
CACHE_TTL_LONG=86400     # 24 hours
```

### DO NOT Use

❌ Redis  
❌ Memcached  
❌ In-memory caching libraries (node-cache, etc.) for persistent cache  

### When to Cache

✅ Vector search results  
✅ LLM responses  
✅ Audio chunks  
✅ Embeddings  
✅ API responses  

### Cache Cleanup

Implement automatic cleanup:

```typescript
// Run periodically (e.g., every hour)
await db.$executeRaw`
  DELETE FROM cache_vector_searches WHERE expires_at < NOW();
  DELETE FROM cache_llm_responses WHERE expires_at < NOW();
  DELETE FROM cache_audio_chunks WHERE expires_at < NOW();
`;
```

## References

- [Caching Summary](../../docs/CACHING-SUMMARY.md)
- [Caching Architecture](../../docs/CACHING-ARCHITECTURE.md)
- [Database Architecture](../../docs/DATABASE-ARCHITECTURE.md)
