#!/bin/bash

# =============================================================================
# GCP Deployment Script
# =============================================================================
# Build and deploy services to Google Cloud Run
# Uses PostgreSQL with pgvector for vector storage
#
# Requirements validated:
# - 3.1, 3.2, 3.7: Build and push container images
# - 4.1-4.10: Deploy services to Cloud Run
# - 5.1, 5.2, 5.7, 5.8: Environment management
# - 10.1-10.5: Deployment validation
# =============================================================================

set -e
set -o pipefail

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

# Error handler
error_handler() {
    local exit_code=$1
    local line_number=$2
    log_error "Script failed at line $line_number with exit code $exit_code"
    exit $exit_code
}

trap 'error_handler $? $LINENO' ERR

# =============================================================================
# Environment Loading (Requirements 5.1, 5.2, 5.7, 5.8)
# Property 25: Environment File Support
# Property 26: Environment Flag Handling
# Property 27: Secret Placeholder Skipping
# Property 28: Required Variable Validation
# =============================================================================
load_env() {
    local env_file="${1:-.env}"
    
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        return 1
    fi
    
    log_info "Loading environment from $env_file"
    
    set -a
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ ! "$key" =~ ^[[:space:]]*# ]] && [[ -n "$key" ]] && [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
            # Skip ${SECRET_*} placeholders (handled by Secret Manager) - Property 27
            if [[ "$value" =~ ^\$\{SECRET_ ]]; then
                log_info "Skipping secret placeholder: $key"
                continue
            fi
            
            # Clean value
            value=$(echo "$value" | sed 's/#.*//' | sed 's/^["'\'']//' | sed 's/["'\'']$//' | xargs)
            
            # Export variable
            export "$key=$value"
        fi
    done < "$env_file"
    set +a
    
    log_success "Environment loaded from $env_file"
}

# =============================================================================
# Validate Environment (Requirement 5.8, Property 28)
# =============================================================================
validate_env() {
    log_info "Validating environment variables..."
    
    local missing=()
    
    # Required variables
    [ -z "$GCP_PROJECT_ID" ] && missing+=("GCP_PROJECT_ID")
    [ -z "$GCP_REGION" ] && missing+=("GCP_REGION")
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing[@]}"; do
            echo "  - $var"
        done
        log_info "Set these variables in your environment file"
        return 1
    fi
    
    log_success "Environment validation passed"
    log_info "Project: $GCP_PROJECT_ID"
    log_info "Region: $GCP_REGION"
    
    # Set project
    gcloud config set project "$GCP_PROJECT_ID" --quiet
    
    return 0
}

# =============================================================================
# Ensure Artifact Registry Exists (Requirement 1.3)
# =============================================================================
ensure_artifact_registry() {
    log_info "Checking Artifact Registry..."
    
    local REPO_NAME="digitwinlive"
    local REPO_LOCATION="$GCP_REGION"
    
    if gcloud artifacts repositories describe "$REPO_NAME" --location="$REPO_LOCATION" &> /dev/null; then
        log_success "Artifact Registry repository exists: $REPO_NAME"
    else
        log_warning "Artifact Registry repository not found"
        log_info "Creating repository: $REPO_NAME"
        
        if gcloud artifacts repositories create "$REPO_NAME" \
            --repository-format=docker \
            --location="$REPO_LOCATION" \
            --description="DigiTwin Live container images" \
            --quiet 2>&1; then
            log_success "Artifact Registry repository created"
        else
            log_error "Failed to create Artifact Registry repository"
            log_info "Run: ./scripts/gcp-setup.sh"
            return 1
        fi
    fi
    
    export ARTIFACT_REGISTRY_URL="$REPO_LOCATION-docker.pkg.dev/$GCP_PROJECT_ID/$REPO_NAME"
    log_info "Registry URL: $ARTIFACT_REGISTRY_URL"
}

