# GCP Infrastructure Setup Guide

This guide walks you through setting up the complete GCP infrastructure for the Real-Time DigitWin Live System from scratch.

## Prerequisites Checklist

- [ ] Google Cloud account with billing enabled
- [ ] Terraform >= 1.5.0 installed
- [ ] Google Cloud SDK (gcloud) installed
- [ ] Git installed
- [ ] Bash shell (Linux/macOS) or WSL (Windows)

## Step 1: Install Required Tools

### Install Terraform

**macOS (Homebrew)**:

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

**Linux**:

```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

**Verify Installation**:

```bash
terraform version
# Should show: Terraform v1.5.0 or higher
```

### Install Google Cloud SDK

**macOS (Homebrew)**:

```bash
brew install google-cloud-sdk
```

**Linux**:

```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Verify Installation**:

```bash
gcloud version
```

## Step 2: Set Up GCP Projects

### Create Projects

```bash
# Set your organization ID (if applicable)
export ORG_ID="your-org-id"  # Optional

# Create projects for each environment
gcloud projects create digitwinlive --name="DigitWin Live Dev"
gcloud projects create digitwin-live-staging --name="DigitWin Live Staging"
gcloud projects create digitwin-live-prod --name="DigitWin Live Prod"
```

### Link Billing Account

```bash
# List billing accounts
gcloud billing accounts list

# Set billing account ID
export BILLING_ACCOUNT_ID="your-billing-account-id"

# Link projects to billing
gcloud billing projects link digitwinlive --billing-account=$BILLING_ACCOUNT_ID
gcloud billing projects link digitwin-live-staging --billing-account=$BILLING_ACCOUNT_ID
gcloud billing projects link digitwin-live-prod --billing-account=$BILLING_ACCOUNT_ID
```

## Step 3: Create Service Accounts

### Development Environment

```bash
# Set project
gcloud config set project digitwinlive

# Create service account
gcloud iam service-accounts create terraform-sa \
  --display-name="Terraform Service Account" \
  --description="Service account for Terraform infrastructure management"

# Grant necessary roles
gcloud projects add-iam-policy-binding digitwinlive \
  --member="serviceAccount:terraform-sa@digitwinlive.iam.gserviceaccount.com" \
  --role="roles/editor"

gcloud projects add-iam-policy-binding digitwinlive \
  --member="serviceAccount:terraform-sa@digitwinlive.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountAdmin"

gcloud projects add-iam-policy-binding digitwinlive \
  --member="serviceAccount:terraform-sa@digitwinlive.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectIamAdmin"

# Create and download key
gcloud iam service-accounts keys create ~/terraform-key-dev.json \
  --iam-account=terraform-sa@digitwinlive.iam.gserviceaccount.com

echo "✓ Dev service account created: ~/terraform-key-dev.json"
```

### Staging Environment

```bash
# Set project
gcloud config set project digitwin-live-staging

# Create service account
gcloud iam service-accounts create terraform-sa \
  --display-name="Terraform Service Account"

# Grant roles
gcloud projects add-iam-policy-binding digitwin-live-staging \
  --member="serviceAccount:terraform-sa@digitwin-live-staging.iam.gserviceaccount.com" \
  --role="roles/editor"

gcloud projects add-iam-policy-binding digitwin-live-staging \
  --member="serviceAccount:terraform-sa@digitwin-live-staging.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountAdmin"

gcloud projects add-iam-policy-binding digitwin-live-staging \
  --member="serviceAccount:terraform-sa@digitwin-live-staging.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectIamAdmin"

# Create key
gcloud iam service-accounts keys create ~/terraform-key-staging.json \
  --iam-account=terraform-sa@digitwin-live-staging.iam.gserviceaccount.com

echo "✓ Staging service account created: ~/terraform-key-staging.json"
```

### Production Environment

```bash
# Set project
gcloud config set project digitwin-live-prod

# Create service account
gcloud iam service-accounts create terraform-sa \
  --display-name="Terraform Service Account"

# Grant roles
gcloud projects add-iam-policy-binding digitwin-live-prod \
  --member="serviceAccount:terraform-sa@digitwin-live-prod.iam.gserviceaccount.com" \
  --role="roles/editor"

gcloud projects add-iam-policy-binding digitwin-live-prod \
  --member="serviceAccount:terraform-sa@digitwin-live-prod.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountAdmin"

gcloud projects add-iam-policy-binding digitwin-live-prod \
  --member="serviceAccount:terraform-sa@digitwin-live-prod.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectIamAdmin"

# Create key
gcloud iam service-accounts keys create ~/terraform-key-prod.json \
  --iam-account=terraform-sa@digitwin-live-prod.iam.gserviceaccount.com

echo "✓ Prod service account created: ~/terraform-key-prod.json"
```

