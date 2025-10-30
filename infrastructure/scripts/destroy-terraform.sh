#!/bin/bash
# Destroy Terraform infrastructure for a specific environment

set -e

# Check if environment is provided
if [ -z "$1" ]; then
  echo "Usage: ./destroy-terraform.sh <environment> [project_id]"
  echo "Example: ./destroy-terraform.sh dev my-gcp-project"
  exit 1
fi

ENVIRONMENT=$1
PROJECT_ID=${2:-""}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "Error: Environment must be dev, staging, or prod"
  exit 1
fi

# Extra confirmation for production
if [ "$ENVIRONMENT" == "prod" ]; then
  echo "WARNING: You are about to destroy PRODUCTION infrastructure!"
  read -p "Type 'destroy-prod' to confirm: " confirmation
  if [ "$confirmation" != "destroy-prod" ]; then
    echo "Destruction cancelled"
    exit 1
  fi
fi

echo "Destroying Terraform infrastructure for $ENVIRONMENT environment..."

cd "$TERRAFORM_DIR"

# Build terraform destroy command
DESTROY_CMD="terraform destroy -var-file=environments/${ENVIRONMENT}.tfvars"

if [ -n "$PROJECT_ID" ]; then
  DESTROY_CMD="$DESTROY_CMD -var=project_id=$PROJECT_ID"
fi

# Execute destroy
eval $DESTROY_CMD

echo "Terraform destroy completed for $ENVIRONMENT"
