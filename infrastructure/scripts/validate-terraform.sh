#!/bin/bash
# Validate Terraform configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

echo "Validating Terraform configuration..."

cd "$TERRAFORM_DIR"

# Format check
echo "Checking Terraform formatting..."
terraform fmt -check -recursive

# Validate configuration
echo "Validating Terraform configuration..."
terraform validate

echo "Terraform validation completed successfully"
