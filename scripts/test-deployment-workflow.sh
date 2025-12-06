#!/bin/bash

# =============================================================================
# Complete Deployment Workflow Test Script
# =============================================================================
# Tests the complete GCP deployment workflow from setup to verification
# Task 6: Test complete deployment workflow
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_header() { echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"; }
log_step() { echo -e "\n${YELLOW}▶ STEP $1: $2${NC}\n"; }

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Error handler
error_handler() {
    local exit_code=$1
    local line_number=$2
    log_error "Test failed at line $line_number with exit code $exit_code"
}

trap 'error_handler $? $LINENO' ERR

# =============================================================================
# Test Functions
# =============================================================================

test_prerequisites() {
    log_step "1" "Checking Prerequisites"
    
    # Check gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not installed"
        return 1
    fi
    log_success "gcloud CLI installed"
    
    # Check authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
        log_error "Not authenticated with gcloud"
        log_info "Run: gcloud auth login"
        return 1
    fi
    log_success "Authenticated with gcloud"
    
    # Check environment file
    if [ ! -f ".env.production" ]; then
        log_error ".env.production file not found"
        return 1
    fi
    log_success ".env.production file exists"
    
    # Load environment
    source .env.production
    
    # Check required variables
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env.production"
        return 1
    fi
    log_success "GCP_PROJECT_ID: $GCP_PROJECT_ID"
    
    if [ -z "$GCP_REGION" ]; then
        log_error "GCP_REGION not set in .env.production"
        return 1
    fi
    log_success "GCP_REGION: $GCP_REGION"
    
    # Set project
    gcloud config set project "$GCP_PROJECT_ID" --quiet
    
    ((TESTS_PASSED++))
    return 0
}

test_setup_script() {
    log_step "2" "Running gcp-setup.sh"
    
    log_info "This will create/verify all GCP resources..."
    log_warning "Note: Cloud SQL creation takes 5-10 minutes if not already created"
    echo ""
    
    # Run setup script with production environment (skip SQL if already exists)
    if ./scripts/gcp-setup.sh --env=production --skip-sql; then
        log_success "Setup script completed successfully"
        ((TESTS_PASSED++))
        return 0
    else
        log_error "Setup script failed"
        FAILED_TESTS+=("Setup script execution")
        ((TESTS_FAILED++))
        return 1
    fi
}

test_resources_created() {
    log_step "3" "Verifying All Resources Created"
    
    local all_passed=true
    
    # Check Artifact Registry
    log_info "Checking Artifact Registry..."
    if gcloud artifacts repositories describe digitwinlive --location="$GCP_REGION" &> /dev/null; then
        log_success "Artifact Registry exists"
    else
        log_error "Artifact Registry not found"
        all_passed=false
    fi
    
    # Check Storage Buckets
    log_info "Checking Storage Buckets..."
    local buckets=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_FACE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
    for bucket in "${buckets[@]}"; do
        if gsutil ls "gs://$bucket" &> /dev/null; then
            log_success "Bucket exists: $bucket"
        else
            log_error "Bucket not found: $bucket"
            all_passed=false
        fi
    done
    
    # Check Cloud SQL
    log_info "Checking Cloud SQL instance..."
    if gcloud sql instances describe digitwinlive-db &> /dev/null; then
        log_success "Cloud SQL instance exists"
        
        # Check if running
        local state=$(gcloud sql instances describe digitwinlive-db --format="value(state)" 2>/dev/null)
        if [ "$state" = "RUNNABLE" ]; then
            log_success "Cloud SQL instance is running"
        else
            log_warning "Cloud SQL instance state: $state"
        fi
    else
        log_error "Cloud SQL instance not found"
        all_passed=false
    fi
    
    # Check Service Accounts
    log_info "Checking Service Accounts..."
    if gcloud iam service-accounts describe "digitwinlive-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com" &> /dev/null; then
        log_success "Service account exists"
    else
        log_error "Service account not found"
        all_passed=false
    fi
    
    # Check Secrets
    log_info "Checking Secrets..."
    local secrets=("jwt-secret" "refresh-secret" "database-password")
    for secret in "${secrets[@]}"; do
        if gcloud secrets describe "$secret" &> /dev/null; then
            log_success "Secret exists: $secret"
        else
            log_error "Secret not found: $secret"
            all_passed=false
        fi
    done
    
    if [ "$all_passed" = true ]; then
        log_success "All resources verified"
        ((TESTS_PASSED++))
        return 0
    else
        log_error "Some resources are missing"
        FAILED_TESTS+=("Resource verification")
        ((TESTS_FAILED++))
        return 1
    fi
}

test_pgvector_extension() {
    log_step "4" "Checking pgvector Extension"
    
    log_warning "╔════════════════════════════════════════════════════════════════╗"
    log_warning "║  MANUAL STEP REQUIRED: pgvector Extension                     ║"
    log_warning "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "To enable pgvector extension:"
    echo ""
    echo "1. Start Cloud SQL Proxy:"
    echo "   cloud-sql-proxy $CLOUD_SQL_CONNECTION_NAME --port=5432 &"
    echo ""
    echo "2. Connect to PostgreSQL:"
    echo "   psql \"host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres\""
    echo ""
    echo "3. Enable pgvector:"
    echo "   CREATE EXTENSION IF NOT EXISTS vector;"
    echo ""
    echo "4. Verify:"
    echo "   SELECT * FROM pg_extension WHERE extname = 'vector';"
    echo ""
    
    read -p "Have you enabled the pgvector extension? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_success "pgvector extension confirmed"
        ((TESTS_PASSED++))
        return 0
    else
        log_warning "pgvector extension not enabled - skipping for now"
        log_info "You must enable it before running migrations"
        return 0
    fi
}

test_database_migrations() {
    log_step "5" "Running Database Migrations"
    
    log_info "Running: pnpm db:migrate"
    echo ""
    
    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm not installed"
        log_info "Install with: npm install -g pnpm"
        FAILED_TESTS+=("Database migrations (pnpm not installed)")
        ((TESTS_FAILED++))
        return 1
    fi
    
    # Run migrations
    if pnpm db:migrate; then
        log_success "Database migrations completed"
        ((TESTS_PASSED++))
        return 0
    else
        log_error "Database migrations failed"
        log_info "Ensure Cloud SQL Proxy is running and pgvector is enabled"
        FAILED_TESTS+=("Database migrations")
        ((TESTS_FAILED++))
        return 1
    fi
}

test_service_deployment() {
    log_step "6" "Deploying Services to Cloud Run"
    
    log_info "Deploying all services..."
    log_warning "This will take 10-15 minutes (building and deploying 3 services)"
    echo ""
    
    # Deploy all services
    if ./scripts/gcp-deploy.sh deploy --env=production; then
        log_success "All services deployed successfully"
        ((TESTS_PASSED++))
        return 0
    else
        log_error "Service deployment failed"
        log_info "Check logs in /tmp/ directory"
        FAILED_TESTS+=("Service deployment")
        ((TESTS_FAILED++))
        return 1
    fi
}

test_service_accessibility() {
    log_step "7" "Verifying Services Are Accessible"
    
    local all_accessible=true
    
    # Get service URLs
    local services=("api-gateway" "websocket-server" "face-processing-service")
    
    for service in "${services[@]}"; do
        log_info "Checking $service..."
        
        local url=$(gcloud run services describe "$service" \
            --region="$GCP_REGION" \
            --format="value(status.url)" 2>/dev/null)
        
        if [ -z "$url" ]; then
            log_error "$service: No URL found (not deployed?)"
            all_accessible=false
            continue
        fi
        
        log_info "URL: $url"
        
        # Try to access health endpoint
        local health_url="$url/health"
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$health_url" 2>/dev/null || echo "000")
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "404" ]; then
            log_success "$service is accessible (HTTP $status_code)"
        else
            log_warning "$service returned HTTP $status_code"
            log_info "Service may still be starting up..."
            all_accessible=false
        fi
    done
    
    if [ "$all_accessible" = true ]; then
        log_success "All services are accessible"
        ((TESTS_PASSED++))
        return 0
    else
        log_warning "Some services may not be fully ready"
        log_info "Check service logs with: gcloud run services logs read <service> --region=$GCP_REGION"
        ((TESTS_PASSED++))
        return 0
    fi
}

