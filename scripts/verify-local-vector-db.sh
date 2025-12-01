#!/bin/bash

# Local Vector Database Verification Script
# This script verifies vector database setup without requiring GCP access

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Load environment variables safely
load_env() {
    if [ -f ".env" ]; then
        log_info "Loading environment variables from .env"
        set -a
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            if [[ ! "$key" =~ ^[[:space:]]*# ]] && [[ -n "$key" ]] && [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
                # Remove inline comments and quotes
                value=$(echo "$value" | sed 's/#.*//' | sed 's/^["'\'']//' | sed 's/["'\'']$//' | xargs)
                export "$key=$value"
            fi
        done < .env
        set +a
        log_success "Environment variables loaded"
    else
        log_warning ".env file not found"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        log_success "Node.js is installed: $(node --version)"
    else
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check if pg module is available
    if node -e "require('pg')" 2>/dev/null; then
        log_success "PostgreSQL client (pg) is available"
    else
        log_warning "PostgreSQL client (pg) not found"
        log_info "Run: pnpm install"
    fi
    
    # Docker is optional - not required for pgvector
    if command -v docker &> /dev/null; then
        log_success "Docker is installed: $(docker --version | head -1)"
    else
        log_info "Docker is not installed (optional)"
    fi
}

# Test PostgreSQL connection
test_postgresql() {
    log_header "Testing PostgreSQL"
    
    if [ -z "$DATABASE_URL" ]; then
        log_warning "DATABASE_URL not set, skipping PostgreSQL tests"
        return
    fi
    
    log_info "Database URL: $(echo $DATABASE_URL | sed 's/:[^:@]*@/:***@/')"
    
    # Test connection using psql if available
    if command -v psql &> /dev/null; then
        if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
            log_success "PostgreSQL connection successful"
            
            # Check pgvector extension
            if psql "$DATABASE_URL" -c "SELECT * FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | grep -q "vector"; then
                log_success "pgvector extension is installed"
            else
                log_warning "pgvector extension not installed"
                log_info "Install with: CREATE EXTENSION IF NOT EXISTS vector;"
            fi
            
            # Check DocumentChunk table
            if psql "$DATABASE_URL" -c "\dt document_chunks" 2>/dev/null | grep -q "document_chunks"; then
                log_success "DocumentChunk table exists"
            else
                log_warning "DocumentChunk table not found"
                log_info "Run: pnpm db:migrate"
            fi
        else
            log_error "PostgreSQL connection failed"
            log_info "Check DATABASE_URL and ensure PostgreSQL is running"
        fi
    else
        log_info "psql not available, using Node.js verification"
    fi
}

# Test pgvector extension
test_pgvector() {
    log_header "Testing pgvector Extension"
    
    # Check if pgvector extension is installed
    if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
        PGVECTOR_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector');" 2>/dev/null | xargs)
        
        if [ "$PGVECTOR_CHECK" = "t" ]; then
            log_success "pgvector extension is installed"
            
            # Get version
            PGVECTOR_VERSION=$(psql "$DATABASE_URL" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | xargs)
            if [ -n "$PGVECTOR_VERSION" ]; then
                log_info "pgvector version: $PGVECTOR_VERSION"
            fi
        else
            log_error "pgvector extension is not installed"
            log_info "Install with:"
            echo "  psql \$DATABASE_URL -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
            echo ""
            log_info "Or see docs/VECTOR-DATABASE.md for installation instructions"
        fi
    else
        log_info "Skipping pgvector check (psql not available or DATABASE_URL not set)"
    fi
}

# Run Node.js verification
run_node_verification() {
    log_header "Running Comprehensive Verification"
    
    if [ -f "scripts/verify-vector-db.js" ]; then
        log_info "Running Node.js verification script..."
        echo ""
        
        if node scripts/verify-vector-db.js; then
            log_success "Node.js verification passed"
        else
            log_error "Node.js verification failed"
            log_info "Check the detailed output above"
            return 1
        fi
    else
        log_warning "verify-vector-db.js not found"
        log_info "Run from project root directory"
    fi
}

# Print summary
print_summary() {
    log_header "Verification Summary"
    
    echo ""
    log_info "Vector Database Configuration:"
    echo "  Type: PostgreSQL with pgvector"
        echo "  Database: $(echo $DATABASE_URL | sed 's/:[^:@]*@/:***@/' | sed 's/postgresql:\/\///' | cut -d'/' -f2)"
    fi
    
    echo ""
    log_info "Next Steps:"
    echo "  1. Fix any errors or warnings shown above"
    echo "  2. Run: pnpm verify:vector-db (for detailed verification)"
    echo "  3. Run: pnpm health:vector-db (for quick health check)"
    echo ""
    log_info "Documentation:"
    echo "  - docs/VECTOR-DATABASE-SETUP.md"
    echo "  - docs/VECTOR-DATABASE-VERIFICATION.md"
    echo "  - docs/TROUBLESHOOTING.md"
}

# Main execution
main() {
    log_header "Local Vector Database Verification"
    log_info "Verifying vector database setup locally"
    
    load_env
    check_prerequisites
    test_postgresql
    test_pgvector
    run_node_verification
    print_summary
    
    log_header "Verification Complete"
    log_success "Local vector database verification finished!"
}

# Run main function
main "$@"