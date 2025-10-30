# GCP Infrastructure Setup

This document describes the Google Cloud Platform infrastructure for the Real-Time Conversational Clone System.

## Overview

The infrastructure is managed using Terraform and supports three environments:

- **Development (dev)**: For active development and testing
- **Staging**: For pre-production testing and validation
- **Production (prod)**: For live user traffic

## Architecture Components

### Core Services

1. **Cloud Run**
   - WebSocket Server: Handles persistent connections for real-time communication
   - API Gateway: REST API for document management, authentication, and configuration
   - Auto-scaling: 0-100 instances based on load
   - VPC connectivity for private database access

2. **Cloud SQL (PostgreSQL)**
   - Primary database for user data, sessions, and metadata
   - Automated backups with point-in-time recovery (production)
   - High availability configuration (production only)
   - Private IP connectivity via VPC peering

3. **Cloud Storage**
   - Voice models bucket: Stores trained voice cloning models
   - Face models bucket: Stores facial recognition and animation models
   - Documents bucket: User-uploaded knowledge base documents
   - Conversation history bucket: Archived conversation transcripts
   - Lifecycle policies for automatic cleanup

4. **GKE (Google Kubernetes Engine)**
   - GPU-enabled node pools for TTS and lip-sync services
   - Autopilot mode for simplified management
   - Auto-scaling based on GPU utilization
   - Support for NVIDIA Tesla T4 GPUs

5. **Cloud KMS (Key Management Service)**
   - Encryption keys for database, storage, and secrets
   - Automatic key rotation every 90 days
   - Separate keys per data type

6. **Load Balancer**
   - Global HTTPS load balancer with SSL termination
   - Cloud Armor for DDoS protection and rate limiting
   - CDN enabled for static content
   - Automatic HTTP to HTTPS redirect

7. **Monitoring & Alerting**
   - Cloud Monitoring dashboards for system metrics
   - Alert policies for errors, latency, and resource usage
   - Email notifications for critical issues
   - Custom metrics for business KPIs

### Network Architecture

- **VPC Network**: Isolated network per environment
- **Subnets**: Regional subnets for compute resources
- **Cloud NAT**: Outbound internet connectivity for private resources
- **VPC Access Connector**: Connects Cloud Run to VPC
- **Private Service Connection**: Private connectivity to Cloud SQL

## Prerequisites

### Required Tools

