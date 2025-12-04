# Infrastructure

This directory contains all infrastructure-as-code (IaC) configurations for the Real-Time DigiTwin Live System.

## Structure

```
infrastructure/
├── terraform/              # Terraform configurations
│   ├── main.tf            # Main Terraform configuration
│   ├── variables.tf       # Variable definitions
│   ├── outputs.tf         # Output definitions
│   ├── backends/          # Backend configurations per environment
│   ├── environments/      # Environment-specific variables
│   └── modules/           # Reusable Terraform modules
│       ├── cloud-sql/     # Cloud SQL database
│       ├── storage/       # Cloud Storage buckets
│       ├── cloud-run/     # Cloud Run services
│       ├── gke/           # GKE cluster
│       ├── kms/           # Cloud KMS encryption
│       ├── load-balancer/ # Load balancer and CDN
│       └── monitoring/    # Monitoring and alerting
└── scripts/               # Deployment and management scripts
    ├── init-terraform.sh      # Initialize Terraform
    ├── plan-terraform.sh      # Plan infrastructure changes
    ├── apply-terraform.sh     # Apply infrastructure changes
    ├── destroy-terraform.sh   # Destroy infrastructure
    └── validate-terraform.sh  # Validate configuration
```

## Quick Start

### Prerequisites

- Terraform >= 1.5.0
- Google Cloud SDK (gcloud CLI)
- GCP project with billing enabled
- Service account with appropriate permissions

**📖 Installation Help**: See [Tool Installation Guide](../docs/TOOL-INSTALLATION.md) for installing Terraform and gcloud CLI.

### Deploy Infrastructure

1. **Initialize Terraform**

   ```bash
   ./scripts/init-terraform.sh dev
   ```

2. **Plan Changes**

   ```bash
   ./scripts/plan-terraform.sh dev <your-project-id>
   ```

3. **Apply Changes**
   ```bash
   ./scripts/apply-terraform.sh dev
   ```

## Environments

- **dev**: Development environment for testing
- **staging**: Pre-production environment
- **prod**: Production environment

## Documentation

See [GCP Infrastructure Documentation](../docs/GCP-INFRASTRUCTURE.md) for detailed setup instructions, configuration options, and troubleshooting guides.

## CI/CD

Infrastructure changes are automatically deployed via GitHub Actions. See `.github/workflows/terraform-deploy.yml` for the pipeline configuration.

## Support

For infrastructure issues or questions, please refer to the main documentation or contact the DevOps team.