# =============================================================================
# Ensure Secret Permissions (Requirement 11.6)
# =============================================================================
ensure_service_account_permissions() {
    log_info "Ensuring permissions for service accounts..."
    
    # Get project number for default compute service account
    local PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format="value(projectNumber)")
    local COMPUTE_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
    local CUSTOM_SA="digitwinlive-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com"
    
    log_info "Configuring permissions for: $COMPUTE_SA"
    
    # Grant Cloud SQL Client role to default compute service account
    log_info "Granting Cloud SQL Client role to default SA..."
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:$COMPUTE_SA" \
        --role="roles/cloudsql.client" \
        --condition=None \
        --quiet &> /dev/null || true
        
    # Grant Cloud SQL Client role to custom service account if it exists
    if gcloud iam service-accounts describe "$CUSTOM_SA" &> /dev/null 2>&1; then
        log_info "Granting Cloud SQL Client role to custom SA..."
        gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
            --member="serviceAccount:$CUSTOM_SA" \
            --role="roles/cloudsql.client" \
            --condition=None \
            --quiet &> /dev/null || true
    fi
    
    # Grant secret access to both service accounts
    local secrets=("jwt-secret" "refresh-secret" "database-password")
    
    for secret in "${secrets[@]}"; do
        if gcloud secrets describe "$secret" &> /dev/null; then
            # Grant to default compute service account (used by Cloud Run by default)
            gcloud secrets add-iam-policy-binding "$secret" \
                --member="serviceAccount:$COMPUTE_SA" \
                --role="roles/secretmanager.secretAccessor" \
                --quiet &> /dev/null || true
            
            # Also grant to custom service account if it exists
            if gcloud iam service-accounts describe "$CUSTOM_SA" &> /dev/null 2>&1; then
                gcloud secrets add-iam-policy-binding "$secret" \
                    --member="serviceAccount:$CUSTOM_SA" \
                    --role="roles/secretmanager.secretAccessor" \
                    --quiet &> /dev/null || true
            fi
        fi
    done
    
    log_success "Service account permissions configured"
}

# =============================================================================
# Get Current Service URLs (Requirement 4.9, Property 23)
# =============================================================================
get_current_service_urls() {
    log_info "Fetching current service URLs for inter-service communication..."
    
    # Try to get existing service URLs
    export API_GATEWAY_URL=$(gcloud run services describe api-gateway \
        --region="$GCP_REGION" \
        --format="value(status.url)" 2>/dev/null || echo "")
    
    export WEBSOCKET_URL=$(gcloud run services describe websocket-server \
        --region="$GCP_REGION" \
        --format="value(status.url)" 2>/dev/null || echo "")
    
    export FACE_PROCESSING_URL=$(gcloud run services describe face-processing-service \
        --region="$GCP_REGION" \
        --format="value(status.url)" 2>/dev/null || echo "")
    
    if [ -n "$API_GATEWAY_URL" ]; then
        log_info "API Gateway URL: $API_GATEWAY_URL"
    fi
    if [ -n "$WEBSOCKET_URL" ]; then
        log_info "WebSocket URL: $WEBSOCKET_URL"
    fi
    if [ -n "$FACE_PROCESSING_URL" ]; then
        log_info "Face Processing URL: $FACE_PROCESSING_URL"
    fi
}

# =============================================================================
# Build and Push Image (Requirements 3.1, 3.2, 3.7)
# Property 10: Image Tagging Consistency
# Property 14: Build Failure Handling
# =============================================================================
build_and_push_image() {
    local service=$1
    local dockerfile=$2
    
    log_header "Building Container Image: $service"
    
    # Generate timestamp tag
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    local IMAGE_NAME="$ARTIFACT_REGISTRY_URL/$service"
    local IMAGE_TAG_TIMESTAMP="$IMAGE_NAME:$TIMESTAMP"
    local IMAGE_TAG_LATEST="$IMAGE_NAME:latest"
    
    log_info "Image: $IMAGE_NAME"
    log_info "Tags: $TIMESTAMP, latest"
    
    # Check source size
    local source_size=$(du -sh . 2>/dev/null | cut -f1)
    log_info "Source directory size: $source_size"
    log_info "Note: .gcloudignore filters will reduce upload size"
    
    # Create cloudbuild.yaml
    local BUILD_CONFIG="/tmp/cloudbuild-$service.yaml"
    
    cat > "$BUILD_CONFIG" << EOF
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - '$dockerfile'
      - '-t'
      - '$IMAGE_TAG_TIMESTAMP'
      - '-t'
      - '$IMAGE_TAG_LATEST'
      - '.'
    timeout: '1200s'

# Push both tags to Artifact Registry
images:
  - '$IMAGE_TAG_TIMESTAMP'
  - '$IMAGE_TAG_LATEST'

options:
  machineType: 'N1_HIGHCPU_8'
  logging: LEGACY
  diskSizeGb: 100

timeout: '2400s'
EOF
    
    log_info "Submitting build to Cloud Build..."
    log_info "This may take 5-15 minutes depending on cache availability..."
    log_info "Uploading source code to Cloud Build..."
    log_info "Build logs will stream below..."
    echo ""
    
    # Submit build (Property 14: exit on failure)
    # Logs stream by default when not using --quiet
    if timeout 2400 gcloud builds submit \
        --config="$BUILD_CONFIG" \
        --project="$GCP_PROJECT_ID" \
        . 2>&1 | tee /tmp/build-$service.log; then
        
        log_success "Build completed successfully"
        log_success "Image pushed: $IMAGE_TAG_TIMESTAMP"
        log_success "Image pushed: $IMAGE_TAG_LATEST"
        
        # Clean up
        rm -f "$BUILD_CONFIG"
        
        # Return image URL
        echo "$IMAGE_TAG_LATEST"
        return 0
    else
        log_error "Build failed for $service"
        log_info "Check build logs: /tmp/build-$service.log"
        log_info "Or view in Cloud Console: https://console.cloud.google.com/cloud-build/builds"
        
        # Clean up
        rm -f "$BUILD_CONFIG"
        
        return 1
    fi
}

