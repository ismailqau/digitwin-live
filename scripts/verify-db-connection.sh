#!/bin/bash

# =============================================================================
# Database Connection Verification Script
# =============================================================================
# Verifies that the database password in Secret Manager matches Cloud SQL
# and tests the connection
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

PROJECT_ID="digitwinlive"
INSTANCE_NAME="digitwinlive-db"
DB_NAME="digitwinlive-db"
DB_USER="postgres"

echo ""
log_info "=== Database Connection Verification ==="
echo ""

# 1. Check Secret Manager password
log_info "1. Checking Secret Manager password..."
if SECRET_PASSWORD=$(gcloud secrets versions access latest --secret=database-password --project=$PROJECT_ID 2>/dev/null); then
    log_success "Secret Manager password retrieved"
    log_info "   Password length: ${#SECRET_PASSWORD} characters"
else
    log_error "Failed to retrieve password from Secret Manager"
    exit 1
fi

# 2. Verify Cloud SQL instance exists
log_info "2. Checking Cloud SQL instance..."
if gcloud sql instances describe $INSTANCE_NAME --project=$PROJECT_ID &>/dev/null; then
    log_success "Cloud SQL instance exists: $INSTANCE_NAME"
else
    log_error "Cloud SQL instance not found: $INSTANCE_NAME"
    exit 1
fi

# 3. Check postgres user exists
log_info "3. Checking postgres user..."
if gcloud sql users list --instance=$INSTANCE_NAME --project=$PROJECT_ID 2>/dev/null | grep -q "postgres"; then
    log_success "Postgres user exists"
else
    log_error "Postgres user not found"
    exit 1
fi

# 4. Sync password (ensure Cloud SQL uses the same password as Secret Manager)
log_info "4. Syncing Cloud SQL password with Secret Manager..."
if gcloud sql users set-password $DB_USER \
    --instance=$INSTANCE_NAME \
    --password="$SECRET_PASSWORD" \
    --project=$PROJECT_ID &>/dev/null; then
    log_success "Password synced successfully"
else
    log_error "Failed to sync password"
    exit 1
fi

# 5. Test connection using Cloud SQL Proxy
log_info "5. Testing database connection..."
log_info "   Starting Cloud SQL Proxy..."

# Check if cloud-sql-proxy is installed
if ! command -v cloud-sql-proxy &> /dev/null; then
    log_error "cloud-sql-proxy not installed"
    log_info "   Install: https://cloud.google.com/sql/docs/postgres/connect-instance-auth-proxy#install"
    exit 1
fi

# Start proxy in background
cloud-sql-proxy $PROJECT_ID:us-central1:$INSTANCE_NAME &
PROXY_PID=$!

# Wait for proxy to start
sleep 5

# Test connection
log_info "   Testing connection to database..."
if PGPASSWORD="$SECRET_PASSWORD" psql -h 127.0.0.1 -U $DB_USER -d $DB_NAME -c "SELECT 1;" &>/dev/null; then
    log_success "Database connection successful!"
else
    log_error "Database connection failed"
    kill $PROXY_PID 2>/dev/null || true
    exit 1
fi

# Cleanup
kill $PROXY_PID 2>/dev/null || true

# 6. Verify Secret Manager permissions
log_info "6. Checking Secret Manager permissions..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
COMPUTE_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

if gcloud secrets get-iam-policy database-password --project=$PROJECT_ID 2>/dev/null | grep -q "$COMPUTE_SA"; then
    log_success "Compute service account has access to secret"
else
    log_error "Compute service account does NOT have access to secret"
    log_info "   Run: ./scripts/gcp-deploy.sh to fix permissions"
    exit 1
fi

echo ""
log_success "=== All verification checks passed ==="
echo ""
log_info "Summary:"
echo "  ✅ Secret Manager password: OK"
echo "  ✅ Cloud SQL instance: OK"
echo "  ✅ Postgres user: OK"
echo "  ✅ Password synced: OK"
echo "  ✅ Database connection: OK"
echo "  ✅ Secret permissions: OK"
echo ""
log_info "You can now deploy services with: pnpm gcp:deploy:api-gateway"
echo ""
