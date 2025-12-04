#!/bin/bash

# GCP Cloud Run Deployment Script
# Builds and deploys services to Google Cloud Run
# Usage: ./scripts/gcp-deploy-services.sh <command> [service] [--env=production|development]

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

# Service definitions (compatible with bash 3.x on macOS)
SERVICES="api-gateway websocket-server face-processing-service"

# Default Cloud Run service URLs (updated after deployment)
API_GATEWAY_URL="https://api-gateway-yrzc7r3fcq-uc.a.run.app"
WEBSOCKET_URL="https://websocket-server-yrzc7r3fcq-uc.a.run.app"
FACE_PROCESSING_URL="https://face-processing-service-yrzc7r3fcq-uc.a.run.app"

get_dockerfile() {
    case $1 in
        api-gateway) echo "apps/api-gateway/Dockerfile" ;;
        websocket-server) echo "apps/websocket-server/Dockerfile" ;;
        face-processing-service) echo "services/face-processing-service/Dockerfile" ;;
        *) echo "" ;;
    esac
}

get_port() {
    echo "8080"  # All services use port 8080
}

is_valid_service() {
    case $1 in
        api-gateway|websocket-server|face-processing-service) return 0 ;;
        *) return 1 ;;
    esac
}

# Load environment from specified file
load_env() {
    local env_file="${1:-.env}"
    
    if [ -f "$env_file" ]; then
        log_info "Loading environment from: $env_file"
        set -a
        while IFS='=' read -r key value; do
            if [[ ! "$key" =~ ^[[:space:]]*# ]] && [[ -n "$key" ]] && [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
                # Skip lines with ${...} variable references (secrets)
                if [[ ! "$value" =~ \$\{ ]]; then
                    value=$(echo "$value" | sed 's/#.*//' | sed 's/^["'\'']//' | sed 's/["'\'']$//' | xargs)
                    export "$key=$value"
                fi
            fi
        done < "$env_file"
        set +a
        log_success "Environment loaded from $env_file"
    else
        log_warning "Environment file not found: $env_file"
    fi
    
    # Set defaults
    GCP_REGION=${GCP_REGION:-us-central1}
    GCP_PROJECT_ID=${GCP_PROJECT_ID:-digitwinlive}
}

# Determine which env file to use
get_env_file() {
    local env_type="$1"
    
    case "$env_type" in
        production|prod)
            echo ".env.production"
            ;;
        development|dev)
            echo ".env.development"
            ;;
        *)
            # Default: use .env if exists, otherwise .env.development
            if [ -f ".env" ]; then
                echo ".env"
            else
                echo ".env.development"
            fi
            ;;
    esac
}


# Validate required environment variables
validate_env() {
    log_info "Validating environment configuration..."
    
    local missing=()
    
    [ -z "$GCP_PROJECT_ID" ] && missing+=("GCP_PROJECT_ID")
    [ -z "$GCP_REGION" ] && missing+=("GCP_REGION")
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    log_success "Environment configuration valid"
    log_info "Project: $GCP_PROJECT_ID"
    log_info "Region: $GCP_REGION"
}

# Ensure Artifact Registry repository exists
ensure_artifact_registry() {
    log_info "Checking Artifact Registry repository..."
    
    local repo_name="digitwinlive"
    
    if gcloud artifacts repositories describe "$repo_name" \
        --location="$GCP_REGION" \
        --project="$GCP_PROJECT_ID" &>/dev/null; then
        log_success "Artifact Registry repository exists"
    else
        log_info "Creating Artifact Registry repository: $repo_name"
        
        if gcloud artifacts repositories create "$repo_name" \
            --repository-format=docker \
            --location="$GCP_REGION" \
            --description="DigiTwin Live container images" \
            --project="$GCP_PROJECT_ID" 2>&1; then
            log_success "Artifact Registry repository created"
        else
            log_error "Failed to create Artifact Registry repository"
            exit 1
        fi
    fi
}

# Ensure secrets have proper IAM permissions for Cloud Run
ensure_secret_permissions() {
    log_info "Checking secret permissions..."
    
    # Get project number for service account
    local project_number
    project_number=$(gcloud projects describe "$GCP_PROJECT_ID" --format="value(projectNumber)" 2>/dev/null)
    
    if [ -z "$project_number" ]; then
        log_warning "Could not get project number, skipping secret permissions"
        return 0
    fi
    
    local sa_email="${project_number}-compute@developer.gserviceaccount.com"
    
    # Grant access to secrets if they exist
    local secrets="jwt-secret refresh-secret database-password"
    for secret in $secrets; do
        if gcloud secrets describe "$secret" --project="$GCP_PROJECT_ID" &>/dev/null; then
            if gcloud secrets add-iam-policy-binding "$secret" \
                --member="serviceAccount:$sa_email" \
                --role="roles/secretmanager.secretAccessor" \
                --project="$GCP_PROJECT_ID" &>/dev/null; then
                log_success "Secret access granted: $secret"
            fi
        fi
    done
}

