#!/bin/bash
# Plan Terraform changes for a specific environment

set -e

# Check if environment is provided
if [ -z "$1" ]; then
  echo "Usage: ./plan-terraform.sh <environment> [project_id]"
  echo "Example: ./plan-terraform.sh dev my-gcp-project"
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

echo "Planning Terraform changes for $ENVIRONMENT environment..."

cd "$TERRAFORM_DIR"

# Build terraform plan command
PLAN_CMD="terraform plan -var-file=environments/${ENVIRONMENT}.tfvars"

if [ -n "$PROJECT_ID" ]; then
  PLAN_CMD="$PLAN_CMD -var=project_id=$PROJECT_ID"
fi

PLAN_CMD="$PLAN_CMD -out=${ENVIRONMENT}.tfplan"

# Execute plan
eval $PLAN_CMD

echo "Terraform plan completed successfully for $ENVIRONMENT"
echo "Plan saved to ${ENVIRONMENT}.tfplan"
echo ""
echo "To apply this plan, run:"
echo "  ./apply-terraform.sh $ENVIRONMENT"