# =============================================================================
# Deploy Service to Cloud Run (Requirements 4.1-4.10)
# Property 15-24: Various deployment configurations
# =============================================================================
deploy_service() {
    local service=$1
    local image=$2
    
    log_header "Deploying Service: $service"
    
    log_info "Image: $image"
    log_info "Region: $GCP_REGION"
    
    # Build environment variables array
    local env_vars=()
    
    # Add all non-secret environment variables from current environment
    # These come from the loaded .env file
    local important_vars=(
        "NODE_ENV"
        "GCP_PROJECT_ID"
        "GCP_REGION"
        "DATABASE_NAME"
        "DATABASE_USER"
        "DATABASE_SSL"
        "DATABASE_POOL_MIN"
        "DATABASE_POOL_MAX"
        "CLOUD_SQL_CONNECTION_NAME"
        "GCS_BUCKET_VOICE_MODELS"
        "GCS_BUCKET_FACE_MODELS"
        "GCS_BUCKET_DOCUMENTS"
        "GCS_BUCKET_UPLOADS"
        "ENABLE_CACHING"
        "CACHE_TTL_SHORT"
        "CACHE_TTL_MEDIUM"
        "CACHE_TTL_LONG"
        "LOG_LEVEL"
        "LOG_FORMAT"
        "CORS_ORIGIN"
        "ENABLE_API_DOCS"
        "ENABLE_DEBUG_ENDPOINTS"
    )
    
    # Add inter-service URLs (Property 23)
    if [ -n "$API_GATEWAY_URL" ]; then
        env_vars+=("API_GATEWAY_URL=$API_GATEWAY_URL")
    fi
    if [ -n "$WEBSOCKET_URL" ]; then
        env_vars+=("WEBSOCKET_URL=$WEBSOCKET_URL")
    fi
    if [ -n "$FACE_PROCESSING_URL" ]; then
        env_vars+=("FACE_PROCESSING_URL=$FACE_PROCESSING_URL")
    fi
    
    # Add important variables if they exist
    for var in "${important_vars[@]}"; do
        if [ -n "${!var}" ]; then
            env_vars+=("$var=${!var}")
        fi
    done
    
    # Add Cloud SQL connection variables BEFORE creating env file (Requirement 4.4, Property 18)
    if [ -n "$CLOUD_SQL_CONNECTION_NAME" ]; then
        # Add DATABASE_HOST for Unix socket connection (Property 9)
        # The entrypoint script will construct DATABASE_URL from these components
        env_vars+=("DATABASE_HOST=/cloudsql/$CLOUD_SQL_CONNECTION_NAME")
    fi
    
    # Create env vars file to avoid escaping issues with commas and special characters
    local env_file="/tmp/env-vars-$service.yaml"
    echo "# Environment variables for $service" > "$env_file"
    for env_var in "${env_vars[@]}"; do
        local key="${env_var%%=*}"
        local value="${env_var#*=}"
        echo "$key: '$value'" >> "$env_file"
    done
    
    # Build gcloud command
    local deploy_cmd=(
        gcloud run deploy "$service"
        --image="$image"
        --region="$GCP_REGION"
        --platform=managed
        --allow-unauthenticated
        --memory=512Mi
        --cpu=1
        --min-instances=0
        --max-instances=10
        --timeout=300
        --quiet
        --env-vars-file="$env_file"
    )
    
    # Add secrets from Secret Manager (Requirement 4.3, Property 17)
    deploy_cmd+=(
        --set-secrets="JWT_SECRET=jwt-secret:latest,REFRESH_SECRET=refresh-secret:latest,DATABASE_PASSWORD=database-password:latest"
    )
    
    # Add Cloud SQL connection (Requirement 4.4, Property 18)
    if [ -n "$CLOUD_SQL_CONNECTION_NAME" ]; then
        deploy_cmd+=(--add-cloudsql-instances="$CLOUD_SQL_CONNECTION_NAME")
    fi
    
    log_info "Deploying to Cloud Run..."
    log_info "Configuration:"
    echo "  Memory: 512Mi"
    echo "  CPU: 1"
    echo "  Min instances: 0 (scale-to-zero)"
    echo "  Max instances: 10"
    echo "  Timeout: 300s"
    echo "  Authentication: Public (unauthenticated)"
    
    # Execute deployment (Property 24: exit on failure)
    if "${deploy_cmd[@]}" 2>&1 | tee /tmp/deploy-$service.log; then
        log_success "Deployment completed successfully"
        
        # Get service URL (Requirement 4.8, Property 22)
        local SERVICE_URL=$(gcloud run services describe "$service" \
            --region="$GCP_REGION" \
            --format="value(status.url)" 2>/dev/null)
        
        if [ -n "$SERVICE_URL" ]; then
            log_success "Service URL: $SERVICE_URL"
            
            # Verify service is accessible (Requirement 10.1, Property 34)
            log_info "Verifying service accessibility..."
            sleep 5
            
            if curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health" 2>/dev/null | grep -q "200\|404"; then
                log_success "Service is accessible"
            else
                log_warning "Service may not be fully ready yet"
                log_info "Check logs: gcloud run services logs read $service --region=$GCP_REGION"
            fi
            
            # Return URL
            echo "$SERVICE_URL"
            
            # Cleanup temp files
            rm -f "$env_file"
            
            return 0
        else
            log_error "Could not retrieve service URL"
            rm -f "$env_file"
            return 1
        fi
    else
        log_error "Deployment failed for $service"
        log_info "Check deployment logs: /tmp/deploy-$service.log"
        log_info "Or view in Cloud Console: https://console.cloud.google.com/run"
        rm -f "$env_file"
        return 1
    fi
}