# Show usage
usage() {
    cat << EOF
Usage: $0 <command> [service] [options]

Commands:
  deploy [service]    Deploy service(s) to Cloud Run
  status              Show status of deployed services
  delete [service]    Delete service(s) from Cloud Run
  urls                Show all deployed service URLs

Options:
  --env=ENV           Environment to use (production, development)
                      Default: uses .env or .env.development

Services:
  api-gateway
  websocket-server
  face-processing-service

Examples:
  $0 deploy                              # Deploy all services
  $0 deploy api-gateway                  # Deploy only api-gateway
  $0 deploy --env=production             # Deploy all with production env
  $0 deploy api-gateway --env=production # Deploy api-gateway with production env
  $0 status                              # Show all service status
  $0 urls                                # Show all service URLs
  $0 delete face-processing-service      # Delete specific service

Environment Files:
  .env.development    Local development settings (localhost URLs)
  .env.production     Production settings (Cloud Run URLs)
  .env                Override file (takes precedence)

EOF
    exit 1
}


# Build and push Docker image
# Returns the image URL on success, exits on failure
build_and_push_image() {
    local service=$1
    local dockerfile=$(get_dockerfile "$service")
    
    if [ -z "$dockerfile" ]; then
        log_error "Unknown service: $service"
        return 1
    fi
    
    if [ ! -f "$dockerfile" ]; then
        log_error "Dockerfile not found: $dockerfile"
        return 1
    fi
    
    local image_url="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/digitwinlive/${service}"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    
    log_info "Building image for $service..." >&2
    log_info "Dockerfile: $dockerfile" >&2
    log_info "Image: $image_url:$timestamp" >&2
    
    # Create a temporary cloudbuild.yaml for this service
    local cloudbuild_file="/tmp/cloudbuild-${service}.yaml"
    cat > "$cloudbuild_file" << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '${image_url}:${timestamp}'
      - '-t'
      - '${image_url}:latest'
      - '-f'
      - '${dockerfile}'
      - '.'
images:
  - '${image_url}:${timestamp}'
  - '${image_url}:latest'
EOF
    
    # Build using Cloud Build with the config file
    log_info "Starting Cloud Build (this may take a few minutes)..." >&2
    
    if gcloud builds submit \
        --config="$cloudbuild_file" \
        --project="$GCP_PROJECT_ID" \
        . >&2; then
        log_success "Image built and pushed: ${image_url}:${timestamp}" >&2
        rm -f "$cloudbuild_file"
        # Return the image URL to stdout
        echo "${image_url}:${timestamp}"
        return 0
    else
        log_error "Failed to build image for $service" >&2
        rm -f "$cloudbuild_file"
        return 1
    fi
}

# Get service URL from Cloud Run
get_service_url() {
    local service=$1
    gcloud run services describe "$service" \
        --region="$GCP_REGION" \
        --project="$GCP_PROJECT_ID" \
        --format="value(status.url)" 2>/dev/null || echo ""
}

