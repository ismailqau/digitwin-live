# Infrastructure Quick Reference

## Common Commands

### Initialize Terraform

```bash
./scripts/init-terraform.sh <env>
```

### Plan Changes

```bash
./scripts/plan-terraform.sh <env> <project-id>
```

### Apply Changes

```bash
./scripts/apply-terraform.sh <env>
```

### Verify Deployment

```bash
./scripts/verify-deployment.sh <env> <project-id>
```

### Validate Configuration

```bash
./scripts/validate-terraform.sh
```

### Destroy Infrastructure

```bash
./scripts/destroy-terraform.sh <env> <project-id>
```

## Environment Values

| Environment | Project ID Pattern   | Region      |
| ----------- | -------------------- | ----------- |
| dev         | digitwinlive         | us-central1 |
| staging     | digitwinlive-staging | us-central1 |
| prod        | digitwinlive-prod    | us-central1 |

## Service Account Keys

Store service account keys securely:

- Dev: `~/terraform-key-dev.json`
- Staging: `~/terraform-key-staging.json`
- Prod: `~/terraform-key-prod.json`

## Authentication

```bash
# Set credentials for environment
export GOOGLE_APPLICATION_CREDENTIALS="~/terraform-key-dev.json"

# Verify authentication
gcloud auth application-default print-access-token
```

## Terraform State Buckets

- Dev: `gs://digitwinlive-tfstate`
- Staging: `gs://digitwinlive-staging-tfstate`
- Prod: `gs://digitwinlive-prod-tfstate`

## Resource Naming Convention

Format: `{environment}-{resource-type}`

Examples:

- Cloud Run: `dev-websocket-server`, `dev-api-gateway`
- Cloud SQL: `dev-clone-db`
- GKE: `dev-gpu-cluster`
- VPC: `dev-vpc`
- Buckets: `{project-id}-{environment}-{type}`

## Useful GCP Commands

### List Cloud Run Services

```bash
gcloud run services list --region=us-central1
```

### List Cloud SQL Instances

```bash
gcloud sql instances list
```

### List GKE Clusters

```bash
gcloud container clusters list
```

### List Storage Buckets

```bash
gsutil ls
```

### View Logs

```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

### Connect to Cloud SQL

```bash
gcloud sql connect <instance-name> --user=app_user
```

### Get GKE Credentials

```bash
gcloud container clusters get-credentials <cluster-name> --region=us-central1
```

## Terraform Outputs

View all outputs:

```bash
cd infrastructure/terraform
terraform output
```

View specific output:

```bash
terraform output cloud_run_urls
```

## Troubleshooting

### Clear Terraform State

```bash
rm -rf infrastructure/terraform/.terraform
./scripts/init-terraform.sh <env>
```

### Force Unlock State

```bash
cd infrastructure/terraform
terraform force-unlock <lock-id>
```

### Import Existing Resource

```bash
cd infrastructure/terraform
terraform import <resource_type>.<name> <resource_id>
```

### View Terraform Plan

```bash
cd infrastructure/terraform
terraform show <env>.tfplan
```

## Cost Monitoring

### View Current Costs

```bash
gcloud billing accounts list
gcloud billing projects describe <project-id>
```

### Set Budget Alerts

1. Go to Cloud Console > Billing > Budgets & alerts
2. Create budget for each project
3. Set alert thresholds (50%, 90%, 100%)

## Security Checklist

- [ ] Service account keys not in Git
- [ ] GitHub secrets configured
- [ ] Database passwords in Secret Manager
- [ ] Cloud Armor rules active
- [ ] VPC firewall rules reviewed
- [ ] IAM permissions minimal
- [ ] Audit logging enabled
- [ ] Backups configured

## Support

- Documentation: [GCP-INFRASTRUCTURE.md](../docs/GCP-INFRASTRUCTURE.md)
- Setup Guide: [SETUP-GUIDE.md](./SETUP-GUIDE.md)
- Terraform Docs: [terraform.io](https://www.terraform.io/docs)
- GCP Docs: [cloud.google.com/docs](https://cloud.google.com/docs)
