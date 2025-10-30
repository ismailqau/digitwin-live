#!/bin/bash
# Verify GCP infrastructure deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if environment is provided
if [ -z "$1" ]; then
  echo "Usage: ./verify-deployment.sh <environment> <project_id>"
  echo "Example: ./verify-deployment.sh dev digitwin-live-dev"
  exit 1
fi

ENVIRONMENT=$1
PROJECT_ID=$2

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo -e "${RED}Error: Environment must be dev, staging, or prod${NC}"
  exit 1
fi

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: Project ID is required${NC}"
  exit 1
fi

echo "========================================="
echo "Verifying $ENVIRONMENT Infrastructure"
echo "Project: $PROJECT_ID"
echo "========================================="
echo ""

# Set project
gcloud config set project $PROJECT_ID --quiet

# Function to check status
check_status() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $1${NC}"
    return 0
  else
    echo -e "${RED}✗ $1${NC}"
    return 1
  fi
}

# Track failures
FAILURES=0

# 1. Check Cloud Run Services
echo "1. Checking Cloud Run Services..."
WEBSOCKET_SERVICE=$(gcloud run services list --region=us-central1 --filter="metadata.name:${ENVIRONMENT}-websocket-server" --format="value(metadata.name)" 2>/dev/null)
if [ -n "$WEBSOCKET_SERVICE" ]; then
  check_status "WebSocket Server: $WEBSOCKET_SERVICE"
else
  check_status "WebSocket Server: NOT FOUND"
  ((FAILURES++))
fi

API_SERVICE=$(gcloud run services list --region=us-central1 --filter="metadata.name:${ENVIRONMENT}-api-gateway" --format="value(metadata.name)" 2>/dev/null)
if [ -n "$API_SERVICE" ]; then
  check_status "API Gateway: $API_SERVICE"
else
  check_status "API Gateway: NOT FOUND"
  ((FAILURES++))
fi
echo ""

# 2. Check Cloud SQL
echo "2. Checking Cloud SQL Instance..."
SQL_INSTANCE=$(gcloud sql instances list --filter="name:${ENVIRONMENT}-clone-db" --format="value(name)" 2>/dev/null)
if [ -n "$SQL_INSTANCE" ]; then
  SQL_STATUS=$(gcloud sql instances describe $SQL_INSTANCE --format="value(state)" 2>/dev/null)
  if [ "$SQL_STATUS" == "RUNNABLE" ]; then
    check_status "Cloud SQL: $SQL_INSTANCE (RUNNABLE)"
  else
    check_status "Cloud SQL: $SQL_INSTANCE ($SQL_STATUS)"
    ((FAILURES++))
  fi
else
  check_status "Cloud SQL: NOT FOUND"
  ((FAILURES++))
fi
echo ""

# 3. Check GKE Cluster
echo "3. Checking GKE Cluster..."
GKE_CLUSTER=$(gcloud container clusters list --filter="name:${ENVIRONMENT}-gpu-cluster" --format="value(name)" 2>/dev/null)
if [ -n "$GKE_CLUSTER" ]; then
  GKE_STATUS=$(gcloud container clusters describe $GKE_CLUSTER --region=us-central1 --format="value(status)" 2>/dev/null)
  if [ "$GKE_STATUS" == "RUNNING" ]; then
    check_status "GKE Cluster: $GKE_CLUSTER (RUNNING)"
  else
    check_status "GKE Cluster: $GKE_CLUSTER ($GKE_STATUS)"
    ((FAILURES++))
  fi
else
  check_status "GKE Cluster: NOT FOUND"
  ((FAILURES++))
fi
echo ""

# 4. Check Storage Buckets
echo "4. Checking Storage Buckets..."
BUCKETS=(
  "${PROJECT_ID}-${ENVIRONMENT}-voice-models"
  "${PROJECT_ID}-${ENVIRONMENT}-face-models"
  "${PROJECT_ID}-${ENVIRONMENT}-documents"
  "${PROJECT_ID}-${ENVIRONMENT}-conversations"
)

for BUCKET in "${BUCKETS[@]}"; do
  if gsutil ls "gs://${BUCKET}" &>/dev/null; then
    check_status "Bucket: gs://${BUCKET}"
  else
    check_status "Bucket: gs://${BUCKET} NOT FOUND"
    ((FAILURES++))
  fi
done
echo ""

# 5. Check VPC Network
echo "5. Checking VPC Network..."
VPC_NETWORK=$(gcloud compute networks list --filter="name:${ENVIRONMENT}-vpc" --format="value(name)" 2>/dev/null)
if [ -n "$VPC_NETWORK" ]; then
  check_status "VPC Network: $VPC_NETWORK"
else
  check_status "VPC Network: NOT FOUND"
  ((FAILURES++))
fi
echo ""

# 6. Check KMS Keyring
echo "6. Checking Cloud KMS..."
KMS_KEYRING=$(gcloud kms keyrings list --location=us-central1 --filter="name:${ENVIRONMENT}-keyring" --format="value(name)" 2>/dev/null | head -1)
if [ -n "$KMS_KEYRING" ]; then
  check_status "KMS Keyring: ${ENVIRONMENT}-keyring"
else
  check_status "KMS Keyring: NOT FOUND"
  ((FAILURES++))
fi
echo ""

# 7. Test Cloud Run Endpoints
echo "7. Testing Cloud Run Endpoints..."
if [ -n "$API_SERVICE" ]; then
  API_URL=$(gcloud run services describe $API_SERVICE --region=us-central1 --format="value(status.url)" 2>/dev/null)
  if [ -n "$API_URL" ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
    if [ "$HTTP_STATUS" == "200" ] || [ "$HTTP_STATUS" == "404" ]; then
      check_status "API Gateway Health Check: $HTTP_STATUS"
    else
      check_status "API Gateway Health Check: FAILED ($HTTP_STATUS)"
      ((FAILURES++))
    fi
  fi
fi
echo ""

# 8. Check Monitoring
echo "8. Checking Monitoring Setup..."
DASHBOARD=$(gcloud monitoring dashboards list --filter="displayName:${ENVIRONMENT}" --format="value(name)" 2>/dev/null | head -1)
if [ -n "$DASHBOARD" ]; then
  check_status "Monitoring Dashboard: Found"
else
  check_status "Monitoring Dashboard: NOT FOUND"
  ((FAILURES++))
fi
echo ""

# Summary
echo "========================================="
echo "Verification Summary"
echo "========================================="
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "Infrastructure is ready for use."
  echo ""
  echo "Next steps:"
  echo "  1. Deploy application code to Cloud Run"
  echo "  2. Deploy GPU services to GKE"
  echo "  3. Run database migrations"
  echo "  4. Configure monitoring alerts"
  exit 0
else
  echo -e "${RED}✗ $FAILURES check(s) failed${NC}"
  echo ""
  echo "Please review the errors above and:"
  echo "  1. Check Terraform apply logs"
  echo "  2. Verify service account permissions"
  echo "  3. Check GCP quotas"
  echo "  4. Review Cloud Console for detailed errors"
  exit 1
fi