# Deploy service to Cloud Run
deploy_service() {
    local service=$1
    local image_url=$2
    local port=$(get_port "$service")
    
    log_info "Deploying $service to Cloud Run..."
    
    # Get Cloud SQL connection name
    local sql_connection=""
    if gcloud sql instances describe digitwinlive-db --project="$GCP_PROJECT_ID" &>/dev/null; then
        sql_connection=$(gcloud sql instances describe digitwinlive-db \
            --project="$GCP_PROJECT_ID" \
            --format="value(connectionName)" 2>/dev/null || echo "")
    fi
    
    # Build environment variables - include all service URLs
    local env_vars="NODE_ENV=production"
    env_vars+=",GCP_PROJECT_ID=${GCP_PROJECT_ID}"
    env_vars+=",GCP_REGION=${GCP_REGION}"
    
    # Add service URLs so services can communicate with each other
    env_vars+=",API_GATEWAY_URL=${API_GATEWAY_URL}"
    env_vars+=",WEBSOCKET_URL=${WEBSOCKET_URL}"
    env_vars+=",FACE_PROCESSING_URL=${FACE_PROCESSING_URL}"
    env_vars+=",LIPSYNC_SERVICE_URL=${FACE_PROCESSING_URL}"
    
    # Add GCS bucket variables if set
    [ -n "$GCS_BUCKET_VOICE_MODELS" ] && env_vars+=",GCS_BUCKET_VOICE_MODELS=${GCS_BUCKET_VOICE_MODELS}"
    [ -n "$GCS_BUCKET_FACE_MODELS" ] && env_vars+=",GCS_BUCKET_FACE_MODELS=${GCS_BUCKET_FACE_MODELS}"
    [ -n "$GCS_BUCKET_DOCUMENTS" ] && env_vars+=",GCS_BUCKET_DOCUMENTS=${GCS_BUCKET_DOCUMENTS}"
    [ -n "$GCS_BUCKET_UPLOADS" ] && env_vars+=",GCS_BUCKET_UPLOADS=${GCS_BUCKET_UPLOADS}"
    
    # Add caching configuration
    [ -n "$ENABLE_CACHING" ] && env_vars+=",ENABLE_CACHING=${ENABLE_CACHING}"
    [ -n "$CACHE_TTL_SHORT" ] && env_vars+=",CACHE_TTL_SHORT=${CACHE_TTL_SHORT}"
    [ -n "$CACHE_TTL_MEDIUM" ] && env_vars+=",CACHE_TTL_MEDIUM=${CACHE_TTL_MEDIUM}"
    [ -n "$CACHE_TTL_LONG" ] && env_vars+=",CACHE_TTL_LONG=${CACHE_TTL_LONG}"
    
    # Add CORS configuration
    [ -n "$CORS_ORIGIN" ] && env_vars+=",CORS_ORIGIN=${CORS_ORIGIN}"
    
    # Add logging configuration
    [ -n "$LOG_LEVEL" ] && env_vars+=",LOG_LEVEL=${LOG_LEVEL}"
    [ -n "$LOG_FORMAT" ] && env_vars+=",LOG_FORMAT=${LOG_FORMAT}"
    
    # Add feature flags
    [ -n "$ENABLE_API_DOCS" ] && env_vars+=",ENABLE_API_DOCS=${ENABLE_API_DOCS}"
    [ -n "$ENABLE_DEBUG_ENDPOINTS" ] && env_vars+=",ENABLE_DEBUG_ENDPOINTS=${ENABLE_DEBUG_ENDPOINTS}"
    
    # Build deploy arguments array
    local deploy_args=(
        "run" "deploy" "$service"
        "--image=$image_url"
        "--platform=managed"
        "--region=$GCP_REGION"
        "--project=$GCP_PROJECT_ID"
        "--port=$port"
        "--memory=512Mi"
        "--cpu=1"
        "--min-instances=0"
        "--max-instances=10"
        "--timeout=300"
        "--allow-unauthenticated"
        "--set-env-vars=$env_vars"
    )
    
    # Add Cloud SQL connection if available
    if [ -n "$sql_connection" ]; then
        deploy_args+=("--add-cloudsql-instances=$sql_connection")
        log_info "Cloud SQL connection: $sql_connection"
    fi
    
    # Add secrets if they exist
    if gcloud secrets describe jwt-secret --project="$GCP_PROJECT_ID" &>/dev/null; then
        deploy_args+=("--update-secrets=JWT_SECRET=jwt-secret:latest")
    fi
    if gcloud secrets describe refresh-secret --project="$GCP_PROJECT_ID" &>/dev/null; then
        deploy_args+=("--update-secrets=REFRESH_SECRET=refresh-secret:latest")
    fi
    if gcloud secrets describe database-password --project="$GCP_PROJECT_ID" &>/dev/null; then
        deploy_args+=("--update-secrets=DATABASE_PASSWORD=database-password:latest")
    fi
    
    # Execute deployment
    if gcloud "${deploy_args[@]}" ; then
        log_success "$service deployed successfully!"
        
        # Get and display service URL
        local url
        url=$(get_service_url "$service")
        
        if [ -n "$url" ]; then
            log_success "Service URL: $url"
            
            # Update the URL variable for subsequent deployments
            case "$service" in
                api-gateway) API_GATEWAY_URL="$url" ;;
                websocket-server) WEBSOCKET_URL="$url" ;;
                face-processing-service) FACE_PROCESSING_URL="$url" ;;
            esac
        fi
    else
        log_error "Failed to deploy $service"
        exit 3
    fi
}


