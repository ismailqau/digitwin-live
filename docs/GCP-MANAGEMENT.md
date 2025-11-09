# GCP Management Guide

Complete guide for managing Google Cloud Platform resources for DigitWin Live.

## Table of Contents

- [Quick Start](#quick-start)
- [Setup](#setup)
- [Management](#management)
- [Monitoring](#monitoring)
- [Cost Optimization](#cost-optimization)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Initial Setup

```bash
# 1. Authenticate with GCP
gcloud auth login
gcloud auth application-default login

# 2. Set project in .env
echo "GCP_PROJECT_ID=your-project-id" >> .env
echo "GCP_REGION=us-central1" >> .env

# 3. Run setup
pnpm gcp:setup
```

### Daily Operations

```bash
# Check status
pnpm gcp:status

# List resources
pnpm gcp:list

# Check costs
pnpm gcp:cost

# Test everything
pnpm test:gcp
```

## Setup

### Prerequisites

1. **GCP Account**: Active Google Cloud Platform account
2. **gcloud CLI**: Installed and configured
3. **Billing**: Enabled on your GCP project
4. **Permissions**: Owner or Editor role

### Installation

```bash
# Install gcloud CLI (macOS)
brew install --cask google-cloud-sdk

# Or download from
# https://cloud.google.com/sdk/docs/install

# Initialize
gcloud init
```

### Initial Configuration

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Set region
gcloud config set compute/region us-central1

# Enable billing
gcloud beta billing projects link YOUR_PROJECT_ID \
  --billing-account=YOUR_BILLING_ACCOUNT_ID
```

## Setup Script

### `pnpm gcp:setup`

Creates all required GCP resources.

**What it creates**:
- ✅ Enables required APIs
- ✅ Creates Cloud Storage buckets
- ✅ Creates service accounts
- ✅ Sets up Secret Manager
- ✅ Optionally creates Cloud SQL
- ✅ Optionally creates GKE cluster

**Usage**:
```bash
pnpm gcp:setup
```

**Interactive prompts**:
- Create Cloud SQL? (y/N)
- Create GKE cluster? (y/N)

**Resources created**:

1. **Storage Buckets**:
   - `clone-voice-models-dev` - Voice model storage
   - `clone-face-models-dev` - Face model storage
   - `clone-documents-dev` - Document storage
   - `clone-uploads-dev` - User uploads

2. **Service Account**:
   - Name: `digitwinlive-sa`
   - Roles: Cloud SQL Client, Storage Admin, Secret Accessor
   - Key: `secrets/gcp-service-account-prod.json`

3. **APIs Enabled**:
   - Compute Engine API
   - Kubernetes Engine API
   - Cloud SQL Admin API
   - Cloud Storage API
   - Cloud Run API
   - Secret Manager API

4. **Optional Resources**:
   - Cloud SQL instance (PostgreSQL 15)
   - GKE cluster (1 node, e2-medium)
   - Weaviate deployment in GKE

## Management

### Status Check

```bash
# Check all resources
pnpm gcp:status
```

**Output**:
```
=== GCP Resources Status ===

APIs Status:
  ✅ compute: enabled
  ✅ container: enabled
  ✅ sqladmin: enabled

Storage Buckets:
  ✅ clone-voice-models-dev: exists (1.2GB)
  ✅ clone-documents-dev: exists (500MB)

Cloud SQL:
  ✅ digitwinlive-db: RUNNABLE

GKE Cluster:
  ✅ digitwinlive-cluster: RUNNING
  ✅ weaviate: 1 replicas ready
```

### List Resources

```bash
# List all resources
pnpm gcp:list
```

Shows:
- Storage buckets
- Cloud SQL instances
- GKE clusters
- Cloud Run services
- Secrets

### Enable/Disable Services

```bash
# Enable all APIs
./scripts/gcp-manage.sh enable apis

# Enable storage
./scripts/gcp-manage.sh enable storage
```

### Start/Stop Resources

**Start resources**:
```bash
# Start Cloud SQL
./scripts/gcp-manage.sh start sql-instance

# Start GKE cluster
./scripts/gcp-manage.sh start gke-cluster

# Start Weaviate
./scripts/gcp-manage.sh start weaviate-deployment
```

**Stop resources** (to save costs):
```bash
# Stop Cloud SQL
./scripts/gcp-manage.sh stop sql-instance

# Stop GKE cluster (scale to 0)
./scripts/gcp-manage.sh stop gke-cluster

# Stop Weaviate
./scripts/gcp-manage.sh stop weaviate-deployment
```

### Delete Resources

```bash
# Delete specific resource
./scripts/gcp-manage.sh delete sql-instance
./scripts/gcp-manage.sh delete gke-cluster
./scripts/gcp-manage.sh delete buckets

# Delete everything
pnpm gcp:cleanup
```

**Warning**: Deletion is permanent!

## Monitoring

### Cost Monitoring

```bash
# Show estimated costs
pnpm gcp:cost
```

**Output**:
```
=== Estimated Monthly Costs ===

Storage Buckets:
  clone-voice-models-dev: 10GB (~$0.20/month)
  clone-documents-dev: 5GB (~$0.10/month)
  Total Storage: 15GB (~$0.30/month)

Cloud SQL (if running):
  db-f1-micro: ~$7.67/month

GKE Cluster (if running):
  1 x e2-medium node: ~$24/month

Estimated Total: ~$32/month
```

### Resource Usage

```bash
# Check bucket sizes
gsutil du -sh gs://your-bucket-name

# Check SQL instance status
gcloud sql instances describe digitwinlive-db

# Check GKE cluster status
gcloud container clusters describe digitwinlive-cluster \
  --region=us-central1
```

### Logs

```bash
# View Cloud Run logs
gcloud run services logs read api-gateway \
  --region=us-central1 \
  --limit=50

# View GKE logs
kubectl logs -l app=weaviate --tail=100

# View Cloud SQL logs
gcloud sql operations list \
  --instance=digitwinlive-db \
  --limit=10
```

## Cost Optimization

### Development Environment

**Minimize costs during development**:

```bash
# Use local services
WEAVIATE_ENABLED=true  # Use local Docker
DATABASE_URL=postgresql://localhost:5432/dev  # Local PostgreSQL

# Stop GCP resources when not in use
./scripts/gcp-manage.sh stop sql-instance
./scripts/gcp-manage.sh stop gke-cluster
```

**Estimated savings**: ~$30/month

### Production Environment

**Optimize production costs**:

1. **Use Cloud SQL only when needed**:
   ```bash
   # Stop during low-traffic hours
   ./scripts/gcp-manage.sh stop sql-instance
   
   # Start before peak hours
   ./scripts/gcp-manage.sh start sql-instance
   ```

2. **Use GKE autoscaling**:
   ```bash
   gcloud container clusters update digitwinlive-cluster \
     --enable-autoscaling \
     --min-nodes=0 \
     --max-nodes=3 \
     --region=us-central1
   ```

3. **Use Cloud Storage lifecycle policies**:
   - Automatically delete old temp files
   - Move infrequent data to Nearline storage

4. **Use Cloud Run** (pay per use):
   - Only pay when requests are processed
   - Automatic scaling to zero

### Cost Alerts

Set up billing alerts:

```bash
# Create budget alert
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="DigitWin Live Budget" \
  --budget-amount=100 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```

## Troubleshooting

### Common Issues

#### API Not Enabled

**Error**: `API [service] is not enabled`

**Solution**:
```bash
./scripts/gcp-manage.sh enable apis
```

#### Insufficient Permissions

**Error**: `Permission denied`

**Solution**:
```bash
# Check current permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:$(gcloud config get-value account)"

# Request Owner or Editor role from project admin
```

#### Quota Exceeded

**Error**: `Quota exceeded`

**Solution**:
1. Check quotas: https://console.cloud.google.com/iam-admin/quotas
2. Request quota increase
3. Or reduce resource usage

#### Cloud SQL Connection Failed

**Error**: `Connection refused`

**Solution**:
```bash
# Check if instance is running
gcloud sql instances describe digitwinlive-db

# Start if stopped
./scripts/gcp-manage.sh start sql-instance

# Use Cloud SQL Proxy
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432
```

#### GKE Cluster Not Accessible

**Error**: `Unable to connect to cluster`

**Solution**:
```bash
# Get credentials
gcloud container clusters get-credentials digitwinlive-cluster \
  --region=us-central1

# Verify kubectl config
kubectl config current-context
```

### Debug Commands

```bash
# Check project configuration
gcloud config list

# Check enabled APIs
gcloud services list --enabled

# Check IAM permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID

# Check billing
gcloud billing projects describe $GCP_PROJECT_ID

# Check quotas
gcloud compute project-info describe --project=$GCP_PROJECT_ID
```

## Best Practices

### Security

1. **Use Secret Manager** for sensitive data
2. **Enable IAM authentication** for Cloud SQL
3. **Use service accounts** with minimal permissions
4. **Rotate keys** regularly
5. **Enable audit logging**

### Reliability

1. **Use multiple regions** for production
2. **Set up backups** for Cloud SQL
3. **Use health checks** for Cloud Run
4. **Monitor resource usage**
5. **Set up alerting**

### Performance

1. **Use Cloud CDN** for static assets
2. **Enable Cloud SQL read replicas** for high traffic
3. **Use GKE autoscaling**
4. **Optimize bucket locations** (same region as compute)
5. **Use Cloud Run concurrency** settings

## Scripts Reference

### Setup Script

```bash
./scripts/gcp-setup.sh
```

Creates all GCP resources interactively.

### Management Script

```bash
./scripts/gcp-manage.sh <command> [options]

Commands:
  status              Show status of all resources
  enable <service>    Enable a service
  start <resource>    Start a resource
  stop <resource>     Stop a resource
  delete <resource>   Delete a resource
  list                List all resources
  cost                Show estimated costs
```

### Cleanup Script

The cleanup script offers multiple deletion modes:

```bash
# Interactive menu (default)
./scripts/gcp-cleanup.sh

# Menu-based selection (choose specific resources: 1,3,4)
./scripts/gcp-cleanup.sh --menu
pnpm gcp:cleanup-menu

# Interactive y/n for each resource
./scripts/gcp-cleanup.sh --selective
pnpm gcp:cleanup-selective

# Delete everything (with confirmation)
./scripts/gcp-cleanup.sh --all
pnpm gcp:cleanup-all
```

**Menu Selection Example**:
```
Select resources to delete:
  1) Weaviate deployment
  2) GKE cluster
  3) Cloud SQL instances
  4) Storage buckets
  5) Service accounts
  6) Secrets
  7) All of the above
  8) Cancel

Enter choices (comma-separated, e.g., 1,3,4): 3,4
```

### Stop/Start All Resources

Save costs by stopping all resources when not in use:

```bash
# Stop everything (saves ~$74/month)
./scripts/gcp-manage.sh stop-all
pnpm gcp:stop-all

# Start everything back up
./scripts/gcp-manage.sh start-all
pnpm gcp:start-all
```

**What gets stopped**:
- Cloud SQL instance (~$50/month savings)
- GKE cluster (~$24/month savings)
- Weaviate deployment

Resources can be restarted anytime without data loss.

### Test Script

```bash
./scripts/gcp-vector-db-test.sh
```

Tests all GCP resources and vector database setup.

## Additional Resources

- [GCP Console](https://console.cloud.google.com)
- [GCP Pricing Calculator](https://cloud.google.com/products/calculator)
- [GCP Documentation](https://cloud.google.com/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [Cloud Storage Documentation](https://cloud.google.com/storage/docs)