## Step 4: Create Terraform State Buckets

```bash
# Development
gcloud config set project digitwinlive
gsutil mb -p digitwinlive -l US gs://digitwinlive-tfstate
gsutil versioning set on gs://digitwinlive-tfstate
echo "✓ Dev state bucket created"

# Staging
gcloud config set project digitwin-live-staging
gsutil mb -p digitwin-live-staging -l US gs://digitwin-live-staging-tfstate
gsutil versioning set on gs://digitwin-live-staging-tfstate
echo "✓ Staging state bucket created"

# Production
gcloud config set project digitwin-live-prod
gsutil mb -p digitwin-live-prod -l US gs://digitwin-live-prod-tfstate
gsutil versioning set on gs://digitwin-live-prod-tfstate
echo "✓ Prod state bucket created"
```

## Step 5: Clone Repository and Configure

```bash
# Clone repository
git clone <repository-url>
cd digitwin-live

# Set up authentication for dev environment
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/terraform-key-dev.json"

# Verify authentication
gcloud auth application-default print-access-token
```

## Step 6: Deploy Development Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure

# Initialize Terraform
./scripts/init-terraform.sh dev

# Validate configuration
./scripts/validate-terraform.sh

# Plan infrastructure
./scripts/plan-terraform.sh dev digitwinlive

# Review the plan output carefully
# Look for:
# - Resources to be created
# - Estimated costs
# - Any warnings or errors

# Apply infrastructure (if plan looks good)
./scripts/apply-terraform.sh dev
```

**Expected Output**:

```
Apply complete! Resources: 45 added, 0 changed, 0 destroyed.

Outputs:

cloud_run_urls = {
  "api_gateway" = "https://dev-api-gateway-xxx.run.app"
  "websocket_server" = "https://dev-websocket-server-xxx.run.app"
}
database_connection_name = "digitwinlive:us-central1:dev-clone-db"
gke_cluster_name = "dev-gpu-cluster"
...
```

## Step 7: Verify Deployment

### Check Cloud Run Services

```bash
gcloud config set project digitwinlive
gcloud run services list --region=us-central1
```

Expected services:

- `dev-websocket-server`
- `dev-api-gateway`

### Check Cloud SQL Instance

```bash
gcloud sql instances list
```

Expected instance:

- `dev-clone-db` (status: RUNNABLE)

### Check GKE Cluster

```bash
gcloud container clusters list
```

Expected cluster:

- `dev-gpu-cluster` (status: RUNNING)

### Check Storage Buckets

```bash
gsutil ls
```

Expected buckets:

- `gs://digitwinlive-voice-models`
- `gs://digitwinlive-face-models`
- `gs://digitwinlive-documents`
- `gs://digitwinlive-conversations`

### View Terraform Outputs

```bash
cd infrastructure/terraform
terraform output
```

## Step 8: Configure GitHub Actions (Optional)

If using CI/CD:

1. **Add Secrets to GitHub Repository**:
   - Go to repository Settings > Secrets and variables > Actions
   - Add the following secrets:
     - `GCP_SA_KEY_DEV`: Content of `~/terraform-key-dev.json`
     - `GCP_SA_KEY_STAGING`: Content of `~/terraform-key-staging.json`
     - `GCP_SA_KEY_PROD`: Content of `~/terraform-key-prod.json`
     - `GCP_PROJECT_ID_DEV`: `digitwinlive`
     - `GCP_PROJECT_ID_STAGING`: `digitwin-live-staging`
     - `GCP_PROJECT_ID_PROD`: `digitwin-live-prod`

2. **Test Workflow**:

   ```bash
   # Create a test branch
   git checkout -b test-infrastructure

   # Make a small change to trigger workflow
   echo "# Test" >> infrastructure/README.md
   git add infrastructure/README.md
   git commit -m "test: trigger infrastructure workflow"
   git push origin test-infrastructure

   # Create PR and check Actions tab
   ```

## Step 9: Deploy Staging and Production

### Staging

