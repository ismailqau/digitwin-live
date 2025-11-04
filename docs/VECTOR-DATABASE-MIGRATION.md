# Vector Database Migration: Pinecone → PostgreSQL

This document explains the migration from Pinecone to PostgreSQL with pgvector extension for vector storage and similarity search.

## Why PostgreSQL with pgvector?

### Benefits

✅ **Cost-effective**: No separate vector database service fees  
✅ **Simplified infrastructure**: Single database for all data  
✅ **ACID compliance**: Transactional consistency  
✅ **High performance**: Sub-5ms vector similarity searches with proper indexing  
✅ **Familiar tooling**: Standard PostgreSQL tools and monitoring  
✅ **Backup simplicity**: Single database backup strategy  

### Performance Comparison

| Feature | Pinecone | PostgreSQL + pgvector |
|---------|----------|----------------------|
| Query Latency | ~10-50ms | ~2-10ms (with proper indexing) |
| Setup Complexity | Medium | Low |
| Cost (1M vectors) | ~$70/month | ~$20/month |
| ACID Transactions | ❌ | ✅ |
| SQL Queries | ❌ | ✅ |

## Migration Changes

### Environment Variables

**Removed:**
```bash
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX_NAME=digitwin-live
```

**Added:**
```bash
VECTOR_DIMENSIONS=768  # Google text-embedding-004 dimension
VECTOR_INDEX_LISTS=100  # IVFFlat index parameter

# Optional: Weaviate (Self-hosted alternative)
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=
WEAVIATE_ENABLED=false
```

### Database Schema

New table added to Prisma schema:

```prisma
model DocumentChunk {
  id         String   @id @default(uuid())
  documentId String   @map("document_id")
  userId     String   @map("user_id")
  chunkIndex Int      @map("chunk_index")
  content    String   @db.Text
  embedding  String   @db.Text // Vector stored as text for pgvector
  metadata   Json     @default("{}")
  createdAt  DateTime @default(now()) @map("created_at")

  document KnowledgeDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, chunkIndex])
  @@index([userId])
  @@index([documentId])
  @@map("document_chunks")
}
```

### Dependencies

**Removed:**
```json
"@pinecone-database/pinecone": "^1.1.0"
```

**Added:**
```json
"pg": "^8.11.0",
"@types/pg": "^8.10.0"
```

## Setup Instructions

### 1. Install pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Run Database Migration

```bash
# Apply Prisma migrations
pnpm db:migrate

# Setup vector indexes
./scripts/setup-vector-db.sh
```

### 3. Update Application Code

The application will automatically use PostgreSQL for vector operations. No code changes needed for basic functionality.

## Weaviate Alternative

Weaviate remains available as a free self-hosted alternative:

### Docker Setup

```bash
docker run -d \
  --name weaviate \
  -p 8080:8080 \
  -e QUERY_DEFAULTS_LIMIT=25 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  -e PERSISTENCE_DATA_PATH='/var/lib/weaviate' \
  semitechnologies/weaviate:latest
```

### Configuration

```bash
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=  # Leave empty for anonymous access
WEAVIATE_ENABLED=true  # Set to true to use Weaviate
```

## Performance Tuning

### PostgreSQL Configuration

Add to `postgresql.conf`:

```ini
# Memory settings for vector operations
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 64MB

# Enable parallel queries
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
```

### Vector Index Optimization

```sql
-- For better performance with large datasets
CREATE INDEX CONCURRENTLY idx_document_chunks_embedding 
ON document_chunks USING ivfflat (embedding::vector(768)) 
WITH (lists = 1000);  -- Increase lists for larger datasets

-- Analyze table for query planner
ANALYZE document_chunks;
```

## Monitoring

### Query Performance

```sql
-- Check vector query performance
EXPLAIN ANALYZE 
SELECT id, content, embedding <-> '[0.1,0.2,...]'::vector AS distance
FROM document_chunks 
ORDER BY distance 
LIMIT 10;
```

### Index Usage

```sql
-- Check if vector index is being used
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes 
WHERE indexname LIKE '%embedding%';
```

## Troubleshooting

### Common Issues

1. **Slow vector queries**: Ensure pgvector extension is installed and indexes are created
2. **Memory errors**: Increase `work_mem` in PostgreSQL configuration
3. **Index not used**: Run `ANALYZE document_chunks` after bulk inserts

### Performance Benchmarks

Expected performance with proper setup:
- **Vector similarity search**: < 10ms for 100K vectors
- **Bulk insert**: ~1000 vectors/second
- **Memory usage**: ~4 bytes per dimension per vector

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Weaviate Documentation](https://weaviate.io/developers/weaviate)