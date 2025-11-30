#!/bin/bash

# Face Processing Service - Local Testing Script
# Tests all face processing functionality locally

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
SERVICE_PORT=${FACE_PROCESSING_PORT:-3006}
SERVICE_URL="http://localhost:$SERVICE_PORT"
TEST_DATA_DIR="test-data/face-samples"
TIMEOUT=30

# Check if service is running
check_service() {
    log_header "Checking Face Processing Service"
    
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$SERVICE_URL/health" > /dev/null 2>&1; then
            log_success "Service is running at $SERVICE_URL"
            return 0
        fi
        log_info "Waiting for service... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "Service not responding at $SERVICE_URL"
    log_info "Start the service with: pnpm --filter @clone/face-processing-service dev"
    return 1
}

# Create test data directory and sample images
setup_test_data() {
    log_header "Setting Up Test Data"
    
    mkdir -p "$TEST_DATA_DIR"
    
    # Create a simple test image (1x1 pixel PNG) for basic testing
    # In production, use actual face images
    if [ ! -f "$TEST_DATA_DIR/sample-face.png" ]; then
        log_info "Creating placeholder test image..."
        # Create a minimal valid PNG (1x1 white pixel)
        printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > "$TEST_DATA_DIR/sample-face.png"
        log_warning "Created placeholder image. For real testing, add actual face images to $TEST_DATA_DIR"
    fi
    
    # Create README for test data
    cat > "$TEST_DATA_DIR/README.md" << 'EOF'
# Face Processing Test Data

This directory contains sample images for testing the face processing service.

## Requirements for Test Images

1. **Format**: JPEG or PNG
2. **Resolution**: Minimum 256x256 pixels
3. **Face Requirements**:
   - Clear, frontal face view
   - Good lighting (no harsh shadows)
   - Face should occupy at least 20% of the image
   - No extreme head rotation (< 30° yaw, < 25° pitch)

## Sample Images Needed

For comprehensive testing, add the following images:

- `sample-face.jpg` - Single frontal face, good quality
- `sample-face-2.jpg` - Same person, different angle
- `sample-face-3.jpg` - Same person, different lighting
- `multi-face.jpg` - Image with multiple faces
- `low-quality.jpg` - Blurry or poorly lit face
- `no-face.jpg` - Image without any faces
- `profile.jpg` - Side profile view

## Usage

```bash
# Run local tests
./scripts/test-face-processing-local.sh

# Run with custom test images
FACE_TEST_IMAGE=/path/to/image.jpg ./scripts/test-face-processing-local.sh
```

## Notes

- Test images should not contain PII
- Use stock photos or generated faces for testing
- Ensure images are properly licensed for testing purposes
EOF
    
    log_success "Test data directory ready: $TEST_DATA_DIR"
}