# =============================================================================
# Deploy Command (Requirement 4.4)
# =============================================================================
cmd_deploy() {
    local service_name="${1:-all}"
    
    log_header "GCP Cloud Run Deployment"
    
    # Ensure prerequisites
    ensure_artifact_registry || return 1
    ensure_service_account_permissions
    
    # Get current service URLs for inter-service communication
    get_current_service_urls
    
    # Define services with their Dockerfiles (bash 3.2 compatible)
    # Format: "service_name:dockerfile_path"
    local all_services=(
        "api-gateway:apps/api-gateway/Dockerfile"
        "websocket-server:apps/websocket-server/Dockerfile"
        "face-processing-service:services/face-processing-service/Dockerfile"
    )
    
    # Determine which services to deploy
    local services_to_deploy=()
    
    if [ "$service_name" = "all" ]; then
        services_to_deploy=("${all_services[@]}")
        log_info "Deploying all services"
    else
        # Find the matching service
        local found=false
        for svc in "${all_services[@]}"; do
            local svc_name="${svc%%:*}"
            if [ "$svc_name" = "$service_name" ]; then
                services_to_deploy=("$svc")
                found=true
                break
            fi
        done
        
        if [ "$found" = false ]; then
            log_error "Unknown service: $service_name"
            log_info "Available services: api-gateway, websocket-server, face-processing-service"
            return 1
        fi
        
        log_info "Deploying service: $service_name"
    fi
    
    # Deploy each service
    local deployed_urls=()
    local failed_services=()
    
    for svc_entry in "${services_to_deploy[@]}"; do
        local service="${svc_entry%%:*}"
        local dockerfile="${svc_entry##*:}"
        
        # Check if Dockerfile exists
        if [ ! -f "$dockerfile" ]; then
            log_error "Dockerfile not found: $dockerfile"
            failed_services+=("$service")
            continue
        fi
        
        log_info "Starting build for $service using $dockerfile"
        
        # Build and push image
        # Call function and capture only the last line (image URL) while showing all logs
        build_and_push_image "$service" "$dockerfile" | tee /tmp/build-output-$service.txt
        local build_exit=${PIPESTATUS[0]}
        local image=$(tail -1 /tmp/build-output-$service.txt 2>/dev/null)
        
        if [ $build_exit -ne 0 ] || [ -z "$image" ]; then
            log_error "Failed to build image for $service"
            failed_services+=("$service")
            continue
        fi
        
        # Deploy service
        # Call function and capture only the last line (service URL) while showing all logs
        deploy_service "$service" "$image" | tee /tmp/deploy-output-$service.txt
        local deploy_exit=${PIPESTATUS[0]}
        local service_url=$(tail -1 /tmp/deploy-output-$service.txt 2>/dev/null)
        
        if [ $deploy_exit -ne 0 ] || [ -z "$service_url" ]; then
            log_error "Failed to deploy $service"
            failed_services+=("$service")
            continue
        fi
        
        deployed_urls+=("$service:$service_url")
        
        # Update environment variable for next service
        case $service in
            api-gateway)
                export API_GATEWAY_URL="$service_url"
                ;;
            websocket-server)
                export WEBSOCKET_URL="$service_url"
                ;;
            face-processing-service)
                export FACE_PROCESSING_URL="$service_url"
                ;;
        esac
    done
    
    # Print summary
    echo ""
    log_header "Deployment Summary"
    echo ""
    
    if [ ${#deployed_urls[@]} -gt 0 ]; then
        log_success "Successfully deployed ${#deployed_urls[@]} service(s):"
        for url_info in "${deployed_urls[@]}"; do
            local svc=$(echo "$url_info" | cut -d: -f1)
            local url=$(echo "$url_info" | cut -d: -f2-)
            echo "  ✅ $svc"
            echo "     $url"
        done
    fi
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        echo ""
        log_error "Failed to deploy ${#failed_services[@]} service(s):"
        for svc in "${failed_services[@]}"; do
            echo "  ❌ $svc"
        done
        echo ""
        log_info "Check logs in /tmp/ directory or Cloud Console"
        return 1
    fi
    
    echo ""
    log_info "Update your .env.production file with these URLs:"
    echo ""
    for url_info in "${deployed_urls[@]}"; do
        local svc=$(echo "$url_info" | cut -d: -f1)
        local url=$(echo "$url_info" | cut -d: -f2-)
        
        case $svc in
            api-gateway)
                echo "API_GATEWAY_URL=$url"
                ;;
            websocket-server)
                echo "WEBSOCKET_URL=$url"
                ;;
            face-processing-service)
                echo "FACE_PROCESSING_URL=$url"
                ;;
        esac
    done
    echo ""
    
    log_success "Deployment completed!"
}