- [Terraform](https://www.terraform.io/downloads) >= 1.5.0
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (gcloud CLI)
- Bash shell (Linux/macOS) or WSL (Windows)

### GCP Setup

1. **Create GCP Projects**

   ```bash
   # Create projects for each environment
   gcloud projects create digitwin-live-dev
   gcloud projects create digitwin-live-staging
   gcloud projects create digitwin-live-prod
   ```

2. **Enable Billing**
   - Link each project to a billing account via GCP Console

3. **Create Service Accounts**

   ```bash
   # For each environment (dev, staging, prod)
   gcloud iam service-accounts create terraform-sa \
     --project=digitwin-live-dev \
     --display-name="Terraform Service Account"

   # Grant necessary permissions
   gcloud projects add-iam-policy-binding digitwin-live-dev \
     --member="serviceAccount:terraform-sa@digitwin-live-dev.iam.gserviceaccount.com" \
     --role="roles/editor"

   # Create and download key
   gcloud iam service-accounts keys create terraform-key-dev.json \
     --iam-account=terraform-sa@digitwin-live-dev.iam.gserviceaccount.com
   ```

4. **Create Terraform State Buckets**

   ```bash
   # Create buckets for each environment
   gsutil mb -p digitwin-live-dev gs://digitwin-live-dev-tfstate
   gsutil mb -p digitwin-live-staging gs://digitwin-live-staging-tfstate
   gsutil mb -p digitwin-live-prod gs://digitwin-live-prod-tfstate

   # Enable versioning
   gsutil versioning set on gs://digitwin-live-dev-tfstate
   gsutil versioning set on gs://digitwin-live-staging-tfstate
   gsutil versioning set on gs://digitwin-live-prod-tfstate
   ```

## Deployment

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd digitwin-live
   ```

2. **Set up authentication**

   ```bash
   # Set the service account key path
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/terraform-key-dev.json"
   ```

3. **Make scripts executable**
   ```bash
   chmod +x infrastructure/scripts/*.sh
   ```

### Deploy to Development

```bash
# Initialize Terraform
./infrastructure/scripts/init-terraform.sh dev

# Plan changes
./infrastructure/scripts/plan-terraform.sh dev digitwin-live-dev

# Review the plan, then apply
./infrastructure/scripts/apply-terraform.sh dev
```

### Deploy to Staging

```bash
# Initialize Terraform
./infrastructure/scripts/init-terraform.sh staging

# Plan changes
./infrastructure/scripts/plan-terraform.sh staging digitwin-live-staging

# Review the plan, then apply
./infrastructure/scripts/apply-terraform.sh staging
```

### Deploy to Production

```bash
# Initialize Terraform
./infrastructure/scripts/init-terraform.sh prod

# Plan changes
./infrastructure/scripts/plan-terraform.sh prod digitwin-live-prod

# Review the plan carefully, then apply
./infrastructure/scripts/apply-terraform.sh prod
```

## CI/CD Pipeline

The infrastructure is automatically deployed via GitHub Actions:

### Workflow Triggers

- **Pull Requests**: Validates and plans changes
- **Push to `develop`**: Deploys to dev environment
- **Push to `main`**: Deploys to staging, then production (with approval)

### Required Secrets

Configure these secrets in GitHub repository settings:

- `GCP_SA_KEY_DEV`: Service account key for dev environment
- `GCP_SA_KEY_STAGING`: Service account key for staging environment
- `GCP_SA_KEY_PROD`: Service account key for production environment
- `GCP_PROJECT_ID_DEV`: Dev project ID
- `GCP_PROJECT_ID_STAGING`: Staging project ID
- `GCP_PROJECT_ID_PROD`: Production project ID

### Deployment Flow

1. Developer creates PR with infrastructure changes
2. GitHub Actions validates Terraform and creates plan
3. Reviewer approves PR
4. On merge to `develop`: Auto-deploys to dev
5. On merge to `main`: Auto-deploys to staging
6. Manual approval required for production deployment

## Configuration

### Environment Variables

Each environment has its own configuration file in `infrastructure/terraform/environments/`:

- `dev.tfvars`: Development configuration
- `staging.tfvars`: Staging configuration
- `prod.tfvars`: Production configuration

### Key Configuration Options

```hcl
# Cloud Run scaling
cloud_run_min_instances = 2      # Minimum instances
cloud_run_max_instances = 100    # Maximum instances
cloud_run_concurrency   = 50     # Requests per instance

# Database
database_tier       = "db-custom-8-32768"  # Instance size
high_availability   = true                  # Enable HA (prod only)

# GKE GPU pools
gke_gpu_node_pools = [
  {
    name         = "tts-gpu-pool"
    machine_type = "n1-standard-4"
    gpu_type     = "nvidia-tesla-t4"
    gpu_count    = 1
    min_nodes    = 1
    max_nodes    = 20
  }
]
```

## Validation

### Validate Configuration

```bash
./infrastructure/scripts/validate-terraform.sh
```

This checks:

- Terraform syntax
- Configuration validity
- Formatting compliance

### Manual Validation

```bash
cd infrastructure/terraform

# Format code
terraform fmt -recursive

# Validate
terraform validate

# Check for security issues (optional)
tfsec .
```

## Monitoring

### Access Dashboards

1. Navigate to [Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to Monitoring > Dashboards
4. Select the environment dashboard

### Key Metrics

- **Request Count**: Total requests per second
- **Latency (P95)**: 95th percentile response time
- **Error Rate**: Percentage of failed requests
- **CPU/Memory**: Resource utilization
- **Database Connections**: Active database connections

### Alerts

Configured alerts:

- High error rate (> 5%)
- High latency (> 3 seconds)
- Database connection failures
- High CPU usage (> 80%)

## Troubleshooting

### Common Issues

**1. Terraform Init Fails**

```bash
# Clear local state and re-initialize
rm -rf .terraform
./infrastructure/scripts/init-terraform.sh <env>
```

**2. Permission Denied**

```bash
# Verify service account has correct permissions
gcloud projects get-iam-policy <project-id>

# Re-authenticate
gcloud auth application-default login
```

**3. State Lock Error**

```bash
# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

**4. Resource Already Exists**

```bash
# Import existing resource
terraform import <resource_type>.<name> <resource_id>
```

### Getting Help

- Check Terraform logs: `terraform show`
- View GCP logs: Cloud Console > Logging
- Review plan before applying: Always run `plan` first
- Contact DevOps team for production issues

## Cost Optimization

### Development Environment

- Min instances: 0 (scale to zero)
- Smaller database tier
- Shorter data retention
- Estimated cost: $50-100/month

### Staging Environment

- Min instances: 1
- Medium database tier
- Moderate data retention
- Estimated cost: $200-400/month

### Production Environment

- Min instances: 2 (high availability)
- Large database tier with HA
- Full data retention
- Estimated cost: $1,000-2,000/month (baseline)

### Cost Reduction Tips

1. Use preemptible GPU nodes (60-70% savings)
2. Enable auto-scaling to scale down during low usage
3. Implement data lifecycle policies
4. Use Cloud CDN for static content
5. Monitor and optimize database queries

## Security

### Best Practices

1. **Secrets Management**
   - Never commit credentials to Git
   - Use Secret Manager for sensitive data
   - Rotate keys regularly

2. **Network Security**
   - Private IP for databases
   - VPC peering for internal communication
   - Cloud Armor for DDoS protection

3. **Access Control**
   - Principle of least privilege
   - Separate service accounts per service
   - Regular access reviews

4. **Encryption**
   - TLS for all connections
   - KMS for data at rest
   - Automatic key rotation

## Disaster Recovery

### Backup Strategy

- **Database**: Daily automated backups, 30-day retention
- **Storage**: Versioning enabled, lifecycle policies
- **Configuration**: Version controlled in Git

### Recovery Procedures

1. **Database Restore**

   ```bash
   gcloud sql backups restore <backup-id> \
     --backup-instance=<instance-name>
   ```

2. **Infrastructure Rebuild**

   ```bash
   # Re-apply Terraform configuration
   ./infrastructure/scripts/apply-terraform.sh <env>
   ```

3. **Data Recovery**
   ```bash
   # Restore from Cloud Storage versioning
   gsutil cp gs://bucket/object#<generation> gs://bucket/object
   ```

## Maintenance

### Regular Tasks

- **Weekly**: Review monitoring dashboards and alerts
- **Monthly**: Check for Terraform updates
- **Quarterly**: Review and optimize costs
- **Annually**: Rotate service account keys

### Updates

```bash
# Update Terraform providers
terraform init -upgrade

# Update GKE cluster
gcloud container clusters upgrade <cluster-name>

# Update Cloud Run services (via CI/CD)
```

## Additional Resources

- [Terraform GCP Provider Documentation](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [GCP Best Practices](https://cloud.google.com/docs/enterprise/best-practices-for-enterprise-organizations)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
