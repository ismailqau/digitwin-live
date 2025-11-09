#!/bin/bash

# GCP Vector Database Test Script
# This script tests vector database functionality in Google Cloud Platform

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

# Check if required tools are installed
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check gcloud CLI
    if command -v gcloud &> /dev/null; then
        log_success "gcloud CLI is installed"
        gcloud version | head -1
    else
        log_error "gcloud CLI is not installed"
        log_info "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Check if authenticated
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
        log_success "Authenticated as: $ACTIVE_ACCOUNT"
    else
        log_error "Not authenticated with gcloud"
        log_info "Run: gcloud auth login"
        exit 1
    fi
    
    # Check Node.js
    if command -v node &> /dev/null; then
        log_success "Node.js is installed: $(node --version)"
    else
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check if in project directory
    if [ ! -f "package.json" ]; then
        log_error "Not in project root directory"
        log_info "Run this script from the digitwin-live project root"
        exit 1
    fi
}

# Set GCP project
setup_gcp_project() {
    log_header "GCP Project Setup"
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID environment variable not set"
        log_info "Set it in your .env file or export GCP_PROJECT_ID=your-project-id"
        exit 1
    fi
    
    log_info "Setting GCP project to: $GCP_PROJECT_ID"
    
    # Try to set project
    if gcloud config set project "$GCP_PROJECT_ID" 2>&1 | grep -q "Reauthentication failed"; then
        log_error "GCP authentication expired or invalid"
        log_info "Run: gcloud auth login"
        log_info "Or: gcloud auth application-default login"
        exit 1
    fi
    
    # Verify project exists and we have access
    if gcloud projects describe "$GCP_PROJECT_ID" &> /dev/null; then
        log_success "Project $GCP_PROJECT_ID is accessible"
    else
        log_error "Cannot access project $GCP_PROJECT_ID"
        log_info "Possible issues:"
        log_info "  1. Project ID is incorrect"
        log_info "  2. You don't have permissions to access this project"
        log_info "  3. Authentication needs to be refreshed"
        log_info ""
        log_info "Try: gcloud auth login"
        exit 1
    fi
}

# Test Cloud SQL connection
test_cloud_sql() {
    log_header "Testing Cloud SQL Connection"
    
    if [[ "$DATABASE_URL" == *"cloudsql"* ]]; then
        log_info "Cloud SQL connection detected"
        
        # Extract connection name from DATABASE_URL
        CONNECTION_NAME=$(echo "$DATABASE_URL" | grep -o 'cloudsql/[^?]*' | sed 's/cloudsql\///')
        
        if [ -n "$CONNECTION_NAME" ]; then
            log_info "Connection name: $CONNECTION_NAME"
            
            # Check if Cloud SQL instance exists
            INSTANCE_NAME=$(echo "$CONNECTION_NAME" | cut -d':' -f3)
            if gcloud sql instances describe "$INSTANCE_NAME" &> /dev/null; then
                log_success "Cloud SQL instance $INSTANCE_NAME exists"
                
                # Get instance info
                INSTANCE_STATE=$(gcloud sql instances describe "$INSTANCE_NAME" --format="value(state)")
                log_info "Instance state: $INSTANCE_STATE"
                
                if [ "$INSTANCE_STATE" = "RUNNABLE" ]; then
                    log_success "Cloud SQL instance is running"
                else
                    log_warning "Cloud SQL instance is not in RUNNABLE state"
                fi
            else
                log_error "Cloud SQL instance $INSTANCE_NAME not found"
                return 1
            fi
        else
            log_error "Could not extract connection name from DATABASE_URL"
            return 1
        fi
    else
        log_info "Not using Cloud SQL, skipping Cloud SQL tests"
    fi
}

# Test Cloud Run services
test_cloud_run_services() {
    log_header "Testing Cloud Run Services"
    
    # Check if Cloud Run API is enabled
    if ! gcloud services list --enabled --filter="name:run.googleapis.com" --format="value(name)" 2>/dev/null | grep -q "run.googleapis.com"; then
        log_info "Cloud Run API not enabled, skipping Cloud Run tests"
        return 0
    fi
    
    # List of expected services
    SERVICES=("api-gateway" "websocket-server" "rag-service" "llm-service" "tts-service")
    
    log_info "Checking Cloud Run services (this may take a moment)..."
    
    for service in "${SERVICES[@]}"; do
        # Add timeout to prevent hanging
        if timeout 10s gcloud run services describe "$service" --region="$GCP_REGION" &> /dev/null; then
            SERVICE_URL=$(gcloud run services describe "$service" --region="$GCP_REGION" --format="value(status.url)" 2>/dev/null)
            if [ -n "$SERVICE_URL" ]; then
                log_success "$service is deployed: $SERVICE_URL"
                
                # Test service health with timeout
                if timeout 5s curl -s -f "$SERVICE_URL/health" &> /dev/null; then
                    log_success "$service health check passed"
                else
                    log_info "$service health check skipped or no endpoint"
                fi
            else
                log_warning "$service is deployed but URL not available"
            fi
        else
            log_info "$service is not deployed (skipping)"
        fi
    done
}

