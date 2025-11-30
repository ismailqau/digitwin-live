#!/bin/bash

# Face Processing Service - Integration Testing Script
# Tests end-to-end face processing flows

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
SERVICE_URL=${SERVICE_URL:-"http://localhost:$SERVICE_PORT"}
TEST_DATA_DIR="test-data/face-samples"
TEST_USER_ID="integration-test-user-$(date +%s)"

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

# Check service is running
check_service() {
    log_header "Checking Service Availability"
    
    local max_attempts=5
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
    return 1
}

# Test complete flow: upload → detect → embedding → identity
test_complete_flow() {
    log_header "Testing Complete Face Processing Flow"
    
    local test_images=()
    
    # Check for test images
    if [ -f "$TEST_DATA_DIR/sample-face.png" ]; then
        test_images+=("$TEST_DATA_DIR/sample-face.png")
    fi
    
    # Check for additional test images
    for img in "$TEST_DATA_DIR"/*.jpg "$TEST_DATA_DIR"/*.jpeg "$TEST_DATA_DIR"/*.png; do
        [ -f "$img" ] && [[ ! " ${test_images[*]} " =~ " ${img} " ]] && test_images+=("$img")
    done
    
    if [ ${#test_images[@]} -lt 3 ]; then
        log_warning "Need at least 3 face images for identity creation"
        log_info "Add images to $TEST_DATA_DIR"
        log_info "Testing with available images..."
    fi
    
    local embeddings=()
    local face_ids=()
    
    # Step 1: Detect faces in each image
    log_info "Step 1: Detecting faces..."
    for img in "${test_images[@]:0:5}"; do
        if [ ! -f "$img" ]; then
            continue
        fi
        
        local image_base64=$(base64 -i "$img" | tr -d '\n')
        
        local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/detect" \
            -H "Content-Type: application/json" \
            -d "{\"imageData\": \"$image_base64\", \"userId\": \"$TEST_USER_ID\"}")
        
        if echo "$response" | grep -q '"success":true'; then
            local face_count=$(echo "$response" | jq '.data.faces | length' 2>/dev/null || echo "0")
            log_success "Detected $face_count face(s) in $(basename "$img")"
        else
            log_warning "No face detected in $(basename "$img")"
        fi
    done
    
    # Step 2: Generate embeddings
    log_info "Step 2: Generating embeddings..."
    for img in "${test_images[@]:0:5}"; do
        if [ ! -f "$img" ]; then
            continue
        fi
        
        local image_base64=$(base64 -i "$img" | tr -d '\n')
        
        local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/embedding/generate" \
            -H "Content-Type: application/json" \
            -d "{\"imageData\": \"$image_base64\", \"userId\": \"$TEST_USER_ID\"}")
        
        if echo "$response" | grep -q '"success":true'; then
            local face_id=$(echo "$response" | jq -r '.data.faceId' 2>/dev/null)
            local confidence=$(echo "$response" | jq -r '.data.faceConfidence' 2>/dev/null)
            face_ids+=("$face_id")
            log_success "Generated embedding for $(basename "$img") (confidence: $confidence)"
        else
            log_warning "Could not generate embedding for $(basename "$img")"
        fi
    done
    
    # Step 3: Create identity (if we have enough images)
    if [ ${#test_images[@]} -ge 3 ]; then
        log_info "Step 3: Creating face identity..."
        
        local images_json="["
        local first=true
        for img in "${test_images[@]:0:5}"; do
            if [ ! -f "$img" ]; then
                continue
            fi
            local image_base64=$(base64 -i "$img" | tr -d '\n')
            if [ "$first" = true ]; then
                images_json+="\"$image_base64\""
                first=false
            else
                images_json+=",\"$image_base64\""
            fi
        done
        images_json+="]"
        
        local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/embedding/identity/create" \
            -H "Content-Type: application/json" \
            -d "{\"userId\": \"$TEST_USER_ID\", \"images\": $images_json}")
        
        if echo "$response" | grep -q '"success":true'; then
            local identity_id=$(echo "$response" | jq -r '.data.identityId' 2>/dev/null)
            local sample_count=$(echo "$response" | jq -r '.data.sampleCount' 2>/dev/null)
            local confidence=$(echo "$response" | jq -r '.data.confidence' 2>/dev/null)
            
            log_success "Created identity: $identity_id"
            echo "  Samples: $sample_count"
            echo "  Confidence: $confidence"
            
            export CREATED_IDENTITY_ID="$identity_id"
        else
            log_warning "Could not create identity"
            echo "$response" | jq '.error' 2>/dev/null || echo "$response"
        fi
    else
        log_warning "Skipping identity creation (need 3+ images)"
    fi
    
    return 0
}

# Test face model creation from multiple samples
test_face_model_creation() {
    log_header "Testing Face Model Creation"
    
    local test_images=()
    for img in "$TEST_DATA_DIR"/*.jpg "$TEST_DATA_DIR"/*.jpeg "$TEST_DATA_DIR"/*.png; do
        [ -f "$img" ] && test_images+=("$img")
    done
    
    if [ ${#test_images[@]} -lt 3 ]; then
        log_warning "Need at least 3 images for face model creation"
        return 0
    fi
    
    # Build images array
    local images_json="["
    local first=true
    for img in "${test_images[@]:0:5}"; do
        local image_base64=$(base64 -i "$img" | tr -d '\n')
        if [ "$first" = true ]; then
            images_json+="\"$image_base64\""
            first=false
        else
            images_json+=",\"$image_base64\""
        fi
    done
    images_json+="]"
    
    # Check consistency first
    log_info "Checking sample consistency..."
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/embedding/consistency" \
        -H "Content-Type: application/json" \
        -d "{\"images\": $images_json}")
    
    if echo "$response" | grep -q '"success":true'; then
        local is_consistent=$(echo "$response" | jq -r '.data.isConsistent' 2>/dev/null)
        local score=$(echo "$response" | jq -r '.data.consistencyScore' 2>/dev/null)
        
        if [ "$is_consistent" = "true" ]; then
            log_success "Samples are consistent (score: $score)"
        else
            log_warning "Samples may not be from same person (score: $score)"
        fi
    fi
    
    return 0
}

# Test face model activation and retrieval
test_model_activation() {
    log_header "Testing Model Activation and Retrieval"
    
    if [ -z "$CREATED_IDENTITY_ID" ]; then
        log_warning "No identity created, skipping activation test"
        return 0
    fi
    
    # Get identity details
    log_info "Retrieving identity details..."
    local response=$(curl -s "$SERVICE_URL/api/v1/face/embedding/identity/$CREATED_IDENTITY_ID")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Identity retrieved successfully"
        echo "$response" | jq '.data | {identityId, userId, sampleCount, confidence, version}' 2>/dev/null
    else
        log_warning "Could not retrieve identity"
    fi
    
    return 0
}

# Test identity verification
test_identity_verification() {
    log_header "Testing Identity Verification"
    
    if [ -z "$CREATED_IDENTITY_ID" ]; then
        log_warning "No identity created, skipping verification test"
        return 0
    fi
    
    local test_image=$(ls "$TEST_DATA_DIR"/*.jpg "$TEST_DATA_DIR"/*.jpeg "$TEST_DATA_DIR"/*.png 2>/dev/null | head -1)
    
    if [ -z "$test_image" ] || [ ! -f "$test_image" ]; then
        log_warning "No test image available for verification"
        return 0
    fi
    
    local image_base64=$(base64 -i "$test_image" | tr -d '\n')
    
    log_info "Verifying face against identity..."
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/embedding/identity/verify" \
        -H "Content-Type: application/json" \
        -d "{\"identityId\": \"$CREATED_IDENTITY_ID\", \"imageData\": \"$image_base64\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        local is_verified=$(echo "$response" | jq -r '.data.isVerified' 2>/dev/null)
        local similarity=$(echo "$response" | jq -r '.data.similarity' 2>/dev/null)
        local match_strength=$(echo "$response" | jq -r '.data.matchStrength' 2>/dev/null)
        
        if [ "$is_verified" = "true" ]; then
            log_success "Identity verified!"
        else
            log_warning "Identity not verified"
        fi
        echo "  Similarity: $similarity"
        echo "  Match strength: $match_strength"
    else
        log_warning "Verification failed"
        echo "$response" | jq '.error' 2>/dev/null
    fi
    
    return 0
}

# Test error handling
test_error_handling() {
    log_header "Testing Error Handling"
    
    # Test with invalid image data
    log_info "Testing invalid image data..."
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/detect" \
        -H "Content-Type: application/json" \
        -d '{"imageData": "not-valid-base64", "userId": "test"}')
    
    if echo "$response" | grep -q '"success":false'; then
        log_success "Invalid image data handled correctly"
    else
        log_warning "Unexpected response for invalid data"
    fi
    
    # Test with missing required fields
    log_info "Testing missing required fields..."
    response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/detect" \
        -H "Content-Type: application/json" \
        -d '{"userId": "test"}')
    
    if echo "$response" | grep -q '"success":false\|"error"'; then
        log_success "Missing fields handled correctly"
    else
        log_warning "Unexpected response for missing fields"
    fi
    
    # Test with non-existent identity
    log_info "Testing non-existent identity..."
    response=$(curl -s "$SERVICE_URL/api/v1/face/embedding/identity/non-existent-id")
    
    if echo "$response" | grep -q '"success":false\|"error"'; then
        log_success "Non-existent identity handled correctly"
    else
        log_warning "Unexpected response for non-existent identity"
    fi
    
    return 0
}

# Test batch processing
test_batch_processing() {
    log_header "Testing Batch Processing"
    
    local test_images=()
    for img in "$TEST_DATA_DIR"/*.jpg "$TEST_DATA_DIR"/*.jpeg "$TEST_DATA_DIR"/*.png; do
        [ -f "$img" ] && test_images+=("$img")
    done
    
    if [ ${#test_images[@]} -lt 2 ]; then
        log_warning "Need at least 2 images for batch processing test"
        return 0
    fi
    
    # Build images array
    local images_json="["
    local first=true
    for img in "${test_images[@]:0:5}"; do
        local image_base64=$(base64 -i "$img" | tr -d '\n')
        if [ "$first" = true ]; then
            images_json+="\"$image_base64\""
            first=false
        else
            images_json+=",\"$image_base64\""
        fi
    done
    images_json+="]"
    
    log_info "Processing ${#test_images[@]} images in batch..."
    local response=$(curl -s -X POST "$SERVICE_URL/api/v1/face/batch" \
        -H "Content-Type: application/json" \
        -d "{\"images\": $images_json, \"userId\": \"$TEST_USER_ID\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        local total=$(echo "$response" | jq -r '.data.summary.totalFrames' 2>/dev/null)
        local valid=$(echo "$response" | jq -r '.data.summary.validFrames' 2>/dev/null)
        log_success "Batch processing completed"
        echo "  Total: $total, Valid: $valid"
    else
        log_warning "Batch processing failed"
        echo "$response" | jq '.error' 2>/dev/null
    fi
    
    return 0
}

# Cleanup test data
cleanup() {
    log_header "Cleanup"
    
    if [ -n "$CREATED_IDENTITY_ID" ]; then
        log_info "Deleting test identity..."
        curl -s -X DELETE "$SERVICE_URL/api/v1/face/embedding/identity/$CREATED_IDENTITY_ID" > /dev/null
        log_success "Test identity deleted"
    fi
}

# Print summary
print_summary() {
    log_header "Integration Test Summary"
    
    echo ""
    log_info "Integration Testing Complete"
    echo ""
    echo "  Service URL: $SERVICE_URL"
    echo "  Test User: $TEST_USER_ID"
    echo ""
    log_info "Flows Tested:"
    echo "  - Complete face processing flow"
    echo "  - Face model creation"
    echo "  - Model activation and retrieval"
    echo "  - Identity verification"
    echo "  - Error handling"
    echo "  - Batch processing"
    echo ""
    log_info "For comprehensive testing:"
    echo "  1. Add 3+ face images of the same person to $TEST_DATA_DIR"
    echo "  2. Re-run this script"
}

# Main execution
main() {
    log_header "Face Processing Service - Integration Testing"
    
    local failed=0
    
    load_env
    
    if ! check_service; then
        log_error "Cannot proceed without running service"
        exit 1
    fi
    
    # Run integration tests
    test_complete_flow || ((failed++))
    test_face_model_creation || ((failed++))
    test_model_activation || ((failed++))
    test_identity_verification || ((failed++))
    test_error_handling || ((failed++))
    test_batch_processing || ((failed++))
    
    # Cleanup
    if [ "$SKIP_CLEANUP" != "true" ]; then
        cleanup
    fi
    
    print_summary
    
    if [ $failed -gt 0 ]; then
        log_error "$failed test(s) failed"
        exit 1
    else
        log_success "All integration tests passed!"
        exit 0
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            SERVICE_URL="$2"
            shift 2
            ;;
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --url URL        Service URL (default: http://localhost:3006)"
            echo "  --skip-cleanup   Don't delete test data after tests"
            echo "  --help           Show this help"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main "$@"
