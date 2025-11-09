# Vector Database Guide

Complete guide for vector database setup, migration, and verification.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Setup Options](#setup-options)
- [Migration from Pinecone](#migration-from-pinecone)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Overview

This project uses vector databases for storing and searching document embeddings. You have two options:

### PostgreSQL with pgvector (Recommended for Production)
- **Cost-effective**: No separate service fees
- **High performance**: Sub-10ms queries with proper indexing
- **ACID compliance**: Transactional consistency
- **Requires**: PostgreSQL 15+ with pgvector extension

### Weaviate (Free Self-hosted Alternative)
- **Easy setup**: Docker container
- **Free**: No licensing costs
- **Good performance**: 5-20ms queries
- **Requires**: Docker

## Quick Start

### Option A: Weaviate (Fastest Setup)

```bash
# 1. Start Weaviate
docker run -d --name weaviate -p 8080:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  -v weaviate_data:/var/lib/weaviate \
  semitechnologies/weaviate:latest

# 2. Configure environment
echo "WEAVIATE_URL=http://localhost:8080" >> .env
echo "WEAVIATE_ENABLED=true" >> .env

# 3. Verify
pnpm verify:vector-db
```

### Option B: PostgreSQL + pgvector

```bash
# 1. Install pgvector
brew install pgvector  # macOS
# or
sudo apt install postgresql-15-pgvector  # Ubuntu

# 2. Enable extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3. Configure environment
echo "WEAVIATE_ENABLED=false" >> .env
echo "VECTOR_DIMENSIONS=768" >> .env
echo "VECTOR_INDEX_LISTS=100" >> .env

# 4. Verify
pnpm verify:vector-db
```

## Setup Options

### PostgreSQL with pgvector

#### Installation

**macOS**:
```bash
brew install pgvector
```

**Ubuntu/Debian**:
```bash
sudo apt install postgresql-15-pgvector
```

**From Source**:
```bash
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

#### Configuration

1. **Enable extension**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. **Environment variables**:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
VECTOR_DIMENSIONS=768
VECTOR_INDEX_LISTS=100
WEAVIATE_ENABLED=false
```

3. **Run migrations**:
```bash
pnpm db:migrate
pnpm db:generate
```

#### Performance Tuning

Add to `postgresql.conf`:
```ini
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 64MB
max_parallel_workers_per_gather = 2
```

### Weaviate

#### Installation

**Docker (Recommended)**:
```bash
docker run -d \
  --name weaviate \
  -p 8080:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  -e PERSISTENCE_DATA_PATH='/var/lib/weaviate' \
  -v weaviate_data:/var/lib/weaviate \
  semitechnologies/weaviate:latest
```

**Docker Compose**:
```yaml
version: '3.4'
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    ports:
      - "8080:8080"
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
    volumes:
      - weaviate_data:/var/lib/weaviate
volumes:
  weaviate_data:
```

#### Configuration

**Environment variables**:
```bash
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=  # Leave empty for anonymous access
WEAVIATE_ENABLED=true
```

#### Management

```bash
# Check status
docker ps | grep weaviate

# View logs
docker logs weaviate

# Stop
docker stop weaviate

# Start
docker start weaviate

# Restart
docker restart weaviate
```

## Migration from Pinecone

### Why Migrate?

| Feature | Pinecone | PostgreSQL + pgvector | Weaviate |
|---------|----------|----------------------|----------|
| Query Latency | 10-50ms | 2-10ms | 5-20ms |
| Cost (1M vectors) | ~$70/month | ~$20/month | Free |
| Setup Complexity | Medium | Low | Very Low |
| ACID Transactions | ❌ | ✅ | ❌ |

### Migration Steps

1. **Update environment variables**:

**Remove**:
```bash
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX_NAME=...
```

**Add**:
```bash
# For PostgreSQL
VECTOR_DIMENSIONS=768
VECTOR_INDEX_LISTS=100
WEAVIATE_ENABLED=false

# OR for Weaviate
WEAVIATE_URL=http://localhost:8080
WEAVIATE_ENABLED=true
```

2. **Update dependencies**:
```bash
cd services/rag-service
pnpm remove @pinecone-database/pinecone
pnpm add pg @types/pg  # For PostgreSQL
```

3. **Run database migrations**:
```bash
pnpm db:migrate
pnpm db:generate
```

4. **Verify setup**:
```bash
pnpm verify:vector-db
```

### Migration Checklist

- [ ] Environment variables updated
- [ ] Pinecone dependencies removed
- [ ] PostgreSQL/Weaviate dependencies added
- [ ] Database migrations run
- [ ] Vector database running
- [ ] Verification passed
- [ ] Documentation updated

## Verification

### Quick Verification

```bash
# Fast local check
pnpm verify:local

# Comprehensive verification
pnpm verify:vector-db

# Quick health check
pnpm health:vector-db
```

### Verification Scripts

#### `pnpm verify:local`
**Purpose**: Quick daily checks
**Checks**:
- Prerequisites (Node.js, Docker, psql)
- PostgreSQL connection
- Weaviate accessibility
- Basic configuration

#### `pnpm verify:vector-db`
**Purpose**: Comprehensive verification
**Checks**:
- All environment variables
- PostgreSQL + pgvector extension
- Weaviate connectivity and schema
- GCP configuration
- Vector operations
- Database schema

#### `pnpm health:vector-db`
**Purpose**: Production monitoring
**Output formats**: JSON, text, Prometheus
**Checks**:
- Database connectivity
- Response time
- Basic operations

### Expected Output

**Successful verification**:
```bash
🔍 Vector Database Verification

📋 Environment Variables
✅ DATABASE_URL is set
✅ WEAVIATE_ENABLED = true

🕸️  Weaviate Configuration
✅ Weaviate is accessible
✅ Weaviate version: 1.34.0

📊 Verification Summary
✅ Passed: 18
⚠️  Warnings: 0
❌ Failed: 0

🎉 Vector database verification completed successfully!
```

### GCP Verification

For production GCP environments:

```bash
# Set GCP project
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1

# Run GCP tests
pnpm test:gcp
```

**Tests**:
- GCP authentication
- Cloud SQL with pgvector
- Weaviate in GKE
- Cloud Run services
- IAM permissions

## Troubleshooting

### PostgreSQL Issues

#### pgvector extension not found
**Error**: `could not open extension control file`

**Solution**:
```bash
# Install pgvector for your PostgreSQL version
brew install pgvector  # macOS
sudo apt install postgresql-15-pgvector  # Ubuntu

# Enable extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### Database connection failed
**Error**: `database does not exist`

**Solution**:
```bash
# Create database
createdb digitwinline_dev

# Run migrations
pnpm db:migrate
pnpm db:generate
```

#### DocumentChunk table missing
**Error**: `table does not exist`

**Solution**:
```bash
pnpm db:migrate
pnpm db:generate
```

### Weaviate Issues

#### Connection refused
**Error**: `connect ECONNREFUSED 127.0.0.1:8080`

**Solution**:
```bash
# Check if Docker is running
docker info

# Start Weaviate
docker run -d --name weaviate -p 8080:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  semitechnologies/weaviate:latest

# Verify
curl http://localhost:8080/v1/meta
```

#### Port already in use
**Error**: `port 8080 already in use`

**Solution**:
```bash
# Use different port
docker run -d --name weaviate -p 8081:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  semitechnologies/weaviate:latest

# Update .env
WEAVIATE_URL=http://localhost:8081
```

#### Container already exists
**Error**: `container name already in use`

**Solution**:
```bash
# Remove old container
docker rm weaviate

# Or use different name
docker run -d --name weaviate-dev -p 8080:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  semitechnologies/weaviate:latest
```

### GCP Issues

#### Not authenticated
**Error**: `Not authenticated with gcloud`

**Solution**:
```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

#### Cloud SQL instance not found
**Error**: `instance not found`

**Solution**:
```bash
# Check instance exists
gcloud sql instances list

# Verify connection string
echo $DATABASE_URL
```

## Performance Comparison

### Query Performance

| Operation | PostgreSQL + pgvector | Weaviate |
|-----------|----------------------|----------|
| Single vector search | 2-10ms | 5-20ms |
| Batch search (10 queries) | 20-50ms | 50-100ms |
| Insert 1000 vectors | 1-2s | 2-3s |

### Resource Usage

| Metric | PostgreSQL + pgvector | Weaviate |
|--------|----------------------|----------|
| Memory (1M vectors) | ~4GB | ~6GB |
| Disk (1M vectors) | ~2GB | ~3GB |
| CPU (idle) | <5% | <10% |

## Best Practices

### Development
- Use Weaviate for quick setup
- Run `pnpm verify:local` before commits
- Keep Docker running during development

### Production
- Use PostgreSQL + pgvector for better performance
- Set up monitoring with `pnpm health:vector-db`
- Configure proper backups
- Use connection pooling
- Monitor query performance

### Monitoring
```bash
# Add to cron for monitoring
*/5 * * * * pnpm health:vector-db json > /var/log/vector-db-health.log
```

## Environment Variables Reference

### PostgreSQL + pgvector
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
VECTOR_DIMENSIONS=768
VECTOR_INDEX_LISTS=100
WEAVIATE_ENABLED=false
```

### Weaviate
```bash
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=  # Optional
WEAVIATE_ENABLED=true
```

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Weaviate Documentation](https://weaviate.io/developers/weaviate)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Getting Started](./GETTING-STARTED.md)

## Support

For issues:
1. Run `pnpm verify:vector-db` for detailed diagnostics
2. Check logs: `docker logs weaviate` or PostgreSQL logs
3. Review [Troubleshooting Guide](./TROUBLESHOOTING.md)
4. Check verification results: `cat vector-db-verification-results.json`