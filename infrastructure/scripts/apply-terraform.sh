#!/bin/bash
# Apply Terraform changes for a specific environment

set -e

# Check if environment is provided
if [ -z "$1" ]; then
  echo "Usage: ./apply-terraform.sh <environment>"
  echo "Example: ./apply-terraform.sh dev"
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

# Check if plan file exists
if [ ! -f "$TERRAFORM_DIR/${ENVIRONMENT}.tfplan" ]; then
  echo "Error: Plan file not found. Please run plan-terraform.sh first"
  exit 1
fi

echo "Applying Terraform changes for $ENVIRONMENT environment..."

cd "$TERRAFORM_DIR"

# Apply the plan
terraform apply "${ENVIRONMENT}.tfplan"

# Clean up plan file
rm -f "${ENVIRONMENT}.tfplan"

echo "Terraform apply completed successfully for $ENVIRONMENT"
echo ""
echo "To view outputs, run:"
echo "  terraform output"
