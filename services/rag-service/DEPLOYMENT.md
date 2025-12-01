# RAG Service Deployment Guide

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+ with pgvector extension
- OpenAI API key

### Setup

1. **Install pgvector extension:**

```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Configure environment variables:**

```bash
# Copy example env file
cp .env.example .env

# Edit .env and set:
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
OPENAI_API_KEY=your-openai-api-key
RAG_SERVICE_PORT=3002
```

4. **Build the service:**

```bash
pnpm build
```

5. **Run tests:**

```bash
pnpm test
```

6. **Start the service:**

```bash
# Development mode (with hot reload)
pnpm dev

# Production mode
pnpm start
```

7. **Verify the service is running:**

```bash
# Health check
curl http://localhost:3002/api/v1/rag/health

# API documentation
open http://localhost:3002/api/v1/rag/docs
```

## GCP Cloud Run Deployment

### Prerequisites

- GCP project with billing enabled
- Cloud SQL PostgreSQL instance with pgvector
- Artifact Registry repository
- gcloud CLI installed and configured

### Deployment Steps

1. **Build and push Docker image:**

```bash
# Set project ID
export PROJECT_ID=your-project-id

# Build image
gcloud builds submit --tag gcr.io/$PROJECT_ID/rag-service

# Or use Artifact Registry
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/digitwinlive/rag-service
```

2. **Deploy to Cloud Run:**

```bash
gcloud run deploy rag-service \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/digitwinlive/rag-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-cloudsql-instances=$PROJECT_ID:us-central1:clone-db-prod \
  --set-secrets DATABASE_URL=database-url:latest \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest
```

3. **Configure secrets in Secret Manager:**

```bash
# Create database URL secret
echo -n "postgresql://user:pass@/dbname?host=/cloudsql/$PROJECT_ID:us-central1:clone-db-prod" | \
  gcloud secrets create database-url --data-file=-

# Create OpenAI API key secret
echo -n "your-openai-api-key" | \
  gcloud secrets create openai-api-key --data-file=-

# Grant Cloud Run service account access
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

4. **Verify deployment:**

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe rag-service --region us-central1 --format 'value(status.url)')

# Health check
curl $SERVICE_URL/api/v1/rag/health

# API documentation
echo "API Docs: $SERVICE_URL/api/v1/rag/docs"
```

## Environment Variables

### Required

- `DATABASE_URL` - PostgreSQL connection string with pgvector
- `OPENAI_API_KEY` - OpenAI API key for embeddings

### Optional

- `RAG_SERVICE_PORT` - Port to listen on (default: 3002, Cloud Run uses 8080)
- `RAG_SERVICE_HOST` - Host to bind to (default: 0.0.0.0)
- `NODE_ENV` - Environment (development, production, test)
- `VECTOR_DIMENSIONS` - Embedding dimensions (default: 1536)
- `VECTOR_INDEX_LISTS` - IVFFlat index lists (default: 100)
- `RAG_CHUNK_SIZE` - Document chunk size (default: 1000)
- `RAG_CHUNK_OVERLAP` - Chunk overlap (default: 200)
- `RAG_MAX_RESULTS` - Max search results (default: 10)
- `SIMILARITY_THRESHOLD` - Minimum similarity score (default: 0.7)
- `ENABLE_CACHING` - Enable PostgreSQL caching (default: true)
- `CACHE_TTL_SHORT` - Short cache TTL in seconds (default: 300)
- `CACHE_TTL_MEDIUM` - Medium cache TTL in seconds (default: 3600)
- `CACHE_TTL_LONG` - Long cache TTL in seconds (default: 86400)
- `GCP_PROJECT_ID` - GCP project ID
- `GCP_REGION` - GCP region (default: us-central1)
- `CORS_ORIGIN` - CORS allowed origins (default: \*)

## Health Checks

### Kubernetes/Cloud Run

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/rag/health/live
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/v1/rag/health/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Monitoring

### Key Metrics

- Request latency (p50, p95, p99)
- Error rate
- Database connection pool usage
- Vector search performance
- Cache hit rate
- Memory usage
- CPU usage

### Logging

Logs are structured JSON and include:

- Request ID
- User ID (if authenticated)
- Endpoint
- Method
- Status code
- Duration
- Error details (if any)

### Alerts

Set up alerts for:

- Error rate > 5%
- p99 latency > 1000ms
- Database connection failures
- Memory usage > 80%
- CPU usage > 80%

## Scaling

### Horizontal Scaling

Cloud Run automatically scales based on:

- Request concurrency (80 per instance)
- CPU utilization
- Memory usage

Configure scaling:

```bash
gcloud run services update rag-service \
  --min-instances 1 \
  --max-instances 20 \
  --concurrency 80
```

### Database Scaling

PostgreSQL with pgvector scales well with:

- Connection pooling (use PgBouncer)
- Read replicas for search queries
- Proper indexing (IVFFlat for vectors)
- Regular VACUUM and ANALYZE

## Troubleshooting

### Service won't start

1. Check logs: `gcloud run services logs read rag-service`
2. Verify DATABASE_URL is correct
3. Ensure pgvector extension is installed
4. Check OpenAI API key is valid

### Slow search performance

1. Verify vector index exists:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'document_chunks';
   ```
2. Increase `VECTOR_INDEX_LISTS` for better accuracy
3. Enable caching with `ENABLE_CACHING=true`
4. Check database connection pool size

### High memory usage

1. Reduce `RAG_MAX_RESULTS`
2. Decrease `RAG_CHUNK_SIZE`
3. Enable caching to reduce embedding generation
4. Increase Cloud Run memory allocation

## Cost Optimization

### Cloud Run

- Use min-instances=0 for development
- Use min-instances=1+ for production (avoid cold starts)
- Set appropriate memory/CPU limits
- Use request-based pricing

### Database

- Use Cloud SQL with appropriate machine type
- Enable automatic storage increase
- Use connection pooling
- Regular maintenance (VACUUM, ANALYZE)

### OpenAI API

- Enable embedding caching (PostgreSQL-based)
- Batch embedding generation when possible
- Monitor API usage and costs

## Security

### Best Practices

1. **Secrets Management:**
   - Use GCP Secret Manager for sensitive data
   - Never commit secrets to version control
   - Rotate secrets regularly

2. **Network Security:**
   - Use VPC connector for Cloud SQL
   - Enable Cloud Armor for DDoS protection
   - Restrict CORS origins in production

3. **Authentication:**
   - Implement API key authentication
   - Use IAM for service-to-service auth
   - Rate limit requests

4. **Data Protection:**
   - Enable SSL for database connections
   - Encrypt data at rest
   - Regular backups

## Backup and Recovery

### Database Backups

```bash
# Manual backup
gcloud sql backups create --instance=clone-db-prod

# Automated backups (configured during instance creation)
gcloud sql instances patch clone-db-prod \
  --backup-start-time=03:00 \
  --enable-bin-log
```

### Disaster Recovery

1. **Database Restore:**

   ```bash
   gcloud sql backups restore BACKUP_ID \
     --backup-instance=clone-db-prod \
     --backup-instance=clone-db-prod
   ```

2. **Service Rollback:**
   ```bash
   gcloud run services update-traffic rag-service \
     --to-revisions=PREVIOUS_REVISION=100
   ```

## Support

- **Documentation:** [API.md](./API.md)
- **README:** [README.md](./README.md)
- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)
