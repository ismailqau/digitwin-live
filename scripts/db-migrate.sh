#!/bin/bash

# =============================================================================
# Database Migration Script
# =============================================================================
# Runs Prisma migrations with proper environment configuration
# Ensures pgvector extension is enabled before running migrations
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Load environment
ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

log_info "Loading environment from $ENV_FILE"
source "$ENV_FILE"

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL not set in $ENV_FILE"
    exit 1
fi

log_success "DATABASE_URL configured"
echo "  Connection: ${DATABASE_URL%%@*}@***"

# Check if Cloud SQL Proxy is running (if using Cloud SQL)
if [[ "$DATABASE_URL" == *"127.0.0.1:5433"* ]] || [[ "$DATABASE_URL" == *"localhost:5433"* ]]; then
    log_info "Checking Cloud SQL Proxy connection..."
    
    if ! nc -z 127.0.0.1 5433 2>/dev/null; then
        log_error "Cloud SQL Proxy not running on port 5433"
        log_info "Start it with: cloud-sql-proxy digitwinlive:us-central1:digitwinlive-db --port=5433"
        exit 1
    fi
    
    log_success "Cloud SQL Proxy is running"
fi

# Verify pgvector extension is enabled
log_info "Verifying pgvector extension..."

PGPASSWORD="${DATABASE_PASSWORD:-$POSTGRES_PASSWORD}" psql \
    -h "${DATABASE_HOST:-127.0.0.1}" \
    -p "${DATABASE_PORT:-5433}" \
    -U "${DATABASE_USER:-postgres}" \
    -d "${DATABASE_NAME:-digitwinlive-db}" \
    -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || {
    log_warning "Could not verify pgvector extension (may already be enabled)"
}

log_success "pgvector extension ready"

# Run Prisma migrations
log_info "Running Prisma migrations..."
echo ""

export DATABASE_URL

if pnpm db:migrate; then
    log_success "Migrations completed successfully!"
    echo ""
    
    # Show migration status
    log_info "Migration status:"
    pnpm --filter @clone/database prisma migrate status
    
    echo ""
    log_success "Database is ready!"
    log_info "Next steps:"
    echo "  1. Verify vector columns: psql -c '\d document_chunks'"
    echo "  2. Generate Prisma client: pnpm db:generate"
    echo "  3. Start your services: pnpm dev"
else
    log_error "Migration failed!"
    exit 1
fi