```bash
# Set authentication
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/terraform-key-staging.json"

# Initialize
./scripts/init-terraform.sh staging

# Plan and apply
./scripts/plan-terraform.sh staging digitwin-live-staging
./scripts/apply-terraform.sh staging
```

### Production

```bash
# Set authentication
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/terraform-key-prod.json"

# Initialize
./scripts/init-terraform.sh prod

# Plan and apply
./scripts/plan-terraform.sh prod digitwin-live-prod

# IMPORTANT: Review plan very carefully before applying
./scripts/apply-terraform.sh prod
```

## Step 10: Post-Deployment Configuration

### Set Up Database

```bash
# Connect to Cloud SQL
gcloud sql connect dev-clone-db --user=app_user

# Run migrations (from application)
cd ../../packages/database
pnpm prisma migrate deploy
```

### Configure Monitoring

1. Go to [Cloud Console](https://console.cloud.google.com)
2. Navigate to Monitoring > Dashboards
3. Verify the environment dashboard is created
4. Set up notification channels (email, Slack, etc.)

### Test Services

```bash
# Get service URLs
cd infrastructure/terraform
terraform output cloud_run_urls

# Test API Gateway
curl https://dev-api-gateway-xxx.run.app/health

# Expected response:
# {"status":"healthy","timestamp":"..."}
```

## Troubleshooting

### Issue: "Permission Denied" Error

**Solution**:

```bash
# Verify service account has correct permissions
gcloud projects get-iam-policy digitwinlive

# Re-authenticate
gcloud auth application-default login
```

### Issue: "Backend Initialization Failed"

**Solution**:

```bash
# Verify bucket exists
gsutil ls gs://digitwinlive-tfstate

# If not, create it
gsutil mb -p digitwinlive gs://digitwinlive-tfstate
gsutil versioning set on gs://digitwinlive-tfstate
```

### Issue: "Resource Already Exists"

**Solution**:

```bash
# Import existing resource
terraform import <resource_type>.<name> <resource_id>

# Example:
terraform import google_storage_bucket.voice_models digitwinlive-voice-models
```

### Issue: "Quota Exceeded"

**Solution**:

1. Go to [Quotas page](https://console.cloud.google.com/iam-admin/quotas)
2. Search for the exceeded quota
3. Request quota increase
4. Wait for approval (usually 1-2 business days)

## Cost Estimation

### Development Environment

- Cloud Run: ~$10-20/month (minimal usage)
- Cloud SQL: ~$30-40/month (db-custom-2-8192)
- GKE: ~$50-100/month (minimal GPU usage)
- Storage: ~$5-10/month
- **Total: ~$100-170/month**

### Staging Environment

- Cloud Run: ~$50-100/month
- Cloud SQL: ~$150-200/month (db-custom-4-16384)
- GKE: ~$200-400/month
- Storage: ~$20-30/month
- **Total: ~$420-730/month**

### Production Environment

- Cloud Run: ~$200-500/month
- Cloud SQL: ~$500-800/month (db-custom-8-32768 with HA)
- GKE: ~$1000-2000/month
- Storage: ~$50-100/month
- **Total: ~$1750-3400/month**

## Next Steps

1. **Deploy Application Code**: Build and deploy Docker images to Cloud Run and GKE
2. **Configure DNS**: Point your domain to the load balancer IP
3. **Set Up SSL**: Configure SSL certificates for your domain
4. **Enable Monitoring**: Set up alerts and dashboards
5. **Run Tests**: Execute integration and load tests
6. **Documentation**: Update team documentation with URLs and credentials

## Security Checklist

- [ ] Service account keys stored securely (not in Git)
- [ ] GitHub secrets configured for CI/CD
- [ ] Database passwords rotated and stored in Secret Manager
- [ ] Cloud Armor rules configured
- [ ] VPC firewall rules reviewed
- [ ] IAM permissions follow least privilege
- [ ] Audit logging enabled
- [ ] Backup strategy documented

## Support

For issues or questions:

- Check [GCP Infrastructure Documentation](../docs/GCP-INFRASTRUCTURE.md)
- Review [Terraform logs](https://console.cloud.google.com/logs)
- Contact DevOps team

## Cleanup (Development Only)

To destroy development infrastructure:

```bash
./scripts/destroy-terraform.sh dev digitwinlive
```

**WARNING**: This will delete all resources. Make sure you have backups!
