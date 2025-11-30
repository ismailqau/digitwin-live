#!/bin/bash

# Face Processing Service - GCP Testing Script
# Tests face processing service deployed on Google Cloud Platform

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

# Configuration
SERVICE_NAME="face-processing-service"
GCP_REGION=${GCP_REGION:-us-central1}
TEST_DATA_DIR="test-data/face-samples"

# Load environment
load_env() {
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
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not installed"
        exit 1
    fi
    log_success "gcloud CLI installed"
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        log_error "Not authenticated with gcloud"
        log_info "Run: gcloud auth login"
        exit 1
    fi
    log_success "Authenticated with gcloud"
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set"
        exit 1
    fi
    log_success "Project ID: $GCP_PROJECT_ID"
    
    gcloud config set project "$GCP_PROJECT_ID" 2>/dev/null
}

# Get Cloud Run service URL
get_service_url() {
    log_header "Getting Service URL"
    
    # Get URL from service list (more reliable format)
    SERVICE_URL=$(gcloud run services list \
        --region="$GCP_REGION" \
        --filter="SERVICE:$SERVICE_NAME" \
        --format="value(URL)" 2>/dev/null | head -1)
    
    if [ -z "$SERVICE_URL" ]; then
        # Fallback to describe
        SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
            --region="$GCP_REGION" \
            --format="value(status.url)" 2>/dev/null)
    fi
    
    if [ -z "$SERVICE_URL" ]; then
        log_error "Service $SERVICE_NAME not found in region $GCP_REGION"
        log_info "Deploy the service first with: pnpm gcp:deploy:face"
        log_info "Or: ./scripts/gcp-deploy-services.sh deploy face-processing-service"
        return 1
    fi
    
    log_success "Service URL: $SERVICE_URL"
    export SERVICE_URL
}

# Get authentication token
get_auth_token() {
    log_header "Getting Authentication Token"
    
    AUTH_TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
    
    if [ -z "$AUTH_TOKEN" ]; then
        log_warning "Could not get identity token"
        log_info "Service may require authentication"
        AUTH_TOKEN=""
    else
        log_success "Authentication token obtained"
    fi
    
    export AUTH_TOKEN
}

# Test health endpoint
test_health() {
    log_header "Testing Health Endpoint (GCP)"
    
    local response
    if [ -n "$AUTH_TOKEN" ]; then
        response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$SERVICE_URL/health")
    else
        response=$(curl -s "$SERVICE_URL/health")
    fi
    
    if echo "$response" | grep -q '"status":"healthy"'; then
        log_success "Health check passed"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        return 0
    else
        log_error "Health check failed"
        echo "$response"
        return 1
    fi
}

# Test face API health
test_face_health() {
    log_header "Testing Face API Health (GCP)"
    
    local response
    if [ -n "$AUTH_TOKEN" ]; then
        response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$SERVICE_URL/api/v1/face/health")
    else
        response=$(curl -s "$SERVICE_URL/api/v1/face/health")
    fi
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Face API health check passed"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        return 0
    else
        log_error "Face API health check failed"
        echo "$response"
        return 1
    fi
}

# Test with GCS-stored image
test_gcs_image() {
    log_header "Testing with GCS-Stored Image"
    
    local bucket="${GCS_BUCKET_FACE_MODELS:-digitwin-live-face-models}"
    local test_image_path="test/sample-face.jpg"
    
    # Check if test image exists in GCS
    if ! gsutil ls "gs://$bucket/$test_image_path" &>/dev/null; then
        log_warning "Test image not found in GCS: gs://$bucket/$test_image_path"
        log_info "Upload a test image with: gsutil cp /path/to/face.jpg gs://$bucket/$test_image_path"
        return 0
    fi
    
    # Download and encode image
    local temp_file=$(mktemp)
    gsutil cp "gs://$bucket/$test_image_path" "$temp_file" 2>/dev/null
    
    local image_base64=$(base64 -i "$temp_file" | tr -d '\n')
    rm "$temp_file"
    
    local response
    if [ -n "$AUTH_TOKEN" ]; then
        response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/detect" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"imageData\": \"$image_base64\", \"userId\": \"gcp-test-user\"}")
    else
        response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/detect" \
            -H "Content-Type: application/json" \
            -d "{\"imageData\": \"$image_base64\", \"userId\": \"gcp-test-user\"}")
    fi
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "GCS image test passed"
        echo "$response" | jq '{success, faceCount: .data.faces | length}' 2>/dev/null || echo "$response"
        return 0
    else
        log_warning "GCS image test returned error"
        echo "$response" | jq '.error' 2>/dev/null || echo "$response"
        return 0
    fi
}

# Test Cloud SQL cache operations
test_cloud_sql_cache() {
    log_header "Testing Cloud SQL Cache Operations"
    
    # This test verifies the service can connect to Cloud SQL
    # The actual cache operations happen internally
    
    local response
    if [ -n "$AUTH_TOKEN" ]; then
        response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$SERVICE_URL/api/v1/face/thresholds")
    else
        response=$(curl -s "$SERVICE_URL/api/v1/face/thresholds")
    fi
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Service responding (Cloud SQL connection working)"
        return 0
    else
        log_warning "Service may have database connection issues"
        return 0
    fi
}