# Deploy all or specific service
do_deploy() {
    local service=$1
    
    validate_env
    
    # Fetch current service URLs if they exist
    log_header "Fetching Current Service URLs"
    local url
    
    url=$(get_service_url "api-gateway")
    [ -n "$url" ] && API_GATEWAY_URL="$url" && log_info "api-gateway: $url"
    
    url=$(get_service_url "websocket-server")
    [ -n "$url" ] && WEBSOCKET_URL="$url" && log_info "websocket-server: $url"
    
    url=$(get_service_url "face-processing-service")
    [ -n "$url" ] && FACE_PROCESSING_URL="$url" && log_info "face-processing-service: $url"
    
    # Ensure infrastructure is ready
    log_header "Preparing Infrastructure"
    ensure_artifact_registry
    ensure_secret_permissions
    
    if [ -z "$service" ]; then
        log_header "Deploying All Services"
        
        for svc in $SERVICES; do
            log_header "Deploying $svc"
            local image
            if ! image=$(build_and_push_image "$svc"); then
                log_error "Build failed for $svc, stopping deployment"
                exit 2
            fi
            deploy_service "$svc" "$image"
            echo ""
        done
        
        log_success "All services deployed!"
        do_urls
    else
        if ! is_valid_service "$service"; then
            log_error "Unknown service: $service"
            log_info "Available services: $SERVICES"
            exit 1
        fi
        
        log_header "Deploying $service"
        local image
        if ! image=$(build_and_push_image "$service"); then
            log_error "Build failed for $service"
            exit 2
        fi
        deploy_service "$service" "$image"
    fi
}

# Show status of deployed services
do_status() {
    validate_env
    
    log_header "Cloud Run Services Status"
    
    for service in $SERVICES; do
        echo ""
        log_info "Service: $service"
        
        if gcloud run services describe "$service" \
            --region="$GCP_REGION" \
            --project="$GCP_PROJECT_ID" &>/dev/null; then
            
            local info=$(gcloud run services describe "$service" \
                --region="$GCP_REGION" \
                --project="$GCP_PROJECT_ID" \
                --format="csv[no-heading](status.url,status.latestReadyRevisionName)" 2>/dev/null || echo ",")
            
            local url=$(echo "$info" | cut -d',' -f1)
            local revision=$(echo "$info" | cut -d',' -f2)
            
            echo "  ✅ Status: Deployed"
            echo "  📍 URL: ${url:-N/A}"
            echo "  🔄 Revision: ${revision:-N/A}"
        else
            echo "  ❌ Status: Not deployed"
        fi
    done
}

# Show all service URLs
do_urls() {
    validate_env
    
    log_header "Deployed Service URLs"
    
    echo ""
    echo "# Add these to your .env or .env.production file:"
    echo ""
    
    for service in $SERVICES; do
        local url=$(get_service_url "$service")
        if [ -n "$url" ]; then
            case "$service" in
                api-gateway)
                    echo "API_GATEWAY_URL=$url"
                    ;;
                websocket-server)
                    echo "WEBSOCKET_URL=$url"
                    ;;
                face-processing-service)
                    echo "FACE_PROCESSING_URL=$url"
                    echo "LIPSYNC_SERVICE_URL=$url"
                    ;;
            esac
        else
            log_warning "$service: Not deployed"
        fi
    done
    
    echo ""
}

# Delete service(s)
do_delete() {
    local service=$1
    
    validate_env
    
    if [ -z "$service" ]; then
        log_warning "This will delete ALL Cloud Run services"
        read -p "Are you sure? (yes/NO) " -r
        echo
        
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log_info "Cancelled"
            return 0
        fi
        
        for svc in $SERVICES; do
            log_info "Deleting $svc..."
            gcloud run services delete "$svc" \
                --region="$GCP_REGION" \
                --project="$GCP_PROJECT_ID" \
                --quiet 2>/dev/null || true
        done
        
        log_success "All services deleted"
    else
        log_warning "Deleting $service..."
        
        if gcloud run services delete "$service" \
            --region="$GCP_REGION" \
            --project="$GCP_PROJECT_ID" \
            --quiet 2>&1; then
            log_success "$service deleted"
        else
            log_error "Failed to delete $service (may not exist)"
        fi
    fi
}

# Parse command line arguments
parse_args() {
    ENV_TYPE=""
    SERVICE=""
    COMMAND=""
    
    for arg in "$@"; do
        case "$arg" in
            --env=*)
                ENV_TYPE="${arg#*=}"
                ;;
            deploy|status|delete|urls)
                COMMAND="$arg"
                ;;
            api-gateway|websocket-server|face-processing-service)
                SERVICE="$arg"
                ;;
            -h|--help)
                usage
                ;;
            *)
                if [ -z "$COMMAND" ]; then
                    COMMAND="$arg"
                elif [ -z "$SERVICE" ]; then
                    SERVICE="$arg"
                fi
                ;;
        esac
    done
}

# Main
main() {
    if [ $# -eq 0 ]; then
        usage
    fi
    
    parse_args "$@"
    
    # Load appropriate environment file
    local env_file=$(get_env_file "$ENV_TYPE")
    load_env "$env_file"
    
    case "$COMMAND" in
        deploy)
            do_deploy "$SERVICE"
            ;;
        status)
            do_status
            ;;
        urls)
            do_urls
            ;;
        delete)
            do_delete "$SERVICE"
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            usage
            ;;
    esac
}

main "$@"
