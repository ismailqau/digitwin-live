#!/bin/bash

# Quick Cloud SQL Creation Script
# Creates a basic Cloud SQL PostgreSQL instance

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_header() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# Load environment
if [ -f ".env" ]; then
    set -a
    while IFS='=' read -r key value; do
        if [[ ! "$key" =~ ^[[:space:]]*# ]] && [[ -n "$key" ]] && [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
            value=$(echo "$value" | sed 's/#.*//' | sed 's/^["'\'']//' | sed 's/["'\'']$//' | xargs)
            export "$key=$value"
        fi
    done < .env
    set +a
fi

GCP_REGION=${GCP_REGION:-us-central1}
INSTANCE_NAME=${1:-digitwinlive-db}
DB_NAME=${2:-digitwinline_prod}

log_header "Cloud SQL Quick Setup"

# Check prerequisites
if ! command -v gcloud &> /dev/null; then
    log_error "gcloud CLI not installed"
    exit 1
fi

if [ -z "$GCP_PROJECT_ID" ]; then
    log_error "GCP_PROJECT_ID not set in .env"
    exit 1
fi

gcloud config set project "$GCP_PROJECT_ID" &> /dev/null

# Check if instance exists
if gcloud sql instances describe "$INSTANCE_NAME" &> /dev/null; then
    log_success "Cloud SQL instance $INSTANCE_NAME already exists"
    
    # Show connection info
    CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" --format="value(connectionName)")
    STATE=$(gcloud sql instances describe "$INSTANCE_NAME" --format="value(state)")
    
    echo ""
    log_info "Instance details:"
    echo "  Name: $INSTANCE_NAME"
    echo "  State: $STATE"
    echo "  Connection: $CONNECTION_NAME"
    echo ""
    log_info "To connect:"
    echo "  cloud_sql_proxy -instances=$CONNECTION_NAME=tcp:5432"
    echo "  psql \"host=127.0.0.1 port=5432 dbname=$DB_NAME user=postgres\""
    
    exit 0
fi

# Create instance
log_info "Creating Cloud SQL instance: $INSTANCE_NAME"
log_info "Region: $GCP_REGION"
log_info "Type: db-custom-1-3840 (1 vCPU, 3.75GB RAM)"
log_info "Storage: 10GB SSD"
log_info "Cost: ~$50/month"
echo ""
log_warning "This will take 5-10 minutes..."
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Cancelled"
    exit 0
fi

# Create instance
log_info "Creating instance..."

gcloud sql instances create "$INSTANCE_NAME" \
    --database-version=POSTGRES_17 \
    --tier=db-custom-1-3840 \
    --region="$GCP_REGION" \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=4 \
    --database-flags=max_connections=100 \
    --availability-type=zonal \
    --edition=ENTERPRISE

log_success "Instance created!"

# Set password
log_info "Setting root password..."
ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

gcloud sql users set-password postgres \
    --instance="$INSTANCE_NAME" \
    --password="$ROOT_PASSWORD"

log_success "Password set"

# Create database
log_info "Creating database: $DB_NAME..."

gcloud sql databases create "$DB_NAME" \
    --instance="$INSTANCE_NAME"

log_success "Database created"

# Get connection info
CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" --format="value(connectionName)")

# Print summary
log_header "Setup Complete!"

echo ""
log_success "Cloud SQL instance is ready!"
echo ""
log_info "Connection Details:"
echo "  Instance: $INSTANCE_NAME"
echo "  Database: $DB_NAME"
echo "  Connection: $CONNECTION_NAME"
echo "  Region: $GCP_REGION"
echo "  User: postgres"
echo "  Password: $ROOT_PASSWORD"
echo ""
log_warning "Save the password securely!"
echo ""

log_info "Next Steps:"
echo ""
echo "1. Install Cloud SQL Proxy:"
echo "   https://cloud.google.com/sql/docs/postgres/sql-proxy"
echo ""
echo "2. Start the proxy:"
echo "   cloud_sql_proxy -instances=$CONNECTION_NAME=tcp:5432"
echo ""
echo "3. Connect to database:"
echo "   psql \"host=127.0.0.1 port=5432 dbname=$DB_NAME user=postgres\""
echo ""
echo "4. Install pgvector extension:"
echo "   CREATE EXTENSION IF NOT EXISTS vector;"
echo ""
echo "5. Update .env file:"
echo "   DATABASE_URL=postgresql://postgres:$ROOT_PASSWORD@/cloudsql/$CONNECTION_NAME/$DB_NAME"
echo ""

log_info "To manage the instance:"
echo "  Start: ./scripts/gcp-manage.sh start sql-instance"
echo "  Stop:  ./scripts/gcp-manage.sh stop sql-instance"
echo "  Status: pnpm gcp:status"