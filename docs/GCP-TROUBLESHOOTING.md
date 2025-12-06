# GCP Troubleshooting Guide

Quick reference for troubleshooting common GCP deployment and runtime issues.

## Table of Contents

- [Setup Issues](#setup-issues)
- [Deployment Issues](#deployment-issues)
- [Runtime Issues](#runtime-issues)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)
- [Cost Issues](#cost-issues)

## Setup Issues

### gcloud CLI Not Found

**Symptoms**: `command not found: gcloud`

**Solution**:

```bash
# macOS
brew install --cask google-cloud-sdk

# Or download from
# https://cloud.google.com/sdk/docs/install

# Verify installation
gcloud --version
```

### Not Authenticated

**Symptoms**: `ERROR: (gcloud) You do not currently have an active account selected`

**Solution**:

```bash
# Authenticate with your Google account
gcloud auth login

# Set up application default credentials
gcloud auth application-default login

# Verify authentication
gcloud auth list
```

### Project Not Set

**Symptoms**: `ERROR: (gcloud) The required property [project] is not currently set`

**Solution**:

```bash
# Set project
gcloud config set project digitwinlive-prod

# Verify
gcloud config get-value project
```

### API Not Enabled

**Symptoms**: `API [service] is not enabled for project [project-id]`

**Solution**:

```bash
# Enable all required APIs
./scripts/gcp-manage.sh enable apis

# Or enable specific API
gcloud services enable compute.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable run.googleapis.com
```

### Insufficient Permissions

**Symptoms**: `Permission denied` or `does not have required permission`

**Solution**:

```bash
# Check current permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:$(gcloud config get-value account)"

# Required roles:
# - roles/owner (or)
# - roles/editor + roles/iam.serviceAccountAdmin

# Request access from project owner
```

## Deployment Issues

### Build Fails: Dockerfile Not Found

**Symptoms**: `ERROR: failed to solve: failed to read dockerfile`

**Solution**:

```bash
# Verify Dockerfile exists
ls -la apps/api-gateway/Dockerfile

# Check .gcloudignore doesn't exclude Dockerfiles
cat .gcloudignore | grep -i dockerfile

# If excluded, remove from .gcloudignore
```

### Build Fails: Workspace Dependencies Not Found

**Symptoms**: `Cannot find module '@clone/logger'` during build

**Solution**:

```bash
# Verify package.json includes workspace dependencies
cat apps/api-gateway/package.json | grep "@clone"

# Ensure Dockerfile copies workspace packages
# Should have:
# COPY packages/ ./packages/
# COPY pnpm-workspace.yaml ./
```

### Build Fails: Prisma Client Not Generated

**Symptoms**: `Cannot find module '@prisma/client'`

**Solution**:

```bash
# Ensure Dockerfile generates Prisma client in both stages
# Builder stage:
# RUN pnpm db:generate

# Production stage:
# RUN pnpm db:generate
```

### Deployment Fails: Permission Denied

**Symptoms**: `Permission denied` during deployment

**Solution**:

```bash
# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/run.admin"

# Grant Service Account User role
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/iam.serviceAccountUser"
```

### Deployment Fails: Secret Not Found

**Symptoms**: `Secret [secret-name] not found`

**Solution**:

```bash
# List existing secrets
gcloud secrets list

# Create missing secret
echo -n "your-secret-value" | gcloud secrets create jwt-secret --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:digitwinlive-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Deployment Succeeds But Service Unavailable

**Symptoms**: Service deployed but returns 503

**Solution**:

```bash
# Check service logs
gcloud run services logs read api-gateway --region=us-central1 --limit=100

# Common causes:
# 1. Application startup error
# 2. Missing environment variables
# 3. Database connection failure
# 4. Port mismatch (must listen on $PORT or 8080)

# Verify service is listening on correct port
# In your app: const PORT = process.env.PORT || 8080;
```

## Runtime Issues

### Service Returns 503 After Deployment

**Symptoms**: `503 Service Unavailable` after successful deployment

**Solution**:

```bash
# Check logs for startup errors
gcloud run services logs read api-gateway --region=us-central1 --limit=50

# Common issues:
# 1. Database connection failure
# 2. Missing environment variables
# 3. Application crash on startup

# Verify environment variables
gcloud run services describe api-gateway --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"

# Check health endpoint
curl https://your-service-url.run.app/health
```

### High Cold Start Latency

**Symptoms**: First request after idle period is very slow (5-10 seconds)

**Solution**:

```bash
# Set minimum instances to keep service warm
gcloud run services update api-gateway \
  --region=us-central1 \
  --min-instances=1

# Note: This increases costs but eliminates cold starts
# For production: min-instances=1 or 2
# For development: min-instances=0 (scale to zero)
```

### Request Timeout

**Symptoms**: `504 Gateway Timeout` or requests timing out

**Solution**:

```bash
# Increase timeout (default is 300 seconds)
gcloud run services update api-gateway \
  --region=us-central1 \
  --timeout=600

# Check for long-running operations in logs
gcloud run services logs read api-gateway --region=us-central1 --limit=100

# Consider moving long operations to background jobs
```

### Memory Limit Exceeded

**Symptoms**: Service crashes with OOM (Out of Memory) errors

**Solution**:

```bash
# Increase memory limit
gcloud run services update api-gateway \
  --region=us-central1 \
  --memory=1Gi

# Check memory usage in logs
gcloud run services logs read api-gateway --region=us-central1 | grep -i memory

# Optimize application:
# - Reduce memory footprint
# - Implement streaming for large responses
# - Use pagination for large datasets
```

### CPU Throttling

**Symptoms**: Slow response times, high CPU usage in logs

**Solution**:

```bash
# Increase CPU allocation
gcloud run services update api-gateway \
  --region=us-central1 \
  --cpu=2

# Enable CPU always allocated (not just during requests)
gcloud run services update api-gateway \
  --region=us-central1 \
  --cpu-throttling=false

# Note: This increases costs
```

## Database Issues

### Cannot Connect to Cloud SQL

**Symptoms**: `Connection refused` or `Connection timeout`

**Solution**:

```bash
# Verify Cloud SQL instance is running
gcloud sql instances describe digitwinlive-db

# Check if instance is stopped
gcloud sql instances patch digitwinlive-db --activation-policy=ALWAYS

# Verify Cloud SQL connection name in environment
echo $CLOUD_SQL_CONNECTION_NAME
# Should be: project:region:instance

# Verify service has cloudsql.client role
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:digitwinlive-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com"
```

### pgvector Extension Not Available

**Symptoms**: `extension "vector" does not exist`

**Solution**:

```bash
# Connect to database via Cloud SQL Proxy
./cloud-sql-proxy $CLOUD_SQL_CONNECTION_NAME --port=5432 &

# Connect with psql
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres"

# Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
SELECT * FROM pg_extension WHERE extname = 'vector';

# If still not available, check PostgreSQL version (must be 15+)
SELECT version();
```

### Database Connection Pool Exhausted

**Symptoms**: `remaining connection slots are reserved` or `too many connections`

**Solution**:

```bash
# Increase max connections in Cloud SQL
gcloud sql instances patch digitwinlive-db \
  --database-flags=max_connections=100

# Implement connection pooling in application
# Use Prisma connection pool settings:
# datasource db {
#   url = env("DATABASE_URL")
#   relationMode = "prisma"
# }

# Monitor active connections
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres" \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

### Slow Database Queries

**Symptoms**: High query latency, slow response times

**Solution**:

```bash
# Enable query logging
gcloud sql instances patch digitwinlive-db \
  --database-flags=log_min_duration_statement=1000

# Analyze slow queries
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres" \
  -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Add indexes for frequently queried columns
# CREATE INDEX idx_users_email ON users(email);

# For vector searches, ensure IVFFlat index exists
# CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## Performance Issues

### Slow Vector Searches

**Symptoms**: Vector similarity searches taking > 100ms

**Solution**:

```sql
-- Create IVFFlat index if not exists
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
ON embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Adjust lists parameter based on data size:
-- Small (< 10K rows): lists = 10-50
-- Medium (10K-100K): lists = 100-500
-- Large (> 100K): lists = 1000+

-- Analyze table
ANALYZE embeddings;

-- Test query performance
EXPLAIN ANALYZE
SELECT content, embedding <-> '[0.1,0.2,...]'::vector AS distance
FROM embeddings
ORDER BY distance
LIMIT 10;
```

### High API Latency

**Symptoms**: API responses taking > 1 second

**Solution**:

```bash
# Enable request tracing
gcloud run services update api-gateway \
  --region=us-central1 \
  --set-env-vars="LOG_LEVEL=debug"

# Check logs for slow operations
gcloud run services logs read api-gateway --region=us-central1 | grep -i "slow\|latency"

# Common optimizations:
# 1. Add database indexes
# 2. Implement caching (PostgreSQL cache tables)
# 3. Optimize N+1 queries (use Prisma include)
# 4. Enable connection pooling
# 5. Increase Cloud Run resources
```

### Concurrent Request Limit

**Symptoms**: Requests queued or rejected during high traffic

**Solution**:

```bash
# Increase concurrency per instance
gcloud run services update api-gateway \
  --region=us-central1 \
  --concurrency=80

# Increase max instances
gcloud run services update api-gateway \
  --region=us-central1 \
  --max-instances=100

# Monitor concurrent requests
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"'
```

## Cost Issues

### Unexpected High Costs

**Symptoms**: GCP bill higher than expected

**Solution**:

```bash
# Check current costs
./scripts/gcp-manage.sh cost

# View detailed billing
gcloud billing accounts list
gcloud billing projects describe $GCP_PROJECT_ID

# Common cost drivers:
# 1. Cloud SQL running 24/7 (~$50/month)
# 2. Cloud Run min instances > 0
# 3. Large storage buckets
# 4. Excessive Cloud Build usage

# Optimize costs:
# - Stop Cloud SQL when not in use
# - Set min-instances=0 for dev
# - Implement storage lifecycle policies
# - Use Cloud Build caching
```

### Cloud SQL Costs Too High

**Symptoms**: Cloud SQL consuming most of budget

**Solution**:

```bash
# Stop instance when not in use (dev only)
gcloud sql instances patch digitwinlive-db --activation-policy=NEVER

# Use smaller tier for development
gcloud sql instances patch digitwinlive-db --tier=db-f1-micro

# Enable automatic storage increase (prevents over-provisioning)
gcloud sql instances patch digitwinlive-db --storage-auto-increase

# Schedule start/stop for development
# Use Cloud Scheduler to start at 9 AM, stop at 6 PM
```

### Storage Costs Growing

**Symptoms**: Cloud Storage costs increasing over time

**Solution**:

```bash
# Check bucket sizes
gsutil du -sh gs://clone-*

# Implement lifecycle policies
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["temp/", "uploads/"]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://clone-uploads-prod

# Delete old files manually
gsutil -m rm -r gs://clone-uploads-prod/temp/**
```

## Debug Commands

### Check Overall Status

```bash
# Project configuration
gcloud config list

# Enabled APIs
gcloud services list --enabled

# IAM permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID

# Cloud Run services
gcloud run services list --region=us-central1

# Cloud SQL instances
gcloud sql instances list

# Storage buckets
gsutil ls

# Secrets
gcloud secrets list
```

### View Logs

```bash
# Cloud Run logs
gcloud run services logs read api-gateway --region=us-central1 --limit=100

# Follow logs in real-time
gcloud run services logs tail api-gateway --region=us-central1

# Filter logs by severity
gcloud run services logs read api-gateway --region=us-central1 \
  --log-filter="severity>=ERROR"

# Cloud SQL logs
gcloud sql operations list --instance=digitwinlive-db --limit=10
```

### Test Connectivity

```bash
# Test service health
curl https://your-service-url.run.app/health

# Test database connection via proxy
./cloud-sql-proxy $CLOUD_SQL_CONNECTION_NAME --port=5432 &
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres" -c "SELECT 1;"

# Test storage access
gsutil ls gs://clone-voice-models-prod/

# Test secret access
gcloud secrets versions access latest --secret=jwt-secret
```

## Getting Help

### Before Asking for Help

1. **Check logs**: Most issues are visible in Cloud Run or Cloud SQL logs
2. **Verify configuration**: Double-check environment variables and secrets
3. **Test locally**: Build and run containers locally to isolate issues
4. **Check GCP status**: Visit https://status.cloud.google.com
5. **Review documentation**: Check the deployment guide and troubleshooting docs

### Where to Get Help

1. **GCP Documentation**: https://cloud.google.com/docs
2. **GCP Support**: https://cloud.google.com/support
3. **Stack Overflow**: Tag questions with `google-cloud-platform`
4. **GitHub Issues**: File issues in the repository
5. **Community**: Join GCP community forums

### Information to Include

When asking for help, include:

- **Error message**: Full error text from logs
- **Environment**: Development, staging, or production
- **Steps to reproduce**: What you did before the error
- **Configuration**: Relevant environment variables (redact secrets!)
- **Logs**: Recent logs from affected service
- **GCP project ID**: Your project ID (if comfortable sharing)

## Additional Resources

- [GCP Deployment Guide](./GCP-DEPLOYMENT-GUIDE.md)
- [GCP Management Guide](./GCP-MANAGEMENT.md)
- [GCP Quick Reference](./GCP-QUICK-REFERENCE.md)
- [Cloud Run Troubleshooting](https://cloud.google.com/run/docs/troubleshooting)
- [Cloud SQL Troubleshooting](https://cloud.google.com/sql/docs/postgres/troubleshooting)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