# =============================================================================
# Status Command (Requirement 10.4, Property 35)
# =============================================================================
cmd_status() {
    log_header "Cloud Run Services Status"
    
    local services=("api-gateway" "websocket-server" "face-processing-service")
    
    echo ""
    for service in "${services[@]}"; do
        log_info "Service: $service"
        
        if gcloud run services describe "$service" --region="$GCP_REGION" &> /dev/null; then
            local url=$(gcloud run services describe "$service" \
                --region="$GCP_REGION" \
                --format="value(status.url)" 2>/dev/null)
            
            local revision=$(gcloud run services describe "$service" \
                --region="$GCP_REGION" \
                --format="value(status.latestReadyRevisionName)" 2>/dev/null)
            
            local state=$(gcloud run services describe "$service" \
                --region="$GCP_REGION" \
                --format="value(status.conditions[0].status)" 2>/dev/null)
            
            echo "  Status: $state"
            echo "  URL: $url"
            echo "  Revision: $revision"
        else
            echo "  Status: Not deployed"
        fi
        echo ""
    done
}

# =============================================================================
# URLs Command
# =============================================================================
cmd_urls() {
    log_header "Service URLs"
    
    local services=("api-gateway" "websocket-server" "face-processing-service")
    
    echo ""
    log_info "Copy these to your .env.production file:"
    echo ""
    
    for service in "${services[@]}"; do
        if gcloud run services describe "$service" --region="$GCP_REGION" &> /dev/null; then
            local url=$(gcloud run services describe "$service" \
                --region="$GCP_REGION" \
                --format="value(status.url)" 2>/dev/null)
            
            case $service in
                api-gateway)
                    echo "API_GATEWAY_URL=$url"
                    ;;
                websocket-server)
                    echo "WEBSOCKET_URL=$url"
                    ;;
                face-processing-service)
                    echo "FACE_PROCESSING_URL=$url"
                    ;;
            esac
        fi
    done
    echo ""
}