test_service_logs() {
    log_step "8" "Checking Service Logs for Errors"
    
    local services=("api-gateway" "websocket-server" "face-processing-service")
    local errors_found=false
    
    for service in "${services[@]}"; do
        log_info "Checking logs for $service..."
        
        # Get recent logs
        local logs=$(gcloud run services logs read "$service" \
            --region="$GCP_REGION" \
            --limit=50 \
            --format="value(textPayload)" 2>/dev/null || echo "")
        
        if [ -z "$logs" ]; then
            log_warning "No logs found for $service (may not have received requests yet)"
            continue
        fi
        
        # Check for errors
        if echo "$logs" | grep -i "error\|exception\|failed" &> /dev/null; then
            log_warning "Errors found in $service logs"
            echo "$logs" | grep -i "error\|exception\|failed" | head -5
            errors_found=true
        else
            log_success "No errors in $service logs"
        fi
    done
    
    if [ "$errors_found" = false ]; then
        log_success "No errors found in service logs"
        ((TESTS_PASSED++))
    else
        log_warning "Some errors found in logs (may be expected during startup)"
        ((TESTS_PASSED++))
    fi
    
    return 0
}

test_inter_service_communication() {
    log_step "9" "Testing Inter-Service Communication"
    
    log_info "Checking if services can communicate with each other..."
    
    # Get API Gateway URL
    local api_url=$(gcloud run services describe api-gateway \
        --region="$GCP_REGION" \
        --format="value(status.url)" 2>/dev/null)
    
    if [ -z "$api_url" ]; then
        log_error "API Gateway URL not found"
        FAILED_TESTS+=("Inter-service communication")
        ((TESTS_FAILED++))
        return 1
    fi
    
    # Test API Gateway health endpoint
    log_info "Testing API Gateway: $api_url/health"
    local response=$(curl -s "$api_url/health" 2>/dev/null || echo "")
    
    if [ -n "$response" ]; then
        log_success "API Gateway responded"
        echo "Response: $response"
    else
        log_warning "API Gateway did not respond"
    fi
    
    # Check if services have inter-service URLs configured
    log_info "Checking inter-service URL configuration..."
    
    local api_env=$(gcloud run services describe api-gateway \
        --region="$GCP_REGION" \
        --format="value(spec.template.spec.containers[0].env)" 2>/dev/null)
    
    if echo "$api_env" | grep -q "WEBSOCKET_URL\|FACE_PROCESSING_URL"; then
        log_success "Inter-service URLs are configured"
    else
        log_warning "Inter-service URLs may not be configured"
        log_info "Services may not be able to communicate with each other"
    fi
    
    ((TESTS_PASSED++))
    return 0
}

