# Database Setup Guide

This guide walks you through setting up PostgreSQL with pgvector for the DigiTwin Live application.

## Prerequisites

- PostgreSQL 15+ installed (locally or Cloud SQL)
- Cloud SQL Auth Proxy (if using GCP Cloud SQL)
- pnpm package manager
- psql command-line tool

## Quick Start

### 1. Start Cloud SQL Proxy (if using Cloud SQL)

```bash
# Start the proxy in a separate terminal
cloud-sql-proxy digitwinlive:us-central1:digitwinlive-db --port=5433

# Or run in background
cloud-sql-proxy digitwinlive:us-central1:digitwinlive-db --port=5433 &
```

### 2. Verify Connection

```bash
# Test connection
psql "host=127.0.0.1 port=5433 dbname=digitwinlive-db user=postgres"
```

### 3. Enable pgvector Extension

```sql
-- Run this in psql
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 4. Run Migrations

```bash
# Using the helper script (recommended)
./scripts/db-migrate.sh

# Or manually
pnpm db:migrate
```

### 5. Verify Setup

```bash
# Check tables were created
psql "host=127.0.0.1 port=5433 dbname=digitwinlive-db user=postgres" -c "\dt"

# Check vector columns exist
psql "host=127.0.0.1 port=5433 dbname=digitwinlive-db user=postgres" -c "\d document_chunks"
psql "host=127.0.0.1 port=5433 dbname=digitwinlive-db user=postgres" -c "\d embedding_cache"

# Check vector indexes
psql "host=127.0.0.1 port=5433 dbname=digitwinlive-db user=postgres" -c "\di *vector*"
```

## Environment Configuration

### Local PostgreSQL

```env
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/digitwinlive-db
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=digitwinlive-db
DATABASE_USER=postgres
DATABASE_PASSWORD=your-password
```

### Cloud SQL (via Proxy)

```env
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5433/digitwinlive-db
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433
DATABASE_NAME=digitwinlive-db
DATABASE_USER=postgres
DATABASE_PASSWORD=your-cloud-sql-password
```

### Cloud SQL (Direct Connection from Cloud Run)

```env
DATABASE_URL=postgresql://postgres:password@/digitwinlive-db?host=/cloudsql/PROJECT:REGION:INSTANCE
```

## Database Schema

### Tables with Vector Columns

#### document_chunks

- **Purpose**: Stores document chunks with embeddings for RAG
- **Vector Column**: `embedding_vector vector(768)`
- **Index**: IVFFlat with cosine similarity
- **Usage**: Semantic search for document retrieval

```sql
-- Example query
SELECT id, content,
       1 - (embedding_vector <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM document_chunks
WHERE user_id = 'user-123'
ORDER BY embedding_vector <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

#### embedding_cache

- **Purpose**: Caches embeddings to reduce API calls
- **Vector Column**: `embedding_vector vector(768)`
- **Index**: IVFFlat with cosine similarity
- **Usage**: Fast embedding lookup by query hash

```sql
-- Example query
SELECT embedding_vector
FROM embedding_cache
WHERE query_hash = 'hash-of-query'
  AND expires_at > NOW();
```

## Migration Commands

```bash
# Run migrations (development)
pnpm db:migrate

# Deploy migrations (production)
pnpm db:migrate:deploy

# Reset database (WARNING: deletes all data)
pnpm db:reset

# Generate Prisma client
pnpm db:generate

# Open Prisma Studio
pnpm db:studio

# Check migration status
pnpm --filter @clone/database prisma migrate status
```

## Troubleshooting

### Error: "relation does not exist"

This means migrations haven't been run yet.

**Solution:**

```bash
pnpm db:migrate
```

### Error: "type 'vector' does not exist"

The pgvector extension isn't enabled.

**Solution:**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: "could not connect to server"

Cloud SQL Proxy isn't running or connection details are wrong.

**Solution:**

```bash
# Check if proxy is running
lsof -i :5433

# Start proxy if not running
cloud-sql-proxy digitwinlive:us-central1:digitwinlive-db --port=5433
```

### Error: "password authentication failed"

Wrong password in DATABASE_URL.

**Solution:**

1. Check password in Secret Manager: `gcloud secrets versions access latest --secret=database-password`
2. Update .env file with correct password
3. Verify connection: `psql "host=127.0.0.1 port=5433 dbname=digitwinlive-db user=postgres"`

### Error: "invalid_rapt" when using Cloud SQL Proxy

Using wrong authentication method.

**Solution:**

```bash
# Revoke old credentials
gcloud auth application-default revoke

# Login with application default credentials
gcloud auth application-default login

# Restart Cloud SQL Proxy
```

## Vector Operations

### Similarity Search

```sql
-- Cosine similarity (most common for embeddings)
SELECT * FROM document_chunks
ORDER BY embedding_vector <=> '[...]'::vector
LIMIT 10;

-- L2 distance
SELECT * FROM document_chunks
ORDER BY embedding_vector <-> '[...]'::vector
LIMIT 10;

-- Inner product
SELECT * FROM document_chunks
ORDER BY embedding_vector <#> '[...]'::vector
LIMIT 10;
```

### Index Tuning

```sql
-- Adjust IVFFlat lists parameter based on data size
-- Rule of thumb: lists = sqrt(total_rows)

-- For 10,000 rows: lists = 100
-- For 100,000 rows: lists = 316
-- For 1,000,000 rows: lists = 1000

-- Recreate index with different lists value
DROP INDEX document_chunks_embedding_vector_idx;
CREATE INDEX document_chunks_embedding_vector_idx
ON document_chunks USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 316);
```

## Performance Tips

1. **Use appropriate lists parameter**: `lists = sqrt(total_rows)`
2. **Batch inserts**: Use `createMany` for bulk operations
3. **Filter before vector search**: Add WHERE clauses to reduce search space
4. **Monitor query performance**: Use `EXPLAIN ANALYZE`
5. **Regular VACUUM**: Keep indexes optimized

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM document_chunks
WHERE user_id = 'user-123'
ORDER BY embedding_vector <=> '[...]'::vector
LIMIT 5;

-- Vacuum and analyze
VACUUM ANALYZE document_chunks;
VACUUM ANALYZE embedding_cache;
```

## Backup and Restore

### Cloud SQL Automated Backups

Backups are configured automatically:

- **Frequency**: Daily at 03:00 UTC
- **Retention**: 7 days (configurable)
- **Location**: Same region as instance

### Manual Backup

```bash
# Export database
gcloud sql export sql digitwinlive-db \
  gs://your-bucket/backups/backup-$(date +%Y%m%d).sql \
  --database=digitwinlive-db

# Import database
gcloud sql import sql digitwinlive-db \
  gs://your-bucket/backups/backup-20231206.sql \
  --database=digitwinlive-db
```

### Local Backup

```bash
# Backup
pg_dump -h 127.0.0.1 -p 5433 -U postgres digitwinlive-db > backup.sql

# Restore
psql -h 127.0.0.1 -p 5433 -U postgres digitwinlive-db < backup.sql
```

## Security Best Practices

1. **Use Secret Manager**: Store passwords in GCP Secret Manager
2. **Rotate passwords**: Regularly update database passwords
3. **Limit connections**: Use connection pooling (Prisma handles this)
4. **Enable SSL**: Use SSL for production connections
5. **Audit logs**: Monitor database access via audit_logs table
6. **User isolation**: All queries filter by userId

## Monitoring

### Check Database Size

```sql
SELECT
  pg_size_pretty(pg_database_size('digitwinlive-db')) as db_size;
```

### Check Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Index Usage

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs/postgres)