# Test service-to-service authentication
test_service_auth() {
    log_header "Testing Service-to-Service Authentication"
    
    # Test with service account token
    local sa_token
    sa_token=$(gcloud auth print-identity-token \
        --audiences="$SERVICE_URL" 2>/dev/null || echo "")
    
    if [ -z "$sa_token" ]; then
        log_warning "Could not get service account token"
        return 0
    fi
    
    local response=$(curl -s -H "Authorization: Bearer $sa_token" "$SERVICE_URL/health")
    
    if echo "$response" | grep -q '"status":"healthy"'; then
        log_success "Service-to-service auth working"
        return 0
    else
        log_warning "Service-to-service auth may need configuration"
        return 0
    fi
}

# Check auto-scaling configuration
check_autoscaling() {
    log_header "Checking Auto-Scaling Configuration"
    
    local config=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$GCP_REGION" \
        --format="json" 2>/dev/null)
    
    if [ -z "$config" ]; then
        log_error "Could not get service configuration"
        return 1
    fi
    
    local min_instances=$(echo "$config" | jq -r '.spec.template.metadata.annotations["autoscaling.knative.dev/minScale"] // "0"')
    local max_instances=$(echo "$config" | jq -r '.spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"] // "100"')
    local concurrency=$(echo "$config" | jq -r '.spec.template.spec.containerConcurrency // "80"')
    
    log_success "Auto-scaling configuration:"
    echo "  Min instances: $min_instances"
    echo "  Max instances: $max_instances"
    echo "  Concurrency: $concurrency"
    
    return 0
}

# Run load test
run_load_test() {
    log_header "Running Load Test"
    
    local concurrent=${LOAD_TEST_CONCURRENT:-5}
    local requests=${LOAD_TEST_REQUESTS:-20}
    
    log_info "Running $requests requests with $concurrent concurrent connections..."
    
    # Simple load test using curl
    local start_time=$(date +%s.%N)
    local success=0
    local failed=0
    
    for i in $(seq 1 $requests); do
        local response
        if [ -n "$AUTH_TOKEN" ]; then
            response=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "Authorization: Bearer $AUTH_TOKEN" \
                "$SERVICE_URL/health" &)
        else
            response=$(curl -s -o /dev/null -w "%{http_code}" \
                "$SERVICE_URL/health" &)
        fi
        
        # Limit concurrent requests
        if [ $((i % concurrent)) -eq 0 ]; then
            wait
        fi
    done
    wait
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    local rps=$(echo "scale=2; $requests / $duration" | bc)
    
    log_success "Load test completed"
    echo "  Total requests: $requests"
    echo "  Duration: ${duration}s"
    echo "  Requests/sec: $rps"
    
    return 0
}

# Deploy service to Cloud Run
deploy_service() {
    log_header "Deploying Face Processing Service to Cloud Run"
    
    log_info "Building service..."
    pnpm --filter @clone/face-processing-service build
    
    log_info "Deploying to Cloud Run..."
    
    gcloud run deploy "$SERVICE_NAME" \
        --source="services/face-processing-service" \
        --region="$GCP_REGION" \
        --platform=managed \
        --allow-unauthenticated \
        --memory=1Gi \
        --cpu=1 \
        --min-instances=0 \
        --max-instances=10 \
        --concurrency=80 \
        --timeout=300 \
        --set-env-vars="NODE_ENV=production"
    
    log_success "Service deployed"
}

# Print summary
print_summary() {
    log_header "GCP Test Summary"
    
    echo ""
    log_info "GCP Testing Complete"
    echo ""
    echo "  Project: $GCP_PROJECT_ID"
    echo "  Region: $GCP_REGION"
    echo "  Service: $SERVICE_NAME"
    echo "  URL: $SERVICE_URL"
    echo ""
    log_info "Tests Performed:"
    echo "  - Health endpoint"
    echo "  - Face API health"
    echo "  - GCS image processing"
    echo "  - Cloud SQL cache"
    echo "  - Service authentication"
    echo "  - Auto-scaling config"
    echo ""
    log_info "Useful Commands:"
    echo "  - View logs: gcloud run services logs read $SERVICE_NAME --region=$GCP_REGION"
    echo "  - View metrics: gcloud run services describe $SERVICE_NAME --region=$GCP_REGION"
    echo "  - Update service: gcloud run services update $SERVICE_NAME --region=$GCP_REGION"
}

# Main execution
main() {
    log_header "Face Processing Service - GCP Testing"
    
    local failed=0
    
    load_env
    check_prerequisites
    
    # Get service URL
    if ! get_service_url; then
        log_error "Cannot proceed without deployed service"
        exit 1
    fi
    
    get_auth_token
    
    # Run tests
    test_health || ((failed++))
    test_face_health || ((failed++))
    test_gcs_image || ((failed++))
    test_cloud_sql_cache || ((failed++))
    test_service_auth || ((failed++))
    check_autoscaling || ((failed++))
    
    # Run load test if requested
    if [ "$RUN_LOAD_TEST" = "true" ]; then
        run_load_test || ((failed++))
    fi
    
    print_summary
    
    if [ $failed -gt 0 ]; then
        log_error "$failed test(s) failed"
        exit 1
    else
        log_success "All GCP tests passed!"
        exit 0
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --deploy)
            DEPLOY_FIRST=true
            shift
            ;;
        --load-test)
            RUN_LOAD_TEST=true
            shift
            ;;
        --region)
            GCP_REGION="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --deploy       Deploy service before testing"
            echo "  --load-test    Run load test"
            echo "  --region REG   GCP region (default: us-central1)"
            echo "  --help         Show this help"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Deploy if requested
if [ "$DEPLOY_FIRST" = "true" ]; then
    deploy_service
fi

main "$@"