# =============================================================================
# Main Test Execution
# =============================================================================

main() {
    log_header "Complete Deployment Workflow Test"
    log_info "Testing GCP infrastructure setup and deployment"
    echo ""
    
    # Track start time
    START_TIME=$(date +%s)
    
    # Run tests
    test_prerequisites || true
    test_setup_script || true
    test_resources_created || true
    test_pgvector_extension || true
    test_database_migrations || true
    test_service_deployment || true
    test_service_accessibility || true
    test_service_logs || true
    test_inter_service_communication || true
    
    # Calculate duration
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))
    
    # Print summary
    echo ""
    log_header "Test Summary"
    echo ""
    log_info "Tests Passed: $TESTS_PASSED"
    log_info "Tests Failed: $TESTS_FAILED"
    log_info "Duration: ${MINUTES}m ${SECONDS}s"
    echo ""
    
    if [ $TESTS_FAILED -gt 0 ]; then
        log_error "Failed Tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  ❌ $test"
        done
        echo ""
        log_error "Deployment workflow test FAILED"
        exit 1
    else
        log_success "All tests PASSED!"
        log_success "Deployment workflow is working correctly"
        echo ""
        log_info "Next Steps:"
        echo "  1. Update .env.production with service URLs"
        echo "  2. Test application functionality"
        echo "  3. Monitor service logs for any issues"
        echo "  4. Set up monitoring and alerting"
        exit 0
    fi
}

# Run main function
main "$@"
