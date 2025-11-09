# GCP Quick Reference

Quick command reference for managing GCP resources.

## 🚀 Quick Commands

```bash
# Setup
pnpm gcp:setup          # Create all GCP resources (interactive)
pnpm gcp:create-sql     # Create Cloud SQL instance only

# Status & Monitoring
pnpm gcp:status         # Show status of all resources
pnpm gcp:list           # List all resources
pnpm gcp:cost           # Show estimated costs

# Testing
pnpm test:gcp           # Test GCP setup and vector database

# Stop/Start All Resources
pnpm gcp:stop-all       # Stop everything (save ~$74/month)
pnpm gcp:start-all      # Start everything back up

# Cleanup
pnpm gcp:cleanup        # Interactive cleanup menu
pnpm gcp:cleanup-menu   # Menu-based selection (1,3,4)
pnpm gcp:cleanup-selective  # Interactive (y/n for each)
pnpm gcp:cleanup-all    # Delete everything
pnpm gcp:cleanup-sql    # Delete specific SQL instances
```

## 📊 Status Command

```bash
pnpm gcp:status
```

**Shows**:
- ✅ Enabled/disabled APIs
- ✅ Storage bucket status and sizes
- ✅ Cloud SQL instance state
- ✅ GKE cluster status
- ✅ Weaviate deployment status
- ✅ Secret Manager configuration

**Example output**:
```
=== GCP Resources Status ===

APIs Status:
  ✅ compute: enabled
  ✅ storage-api: enabled
  ❌ container: disabled

Storage Buckets:
  ✅ clone-voice-models-dev: exists (1.2GB)
  ✅ clone-documents-dev: exists (500MB)

Cloud SQL:
  ✅ digitwinlive-db: RUNNABLE

GKE Cluster:
  ❌ digitwinlive-cluster: not found

Secret Manager:
  ℹ️  3 secrets configured
```

## 🔧 Management Commands

### Start/Stop Resources

```bash
# Start Cloud SQL
./scripts/gcp-manage.sh start sql-instance

# Stop Cloud SQL (saves ~$8/month)
./scripts/gcp-manage.sh stop sql-instance

# Start GKE cluster
./scripts/gcp-manage.sh start gke-cluster

# Stop GKE cluster (saves ~$24/month)
./scripts/gcp-manage.sh stop gke-cluster

# Start Weaviate
./scripts/gcp-manage.sh start weaviate-deployment

# Stop Weaviate
./scripts/gcp-manage.sh stop weaviate-deployment
```

### Enable Services

```bash
# Enable all required APIs
./scripts/gcp-manage.sh enable apis

# Enable storage buckets
./scripts/gcp-manage.sh enable storage
```

### Delete Resources

```bash
# Delete specific resources
./scripts/gcp-manage.sh delete sql-instance
./scripts/gcp-manage.sh delete gke-cluster
./scripts/gcp-manage.sh delete buckets

# Stop all resources to save costs (~$74/month)
pnpm gcp:stop-all

# Start all resources back up
pnpm gcp:start-all

# Delete everything (with confirmation)
pnpm gcp:cleanup-all
```

## 💰 Cost Management

```bash
# Show estimated costs
pnpm gcp:cost
```

**Typical costs**:
- Storage (15GB): ~$0.30/month
- Cloud SQL (db-f1-micro): ~$7.67/month
- GKE (1 node): ~$24/month
- **Total**: ~$32/month

**Save money**:
```bash
# Stop resources when not in use
./scripts/gcp-manage.sh stop sql-instance
./scripts/gcp-manage.sh stop gke-cluster

# Savings: ~$32/month
```

## 📋 List Resources

```bash
pnpm gcp:list
```

**Shows**:
- All storage buckets
- Cloud SQL instances
- GKE clusters
- Cloud Run services
- Secrets in Secret Manager

## 🧪 Testing

```bash
# Test everything
pnpm test:gcp
```

**Tests**:
- GCP authentication
- Project access
- Cloud SQL connection
- Weaviate in GKE
- Cloud Run services
- Storage buckets
- Vector database operations

## 🔑 Common Tasks

### First Time Setup

```bash
# 1. Authenticate
gcloud auth login
gcloud auth application-default login

# 2. Set project
export GCP_PROJECT_ID=your-project-id
echo "GCP_PROJECT_ID=$GCP_PROJECT_ID" >> .env

# 3. Run setup
pnpm gcp:setup

# 4. Verify
pnpm gcp:status
pnpm test:gcp
```

### Daily Development

```bash
# Check status
pnpm gcp:status

# Use local services (no GCP costs)
docker run -d --name weaviate -p 8080:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  semitechnologies/weaviate:latest

# Stop GCP resources
./scripts/gcp-manage.sh stop sql-instance
./scripts/gcp-manage.sh stop gke-cluster
```

### Before Deployment

```bash
# Start resources
./scripts/gcp-manage.sh start sql-instance
./scripts/gcp-manage.sh start gke-cluster

# Test
pnpm test:gcp

# Check status
pnpm gcp:status
```

### Cost Optimization

```bash
# Check current costs
pnpm gcp:cost

# Stop unused resources
./scripts/gcp-manage.sh stop sql-instance
./scripts/gcp-manage.sh stop gke-cluster

# Check savings
pnpm gcp:cost
```

## 🆘 Troubleshooting

### Command Hangs

**Issue**: Command takes too long or hangs

**Solution**: Commands now have automatic timeouts (5-10 seconds)
- If a command times out, the resource may not exist
- Check GCP Console for actual status

### Authentication Error

**Issue**: `Not authenticated with gcloud`

**Solution**:
```bash
gcloud auth login
gcloud auth application-default login
```

### Permission Denied

**Issue**: `Permission denied` errors

**Solution**:
```bash
# Check permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID

# Request Owner or Editor role
```

### API Not Enabled

**Issue**: `API not enabled` errors

**Solution**:
```bash
./scripts/gcp-manage.sh enable apis
```

## 📖 Full Documentation

- [GCP Management Guide](./GCP-MANAGEMENT.md) - Complete guide
- [GCP Infrastructure](./GCP-INFRASTRUCTURE.md) - Infrastructure setup
- [Vector Database](./VECTOR-DATABASE.md) - Vector database guide

## 🔗 Useful Links

- [GCP Console](https://console.cloud.google.com)
- [Billing](https://console.cloud.google.com/billing)
- [APIs](https://console.cloud.google.com/apis)
- [Storage](https://console.cloud.google.com/storage)
- [Cloud SQL](https://console.cloud.google.com/sql)
- [GKE](https://console.cloud.google.com/kubernetes)