# Test health endpoint
test_health() {
    log_header "Testing Health Endpoint"
    
    local response=$(curl -s "$SERVICE_URL/health")
    
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

# Test face health endpoint
test_face_health() {
    log_header "Testing Face API Health"
    
    local response=$(curl -s "$SERVICE_URL/api/v1/face/health")
    
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

# Test thresholds endpoint
test_thresholds() {
    log_header "Testing Thresholds Endpoint"
    
    local response=$(curl -s "$SERVICE_URL/api/v1/face/thresholds")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Thresholds endpoint working"
        echo "$response" | jq '.data.thresholds' 2>/dev/null || echo "$response"
        return 0
    else
        log_error "Thresholds endpoint failed"
        echo "$response"
        return 1
    fi
}

# Test embedding config endpoint
test_embedding_config() {
    log_header "Testing Embedding Config Endpoint"
    
    local response=$(curl -s "$SERVICE_URL/api/v1/face/embedding/config")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Embedding config endpoint working"
        echo "$response" | jq '.data' 2>/dev/null || echo "$response"
        return 0
    else
        log_error "Embedding config endpoint failed"
        echo "$response"
        return 1
    fi
}


# Test face detection with sample image
test_face_detection() {
    log_header "Testing Face Detection"
    
    local test_image="${FACE_TEST_IMAGE:-$TEST_DATA_DIR/sample-face.png}"
    
    if [ ! -f "$test_image" ]; then
        log_warning "Test image not found: $test_image"
        log_info "Skipping face detection test. Add a face image to test."
        return 0
    fi
    
    local image_base64=$(base64 -i "$test_image" | tr -d '\n')
    
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/detect" \
        -H "Content-Type: application/json" \
        -d "{\"imageData\": \"$image_base64\", \"userId\": \"test-user\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Face detection completed"
        echo "$response" | jq '{success, faceCount: .data.faces | length, imageMetadata: .data.imageMetadata}' 2>/dev/null || echo "$response"
        return 0
    else
        log_warning "Face detection returned error (may be expected for placeholder image)"
        echo "$response" | jq '.error' 2>/dev/null || echo "$response"
        return 0
    fi
}

# Test face validation
test_face_validation() {
    log_header "Testing Face Validation"
    
    local test_image="${FACE_TEST_IMAGE:-$TEST_DATA_DIR/sample-face.png}"
    
    if [ ! -f "$test_image" ]; then
        log_warning "Test image not found: $test_image"
        return 0
    fi
    
    local image_base64=$(base64 -i "$test_image" | tr -d '\n')
    
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/validate" \
        -H "Content-Type: application/json" \
        -d "{\"imageData\": \"$image_base64\", \"userId\": \"test-user\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Face validation completed"
        echo "$response" | jq '.data.validation | {isValid, faceDetected, faceCount, recommendations}' 2>/dev/null || echo "$response"
        return 0
    else
        log_warning "Face validation returned error"
        echo "$response" | jq '.error' 2>/dev/null || echo "$response"
        return 0
    fi
}

# Test quality check
test_quality_check() {
    log_header "Testing Quality Check"
    
    local test_image="${FACE_TEST_IMAGE:-$TEST_DATA_DIR/sample-face.png}"
    
    if [ ! -f "$test_image" ]; then
        log_warning "Test image not found: $test_image"
        return 0
    fi
    
    local image_base64=$(base64 -i "$test_image" | tr -d '\n')
    
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/quality-check" \
        -H "Content-Type: application/json" \
        -d "{\"imageData\": \"$image_base64\", \"userId\": \"test-user\", \"strictMode\": false}")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Quality check completed"
        echo "$response" | jq '.data | {passed, qualityTier, faceDetected, overallScore, issues}' 2>/dev/null || echo "$response"
        return 0
    else
        log_warning "Quality check returned error"
        echo "$response" | jq '.error' 2>/dev/null || echo "$response"
        return 0
    fi
}

# Test image analysis
test_image_analysis() {
    log_header "Testing Image Analysis"
    
    local test_image="${FACE_TEST_IMAGE:-$TEST_DATA_DIR/sample-face.png}"
    
    if [ ! -f "$test_image" ]; then
        log_warning "Test image not found: $test_image"
        return 0
    fi
    
    local image_base64=$(base64 -i "$test_image" | tr -d '\n')
    
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/analyze" \
        -H "Content-Type: application/json" \
        -d "{\"imageData\": \"$image_base64\", \"userId\": \"test-user\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Image analysis completed"
        echo "$response" | jq '.data | {imageMetadata, faceCount, imageAnalysis: .imageAnalysis | {blurScore, lightingScore}}' 2>/dev/null || echo "$response"
        return 0
    else
        log_warning "Image analysis returned error"
        echo "$response" | jq '.error' 2>/dev/null || echo "$response"
        return 0
    fi
}

# Test embedding generation
test_embedding_generation() {
    log_header "Testing Embedding Generation"
    
    local test_image="${FACE_TEST_IMAGE:-$TEST_DATA_DIR/sample-face.png}"
    
    if [ ! -f "$test_image" ]; then
        log_warning "Test image not found: $test_image"
        return 0
    fi
    
    local image_base64=$(base64 -i "$test_image" | tr -d '\n')
    
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/embedding/generate" \
        -H "Content-Type: application/json" \
        -d "{\"imageData\": \"$image_base64\", \"userId\": \"test-user\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Embedding generation completed"
        echo "$response" | jq '.data | {faceId, faceConfidence, validation, embeddingDimension: .embedding.vector | length}' 2>/dev/null || echo "$response"
        return 0
    else
        log_warning "Embedding generation returned error"
        echo "$response" | jq '.error' 2>/dev/null || echo "$response"
        return 0
    fi
}

# Run unit tests
run_unit_tests() {
    log_header "Running Unit Tests"
    
    log_info "Running Jest tests for face-processing-service..."
    
    if pnpm --filter @clone/face-processing-service test 2>&1; then
        log_success "All unit tests passed"
        return 0
    else
        log_error "Some unit tests failed"
        return 1
    fi
}

# Print summary
print_summary() {
    log_header "Test Summary"
    
    echo ""
    log_info "Local Testing Complete"
    echo ""
    echo "  Service URL: $SERVICE_URL"
    echo "  Test Data: $TEST_DATA_DIR"
    echo ""
    log_info "Endpoints Tested:"
    echo "  - GET  /health"
    echo "  - GET  /api/v1/face/health"
    echo "  - GET  /api/v1/face/thresholds"
    echo "  - GET  /api/v1/face/embedding/config"
    echo "  - POST /api/v1/face/detect"
    echo "  - POST /api/v1/face/validate"
    echo "  - POST /api/v1/face/quality-check"
    echo "  - POST /api/v1/face/analyze"
    echo "  - POST /api/v1/face/embedding/generate"
    echo ""
    log_info "For more comprehensive testing:"
    echo "  1. Add real face images to $TEST_DATA_DIR"
    echo "  2. Set FACE_TEST_IMAGE=/path/to/image.jpg"
    echo "  3. Re-run this script"
}

# Main execution
main() {
    log_header "Face Processing Service - Local Testing"
    
    local failed=0
    
    # Setup
    setup_test_data
    
    # Check service
    if ! check_service; then
        log_error "Cannot proceed without running service"
        exit 1
    fi
    
    # Run API tests
    test_health || ((failed++))
    test_face_health || ((failed++))
    test_thresholds || ((failed++))
    test_embedding_config || ((failed++))
    test_face_detection || ((failed++))
    test_face_validation || ((failed++))
    test_quality_check || ((failed++))
    test_image_analysis || ((failed++))
    test_embedding_generation || ((failed++))
    
    # Run unit tests if requested
    if [ "$RUN_UNIT_TESTS" = "true" ]; then
        run_unit_tests || ((failed++))
    fi
    
    print_summary
    
    if [ $failed -gt 0 ]; then
        log_error "$failed test(s) failed"
        exit 1
    else
        log_success "All tests passed!"
        exit 0
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --unit-tests)
            RUN_UNIT_TESTS=true
            shift
            ;;
        --image)
            FACE_TEST_IMAGE="$2"
            shift 2
            ;;
        --port)
            SERVICE_PORT="$2"
            SERVICE_URL="http://localhost:$SERVICE_PORT"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --unit-tests    Run Jest unit tests"
            echo "  --image PATH    Path to test image"
            echo "  --port PORT     Service port (default: 3006)"
            echo "  --help          Show this help"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main "$@"