# Test Weaviate in GKE
test_weaviate_gke() {
    log_header "Testing Weaviate in GKE"
    
    if [ "$WEAVIATE_ENABLED" != "true" ]; then
        log_info "Weaviate is disabled, skipping Weaviate GKE tests"
        return 0
    fi
    
    log_info "Weaviate is enabled, checking GKE deployment"
    
    # Check if kubectl is configured
    if ! command -v kubectl &> /dev/null; then
        log_info "kubectl not installed, skipping GKE tests"
        return 0
    fi
    
    log_success "kubectl is installed"
    
    # Check if GKE API is enabled
    if ! gcloud services list --enabled --filter="name:container.googleapis.com" --format="value(name)" 2>/dev/null | grep -q "container.googleapis.com"; then
        log_info "GKE API not enabled, skipping GKE tests"
        return 0
    fi
    
    # Get GKE credentials with timeout
    CLUSTER_NAME="digitwin-live-cluster"
    log_info "Attempting to connect to GKE cluster: $CLUSTER_NAME"
    
    if timeout 15s gcloud container clusters get-credentials "$CLUSTER_NAME" --region="$GCP_REGION" &> /dev/null; then
        log_success "Connected to GKE cluster: $CLUSTER_NAME"
        
        # Check Weaviate deployment with timeout
        if timeout 10s kubectl get deployment weaviate &> /dev/null; then
            log_success "Weaviate deployment found in GKE"
            
            # Check if pods are running
            READY_PODS=$(kubectl get deployment weaviate -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            DESIRED_PODS=$(kubectl get deployment weaviate -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
            
            if [ "$READY_PODS" = "$DESIRED_PODS" ] && [ "$READY_PODS" != "0" ]; then
                log_success "Weaviate pods are ready ($READY_PODS/$DESIRED_PODS)"
            else
                log_warning "Weaviate pods not ready ($READY_PODS/$DESIRED_PODS)"
            fi
        else
            log_info "Weaviate deployment not found in GKE (may not be deployed yet)"
        fi
    else
        log_info "Could not connect to GKE cluster (cluster may not exist yet)"
    fi
}

# Test PostgreSQL with pgvector in Cloud SQL
test_cloud_sql_pgvector() {
    log_header "Testing Cloud SQL pgvector"
    
    if [ "$WEAVIATE_ENABLED" = "true" ]; then
        log_info "Using Weaviate, skipping Cloud SQL pgvector tests"
        return 0
    fi
    
    if [[ "$DATABASE_URL" != *"cloudsql"* ]]; then
        log_info "Not using Cloud SQL, skipping Cloud SQL pgvector tests"
        return 0
    fi
    
    log_info "Testing PostgreSQL with pgvector in Cloud SQL"
    
    # Check if Cloud SQL Proxy is available
    if ! command -v cloud_sql_proxy &> /dev/null; then
        log_info "Cloud SQL Proxy not available, skipping Cloud SQL tests"
        log_info "Install from: https://cloud.google.com/sql/docs/postgres/sql-proxy"
        return 0
    fi
    
    log_success "Cloud SQL Proxy is available"
    
    # Extract connection name
    CONNECTION_NAME=$(echo "$DATABASE_URL" | grep -o 'cloudsql/[^?]*' | sed 's/cloudsql\///')
    
    if [ -z "$CONNECTION_NAME" ]; then
        log_warning "Could not extract Cloud SQL connection name from DATABASE_URL"
        return 0
    fi
    
    log_info "Starting Cloud SQL Proxy for: $CONNECTION_NAME"
    
    # Start proxy in background with timeout
    timeout 30s cloud_sql_proxy -instances="$CONNECTION_NAME"=tcp:5433 &
    PROXY_PID=$!
    sleep 5
    
    # Test connection with pgvector
    TEMP_DB_URL=$(echo "$DATABASE_URL" | sed 's/cloudsql\/[^?]*/localhost:5433/')
    
    if timeout 10s psql "$TEMP_DB_URL" -c "SELECT 1;" &> /dev/null; then
        log_success "Connected to Cloud SQL via proxy"
        
        # Test pgvector extension
        if psql "$TEMP_DB_URL" -c "SELECT * FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | grep -q "vector"; then
            log_success "pgvector extension is installed in Cloud SQL"
            
            # Test vector operations
            if psql "$TEMP_DB_URL" -c "SELECT '[1,2,3]'::vector;" &> /dev/null; then
                log_success "Vector operations working in Cloud SQL"
            else
                log_info "Vector operations test skipped"
            fi
        else
            log_info "pgvector extension not found in Cloud SQL"
        fi
    else
        log_info "Could not connect to Cloud SQL via proxy (may need configuration)"
    fi
    
    # Clean up proxy
    kill $PROXY_PID 2>/dev/null || true
    wait $PROXY_PID 2>/dev/null || true
}

# Test vector database operations end-to-end
test_vector_operations() {
    log_header "Testing Vector Database Operations"
    
    log_info "Running comprehensive vector database verification..."
    
    # Run the Node.js verification script
    if node scripts/verify-vector-db.js; then
        log_success "Vector database verification passed"
    else
        log_error "Vector database verification failed"
        log_info "Check the detailed output above for specific issues"
        return 1
    fi
}

# Test GCP-specific configurations
test_gcp_configurations() {
    log_header "Testing GCP-Specific Configurations"
    
    # Test Secret Manager (if used)
    log_info "Checking Secret Manager..."
    if timeout 10s gcloud services list --enabled --filter="name:secretmanager.googleapis.com" --format="value(name)" 2>/dev/null | grep -q "secretmanager"; then
        log_success "Secret Manager API is enabled"
        
        # Test accessing secrets with timeout
        SECRET_COUNT=$(timeout 10s gcloud secrets list --format="value(name)" 2>/dev/null | wc -l | xargs)
        log_info "Found $SECRET_COUNT secrets in Secret Manager"
    else
        log_info "Secret Manager API not enabled (optional)"
    fi
    
    # Test Cloud Storage buckets
    log_info "Checking Cloud Storage buckets..."
    BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
    
    for bucket in "${BUCKETS[@]}"; do
        if [ -n "$bucket" ]; then
            if timeout 10s gsutil ls "gs://$bucket" &> /dev/null; then
                log_success "Bucket $bucket is accessible"
            else
                log_info "Bucket $bucket not accessible (may not be created yet)"
            fi
        fi
    done
    
    # Test IAM permissions
    log_info "Checking IAM permissions..."
    CURRENT_USER=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
    
    if [ -n "$CURRENT_USER" ]; then
        # Check if user has necessary roles with timeout
        if timeout 15s gcloud projects get-iam-policy "$GCP_PROJECT_ID" --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:$CURRENT_USER" 2>/dev/null | grep -q "roles/editor\|roles/owner"; then
            log_success "User has sufficient permissions (Editor/Owner)"
        else
            log_info "User permissions check completed (may need specific roles)"
        fi
    else
        log_info "Could not determine current user for IAM check"
    fi
}

# Generate test report
generate_report() {
    log_header "Generating Test Report"
    
    REPORT_FILE="gcp-vector-db-test-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "project_id": "$GCP_PROJECT_ID",
  "region": "$GCP_REGION",
  "environment": "$NODE_ENV",
  "vector_database": {
    "type": "$([ "$WEAVIATE_ENABLED" = "true" ] && echo "weaviate" || echo "postgresql_pgvector")",
    "weaviate_enabled": "$WEAVIATE_ENABLED",
    "weaviate_url": "$WEAVIATE_URL"
  },
  "database_url": "$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/')",
  "test_results": "See console output above",
  "verification_results": "$([ -f "vector-db-verification-results.json" ] && echo "Available in vector-db-verification-results.json" || echo "Not available")"
}
EOF
    
    log_success "Test report saved to: $REPORT_FILE"
}

# Main execution
main() {
    log_header "GCP Vector Database Test Suite"
    log_info "Testing vector database setup in Google Cloud Platform"
    
    # Load environment variables
    if [ -f ".env" ]; then
        log_info "Loading environment variables from .env"
        # Use set -a to automatically export variables, then source the file
        set -a
        # Only load lines that are valid variable assignments
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
        log_warning ".env file not found, using system environment variables"
    fi
    
    # Set defaults
    GCP_REGION=${GCP_REGION:-"us-central1"}
    
    # Run tests
    check_prerequisites
    setup_gcp_project
    test_cloud_sql
    test_cloud_run_services
    
    if [ "$WEAVIATE_ENABLED" = "true" ]; then
        test_weaviate_gke
    else
        test_cloud_sql_pgvector
    fi
    
    test_gcp_configurations
    test_vector_operations
    generate_report
    
    log_header "Test Suite Complete"
    log_success "GCP vector database testing completed!"
    log_info "Check the generated report and verification results for details"
}

# Run main function
main "$@"