# =============================================================================
# Delete Command
# =============================================================================
cmd_delete() {
    local service_name="${1:-}"
    
    if [ -z "$service_name" ]; then
        log_error "Service name required"
        log_info "Usage: $0 delete <service>"
        log_info "       $0 delete all"
        return 1
    fi
    
    log_header "Delete Cloud Run Service"
    
    local services=()
    
    if [ "$service_name" = "all" ]; then
        services=("api-gateway" "websocket-server" "face-processing-service")
        log_warning "This will delete ALL Cloud Run services"
    else
        services=("$service_name")
        log_warning "This will delete service: $service_name"
    fi
    
    echo ""
    read -p "Are you sure? (yes/NO) " -r
    echo
    
    if [[ ! $REPLY =~ ^yes$ ]]; then
        log_info "Cancelled"
        return 0
    fi
    
    for service in "${services[@]}"; do
        log_info "Deleting $service..."
        
        if gcloud run services delete "$service" \
            --region="$GCP_REGION" \
            --quiet 2>&1; then
            log_success "Deleted: $service"
        else
            log_warning "Could not delete $service (may not exist)"
        fi
    done
    
    log_success "Deletion completed"
}

# =============================================================================
# Usage
# =============================================================================
usage() {
    cat << EOF
Usage: $0 <command> [options]

Commands:
  deploy [service] [--env=ENV]   Deploy service(s) to Cloud Run
                                  service: api-gateway, websocket-server, 
                                          face-processing-service, or 'all'
                                  --env: development or production (default: production)
  
  status                         Show deployment status of all services
  urls                           Display all service URLs
  delete <service>               Delete a deployed service
  delete all                     Delete all deployed services

Examples:
  $0 deploy --env=production              # Deploy all services (production)
  $0 deploy api-gateway --env=development # Deploy one service (development)
  $0 status                               # Check deployment status
  $0 urls                                 # Get service URLs
  $0 delete websocket-server              # Delete one service
  $0 delete all                           # Delete all services

Environment Files:
  --env=development  Uses .env.development
  --env=production   Uses .env.production (default)

Requirements:
  - gcloud CLI installed and authenticated
  - GCP project configured in environment file
  - Artifact Registry repository created
  - Cloud SQL instance created (for database services)
  - Secrets configured in Secret Manager

EOF
    exit 1
}

# =============================================================================
# Main
# =============================================================================
main() {
    if [ $# -eq 0 ]; then
        usage
    fi
    
    local command=$1
    shift
    
    # Parse environment flag
    local env_file=".env.production"
    local service_arg=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env=*)
                local env_name="${1#*=}"
                case $env_name in
                    development)
                        env_file=".env.development"
                        ;;
                    production)
                        env_file=".env.production"
                        ;;
                    *)
                        log_error "Unknown environment: $env_name"
                        log_info "Use: development or production"
                        exit 1
                        ;;
                esac
                shift
                ;;
            *)
                service_arg="$1"
                shift
                ;;
        esac
    done
    
    # Load environment and validate
    if [ "$command" != "status" ] && [ "$command" != "urls" ]; then
        load_env "$env_file" || exit 1
        validate_env || exit 1
    else
        # For status/urls, try to load but don't fail if missing
        if [ -f "$env_file" ]; then
            load_env "$env_file" || true
        elif [ -f ".env" ]; then
            load_env ".env" || true
        fi
        
        # Set defaults if not loaded
        GCP_PROJECT_ID=${GCP_PROJECT_ID:-}
        GCP_REGION=${GCP_REGION:-us-central1}
        
        if [ -z "$GCP_PROJECT_ID" ]; then
            log_error "GCP_PROJECT_ID not set"
            log_info "Set it in .env file or export GCP_PROJECT_ID=your-project-id"
            exit 1
        fi
        
        gcloud config set project "$GCP_PROJECT_ID" --quiet
    fi
    
    # Execute command
    case $command in
        deploy)
            cmd_deploy "$service_arg"
            ;;
        status)
            cmd_status
            ;;
        urls)
            cmd_urls
            ;;
        delete)
            cmd_delete "$service_arg"
            ;;
        --help|-h|help)
            usage
            ;;
        *)
            log_error "Unknown command: $command"
            usage
            ;;
    esac
}

main "$@"
