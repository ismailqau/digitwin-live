#!/bin/bash
# Initialize Terraform for a specific environment

set -e

# Check if environment is provided
if [ -z "$1" ]; then
  echo "Usage: ./init-terraform.sh <environment>"
  echo "Example: ./init-terraform.sh dev"
  exit 1
fi

ENVIRONMENT=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "Error: Environment must be dev, staging, or prod"
  exit 1
fi

echo "Initializing Terraform for $ENVIRONMENT environment..."

cd "$TERRAFORM_DIR"

# Initialize Terraform with backend configuration
terraform init \
  -backend-config="backends/${ENVIRONMENT}.hcl" \
  -reconfigure

echo "Terraform initialized successfully for $ENVIRONMENT"
