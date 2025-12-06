# GCP Deployment Guide

Complete guide for deploying DigiTwin Live to Google Cloud Platform using Cloud Run and Cloud SQL with pgvector.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [PostgreSQL with pgvector Setup](#postgresql-with-pgvector-setup)
- [Service Deployment](#service-deployment)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)
- [Cost Management](#cost-management)

## Overview

This guide walks you through deploying the DigiTwin Live application to GCP using:

- **Cloud Run**: Serverless container platform for all services
- **Cloud SQL**: Managed PostgreSQL 15+ with pgvector extension
- **Cloud Storage**: Object storage for models and documents
- **Artifact Registry**: Container image storage
- **Secret Manager**: Secure secrets management

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GCP Project                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Cloud Run Services                                 │    │
│  │  ├── api-gateway (HTTPS)                           │    │
│  │  ├── websocket-server (HTTPS)                      │    │
│  │  └── face-processing-service (HTTPS)               │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Cloud SQL PostgreSQL 15                           │    │
│  │  ├── Database: digitwinlive-db                     │    │
│  │  ├── Extension: pgvector                           │    │
│  │  └── Connection: Unix socket from Cloud Run        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Cloud Storage Buckets                             │    │
│  │  ├── Voice models, Face models                     │    │
│  │  ├── Documents, Uploads                            │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Tools

1. **gcloud CLI** - Google Cloud command-line tool

   ```bash
   # macOS
   brew install --cask google-cloud-sdk

   # Or download from
   # https://cloud.google.com/sdk/docs/install
   ```

2. **Docker** - For building container images locally (optional)

   ```bash
   # macOS
   brew install --cask docker
   ```

3. **Node.js 20+** and **pnpm 8+**
   ```bash
   # macOS
   brew install node@20
   npm install -g pnpm@8
   ```

### GCP Account Setup

1. **Create GCP Account**: https://cloud.google.com/free
2. **Create Project**:
   ```bash
   gcloud projects create digitwinlive-prod --name="DigiTwin Live Production"
   ```
3. **Enable Billing**: Link project to billing account in GCP Console
4. **Set Default Project**:
   ```bash
   gcloud config set project digitwinlive-prod
   ```

### Authentication

```bash
# Authenticate with your Google account
gcloud auth login

# Set up application default credentials
gcloud auth application-default login
```

## Initial Setup

### Step 1: Configure Environment

1. **Copy environment template**:

   ```bash
   cp .env.example .env.production
   ```

2. **Edit `.env.production`** and set:

   ```bash
   # GCP Configuration
   GCP_PROJECT_ID=digitwinlive-prod
   GCP_REGION=us-central1

   # Environment
   NODE_ENV=production

   # Database (will be updated after Cloud SQL creation)
   DATABASE_URL=postgresql://postgres:${SECRET_DATABASE_PASSWORD}@/digitwinlive-db?host=/cloudsql/PROJECT:REGION:INSTANCE
   CLOUD_SQL_CONNECTION_NAME=digitwinlive-prod:us-central1:digitwinlive-db

   # Secrets (will be mounted from Secret Manager)
   JWT_SECRET=${SECRET_JWT_SECRET}
   REFRESH_SECRET=${SECRET_REFRESH_SECRET}
   DATABASE_PASSWORD=${SECRET_DATABASE_PASSWORD}
   ```

### Step 2: Run Infrastructure Setup

```bash
# Run the setup script
./scripts/gcp-setup.sh
```

This script will:

- ✅ Enable required GCP APIs (compute, sqladmin, storage, run, secretmanager, artifactregistry, cloudbuild)
- ✅ Create Artifact Registry for Docker images
- ✅ Create Cloud Storage buckets (voice-models, face-models, documents, uploads)
- ✅ Create Cloud SQL PostgreSQL 15 instance
- ✅ Create service accounts with appropriate IAM roles
- ✅ Create placeholder secrets in Secret Manager

**Expected output**:

```
=== GCP Infrastructure Setup ===

✅ Checking prerequisites...
✅ Enabling APIs...
✅ Creating Artifact Registry...
✅ Creating storage buckets...
✅ Creating Cloud SQL instance...
✅ Creating service accounts...
✅ Setting up secrets...

=== Setup Complete ===

Next steps:
1. Enable pgvector extension (see below)
2. Update secrets in Secret Manager
3. Run database migrations
4. Deploy services
```

### Step 3: Update Secrets

The setup script creates placeholder secrets. Update them with real values:

```bash
# Generate secure secrets
node scripts/generate-secrets.js

# Update secrets in Secret Manager
echo -n "your-jwt-secret-here" | gcloud secrets versions add jwt-secret --data-file=-
echo -n "your-refresh-secret-here" | gcloud secrets versions add refresh-secret --data-file=-
echo -n "your-database-password-here" | gcloud secrets versions add database-password --data-file=-
```

## PostgreSQL with pgvector Setup

### Why pgvector?

pgvector is a PostgreSQL extension that enables vector similarity search, eliminating the need for a separate vector database like Weaviate. Benefits:

- **Simplified Infrastructure**: Single database for all data
- **Cost Effective**: No separate vector database service
- **ACID Compliance**: Transactional consistency
- **Excellent Performance**: Sub-5ms vector searches with proper indexing

### Step 1: Connect to Cloud SQL

Use Cloud SQL Proxy to connect securely:

```bash
# Download Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy

# Start proxy (replace with your connection name)
./cloud-sql-proxy digitwinlive-prod:us-central1:digitwinlive-db --port=5432
```

### Step 2: Enable pgvector Extension

In a new terminal, connect to the database:

```bash
# Connect using psql
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres"
```

Enable the pgvector extension:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Expected output:
--  oid  | extname | extowner | extnamespace | extrelocatable | extversion | extconfig | extcondition
-- ------+---------+----------+--------------+----------------+------------+-----------+--------------
-- 16384 | vector  |       10 |         2200 | t              | 0.5.1      |           |
```

### Step 3: Run Database Migrations

```bash
# Run Prisma migrations
pnpm db:migrate:deploy
```

This will:

- Create all application tables
- Create cache tables for vector searches, LLM responses, etc.
- Set up indexes for optimal performance

### Step 4: Verify pgvector Setup

```sql
-- Create a test table with vector column
CREATE TABLE test_embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(768)
);

-- Insert test data
INSERT INTO test_embeddings (content, embedding)
VALUES ('test', array_fill(0.1, ARRAY[768])::vector);

-- Test similarity search
SELECT content, embedding <-> array_fill(0.1, ARRAY[768])::vector AS distance
FROM test_embeddings
ORDER BY distance
LIMIT 5;

-- Clean up
DROP TABLE test_embeddings;
```

### pgvector Performance Tips

1. **Create IVFFlat Index** for fast similarity search:

   ```sql
   CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```

2. **Adjust lists parameter** based on data size:
   - Small datasets (< 10K): lists = 10-50
   - Medium datasets (10K-100K): lists = 100-500
   - Large datasets (> 100K): lists = 1000+

3. **Use appropriate distance metrics**:
   - `vector_cosine_ops`: Cosine distance (most common)
   - `vector_l2_ops`: Euclidean distance
   - `vector_ip_ops`: Inner product

## Service Deployment

### Step 1: Build and Deploy Services

Deploy all services at once:

```bash
./scripts/gcp-deploy.sh deploy --env=production
```

Or deploy individual services:

```bash
# Deploy API Gateway
./scripts/gcp-deploy.sh deploy api-gateway --env=production

# Deploy WebSocket Server
./scripts/gcp-deploy.sh deploy websocket-server --env=production

# Deploy Face Processing Service
./scripts/gcp-deploy.sh deploy face-processing-service --env=production
```

### Step 2: Deployment Process

For each service, the script will:

1. **Load environment configuration** from `.env.production`
2. **Build container image** using Cloud Build
3. **Push to Artifact Registry** with timestamp and latest tags
4. **Deploy to Cloud Run** with:
   - Environment variables from `.env.production`
   - Secrets mounted from Secret Manager
   - Cloud SQL connection via Unix socket
   - Resource limits (512Mi memory, 1 CPU)
   - Autoscaling (min 0, max 10 instances)
5. **Return service URL**

**Expected output**:

```
=== Deploying Services ===

Building api-gateway...
✅ Image built: us-central1-docker.pkg.dev/digitwinlive-prod/digitwinlive/api-gateway:20241206-123456

Deploying api-gateway...
✅ Deployed: https://api-gateway-abc123-uc.a.run.app

Building websocket-server...
✅ Image built: us-central1-docker.pkg.dev/digitwinlive-prod/digitwinlive/websocket-server:20241206-123457

Deploying websocket-server...
✅ Deployed: https://websocket-server-def456-uc.a.run.app

=== Deployment Complete ===

Service URLs:
  API Gateway: https://api-gateway-abc123-uc.a.run.app
  WebSocket Server: https://websocket-server-def456-uc.a.run.app
  Face Processing: https://face-processing-ghi789-uc.a.run.app

Update your .env.production with these URLs.
```

### Step 3: Update Environment with Service URLs

Update `.env.production` with the deployed service URLs:

```bash
API_GATEWAY_URL=https://api-gateway-abc123-uc.a.run.app
WEBSOCKET_URL=https://websocket-server-def456-uc.a.run.app
FACE_PROCESSING_URL=https://face-processing-ghi789-uc.a.run.app
```

### Step 4: Redeploy with Updated URLs

Services need to know about each other's URLs for inter-service communication:

```bash
./scripts/gcp-deploy.sh deploy --env=production
```

## Verification

### Check Deployment Status

```bash
# Check all services
./scripts/gcp-deploy.sh status

# Or use gcloud directly
gcloud run services list --region=us-central1
```

### Test Service Health

```bash
# Test API Gateway
curl https://api-gateway-abc123-uc.a.run.app/health

# Expected response:
# {"status":"healthy","service":"api-gateway","timestamp":"2024-12-06T10:00:00.000Z"}

# Test WebSocket Server
curl https://websocket-server-def456-uc.a.run.app/health

# Test Face Processing Service
curl https://face-processing-ghi789-uc.a.run.app/health
```

### Check Service Logs

```bash
# View logs for a service
gcloud run services logs read api-gateway --region=us-central1 --limit=50

# Follow logs in real-time
gcloud run services logs tail api-gateway --region=us-central1
```

### Test Database Connection

```bash
# Check Cloud SQL instance status
gcloud sql instances describe digitwinlive-db

# Test connection from Cloud Run
# (Services automatically connect via Unix socket)
```

## Troubleshooting

### Common Issues

#### 1. Build Fails with "Dockerfile not found"

**Problem**: Cloud Build cannot find the Dockerfile

**Solution**:

```bash
# Verify Dockerfile exists
ls -la apps/api-gateway/Dockerfile

# Check .gcloudignore doesn't exclude Dockerfiles
cat .gcloudignore
```

#### 2. Deployment Fails with "Permission Denied"

**Problem**: Service account lacks required permissions

**Solution**:

```bash
# Grant necessary roles
gcloud projects add-iam-policy-binding digitwinlive-prod \
  --member="serviceAccount:digitwinlive-sa@digitwinlive-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding digitwinlive-prod \
  --member="serviceAccount:digitwinlive-sa@digitwinlive-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 3. Service Cannot Connect to Database

**Problem**: Cloud SQL connection configuration incorrect

**Solution**:

```bash
# Verify Cloud SQL connection name
gcloud sql instances describe digitwinlive-db --format="value(connectionName)"

# Update .env.production with correct connection name
CLOUD_SQL_CONNECTION_NAME=digitwinlive-prod:us-central1:digitwinlive-db

# Verify service has cloudsql.client role
gcloud run services describe api-gateway --region=us-central1 --format="value(spec.template.metadata.annotations)"
```

#### 4. pgvector Extension Not Available

**Problem**: PostgreSQL version too old or extension not installed

**Solution**:

```bash
# Check PostgreSQL version (must be 15+)
gcloud sql instances describe digitwinlive-db --format="value(databaseVersion)"

# If version is correct, connect and enable extension
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres"
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 5. Service Returns 503 "Service Unavailable"

**Problem**: Service failed to start or health check failing

**Solution**:

```bash
# Check service logs
gcloud run services logs read api-gateway --region=us-central1 --limit=100

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Application startup error

# Verify environment variables
gcloud run services describe api-gateway --region=us-central1 --format="value(spec.template.spec.containers[0].env)"
```

#### 6. High Latency or Slow Responses

**Problem**: Cold starts or insufficient resources

**Solution**:

```bash
# Increase minimum instances to reduce cold starts
gcloud run services update api-gateway \
  --region=us-central1 \
  --min-instances=1

# Increase memory and CPU
gcloud run services update api-gateway \
  --region=us-central1 \
  --memory=1Gi \
  --cpu=2
```

### Debug Commands

```bash
# Check project configuration
gcloud config list

# List enabled APIs
gcloud services list --enabled

# Check IAM permissions
gcloud projects get-iam-policy digitwinlive-prod

# Check Cloud SQL status
gcloud sql instances list

# Check Cloud Run services
gcloud run services list --region=us-central1

# Check storage buckets
gsutil ls

# Check secrets
gcloud secrets list
```

### Getting Help

1. **Check logs first**: Most issues are visible in Cloud Run logs
2. **Verify configuration**: Double-check environment variables and secrets
3. **Test locally**: Build and run containers locally to isolate issues
4. **GCP Status**: Check https://status.cloud.google.com for outages
5. **Support**: Contact GCP support or file an issue in the repository

## Rollback Procedures

### Rollback to Previous Revision

Cloud Run automatically keeps previous revisions. Rollback is simple:

```bash
# List revisions
gcloud run revisions list --service=api-gateway --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic api-gateway \
  --region=us-central1 \
  --to-revisions=api-gateway-00002-abc=100

# Or rollback to previous revision
gcloud run services update-traffic api-gateway \
  --region=us-central1 \
  --to-revisions=LATEST=0,api-gateway-00001-xyz=100
```

### Rollback All Services

```bash
# Create rollback script
cat > rollback.sh << 'EOF'
#!/bin/bash
REGION=us-central1

for service in api-gateway websocket-server face-processing-service; do
  echo "Rolling back $service..."

  # Get previous revision
  PREV_REVISION=$(gcloud run revisions list \
    --service=$service \
    --region=$REGION \
    --format="value(name)" \
    --limit=2 | tail -n 1)

  # Rollback
  gcloud run services update-traffic $service \
    --region=$REGION \
    --to-revisions=$PREV_REVISION=100
done
EOF

chmod +x rollback.sh
./rollback.sh
```

### Rollback Database Migrations

```bash
# Connect to database
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres"

# Check migration history
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;

# Rollback using Prisma (if migration is reversible)
pnpm db:migrate:resolve --rolled-back <migration-name>

# Or restore from backup
gcloud sql backups list --instance=digitwinlive-db

gcloud sql backups restore <backup-id> \
  --backup-instance=digitwinlive-db
```

### Emergency Rollback Plan

If deployment causes critical issues:

1. **Immediate**: Rollback Cloud Run services to previous revision
2. **Database**: Restore from most recent backup if needed
3. **Verify**: Test all critical endpoints
4. **Investigate**: Review logs to identify root cause
5. **Fix**: Address issues in development environment
6. **Redeploy**: Deploy fixed version after thorough testing

## Cost Management

### Estimated Monthly Costs

**Development Environment**:

- Cloud SQL (db-f1-micro): ~$7.67/month
- Cloud Storage (15GB): ~$0.30/month
- Cloud Run (minimal traffic): ~$5/month
- **Total**: ~$13/month

**Production Environment**:

- Cloud SQL (db-custom-1-3840): ~$50/month
- Cloud Storage (100GB): ~$2/month
- Cloud Run (moderate traffic): ~$50/month
- Cloud Build: ~$10/month
- **Total**: ~$112/month

### Cost Optimization Tips

1. **Use Cloud Run scale-to-zero**:

   ```bash
   # Set min instances to 0 for dev
   gcloud run services update api-gateway \
     --region=us-central1 \
     --min-instances=0
   ```

2. **Stop Cloud SQL when not in use**:

   ```bash
   # Stop instance
   gcloud sql instances patch digitwinlive-db --activation-policy=NEVER

   # Start instance
   gcloud sql instances patch digitwinlive-db --activation-policy=ALWAYS
   ```

3. **Use lifecycle policies for storage**:

   ```bash
   # Delete old temporary files after 7 days
   gsutil lifecycle set lifecycle.json gs://clone-uploads-prod
   ```

4. **Monitor costs**:

   ```bash
   # Check current costs
   ./scripts/gcp-manage.sh cost

   # Set up budget alerts in GCP Console
   ```

5. **Use committed use discounts** for production (save 37-55%)

### Cost Monitoring

```bash
# View estimated costs
./scripts/gcp-manage.sh cost

# Set up billing alerts
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="DigiTwin Live Budget" \
  --budget-amount=200 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```

## Next Steps

After successful deployment:

1. **Configure Custom Domain**: Set up custom domain in Cloud Run
2. **Enable CDN**: Configure Cloud CDN for static assets
3. **Set Up Monitoring**: Configure alerts and dashboards
4. **Load Testing**: Test system under load
5. **Backup Strategy**: Verify automated backups are working
6. **Documentation**: Document any custom configurations

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [GCP Best Practices](https://cloud.google.com/docs/enterprise/best-practices-for-enterprise-organizations)
- [GCP Management Guide](./GCP-MANAGEMENT.md)
- [GCP Quick Reference](./GCP-QUICK-REFERENCE.md)
