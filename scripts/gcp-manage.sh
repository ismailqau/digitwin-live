#!/bin/bash

# GCP Management Script
# Manage GCP resources: enable, disable, start, stop, delete
# Uses PostgreSQL with pgvector (no GKE/Weaviate)

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

# Timeout wrapper for macOS/Linux compatibility
run_with_timeout() {
    local timeout_duration=$1
    shift
    
    if command -v timeout &> /dev/null; then
        timeout "$timeout_duration" "$@"
    elif command -v gtimeout &> /dev/null; then
        gtimeout "$timeout_duration" "$@"
    else
        "$@" &
        local pid=$!
        ( sleep "$timeout_duration" && kill -TERM $pid 2>/dev/null && sleep 1 && kill -9 $pid 2>/dev/null ) &
        local killer=$!
        wait $pid 2>/dev/null
        local result=$?
        kill -TERM $killer 2>/dev/null
        wait $killer 2>/dev/null
        return $result
    fi
}

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
    
    GCP_REGION=${GCP_REGION:-us-central1}
}

# Show usage
usage() {
    cat << EOF
Usage: $0 <command> [options]

Commands:
  status              Show status of all GCP resources
  enable <service>    Enable a GCP service
  disable <service>   Disable a GCP service
  start <resource>    Start a GCP resource
  stop <resource>     Stop a GCP resource
  delete <resource>   Delete a GCP resource
  list                List all resources
  cost                Show estimated costs
  deploy              Deploy all Cloud Run services
  deploy <service>    Deploy a specific service

Services:
  apis                All required APIs
  storage             Cloud Storage buckets

Resources:
  sql-instance        Cloud SQL instance (PostgreSQL + pgvector)
  buckets             All storage buckets
  cloud-run           All Cloud Run services

Cloud Run Services:
  api-gateway
  websocket-server
  face-processing-service

Examples:
  $0 status
  $0 enable apis
  $0 start sql-instance
  $0 stop sql-instance
  $0 deploy
  $0 deploy api-gateway
  $0 delete buckets
  $0 list
  $0 cost

EOF
    exit 1
}

# Show status
show_status() {
    log_header "GCP Resources Status"
    
    load_env
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set"
        return 1
    fi
    
    gcloud config set project "$GCP_PROJECT_ID" &> /dev/null
    
    # APIs
    log_info "APIs Status:"
    APIS=("compute" "sqladmin" "storage-api" "run" "secretmanager")
    for api in "${APIS[@]}"; do
        if run_with_timeout 5 gcloud services list --enabled --filter="name:$api" 2>/dev/null | grep -q "$api"; then
            echo "  ✅ $api: enabled"
        else
            echo "  ❌ $api: disabled"
        fi
    done
    
    # Storage Buckets
    echo ""
    log_info "Storage Buckets:"
    BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_FACE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
    for bucket in "${BUCKETS[@]}"; do
        if [ -n "$bucket" ]; then
            if run_with_timeout 5 gsutil ls "gs://$bucket" &> /dev/null; then
                SIZE=$(run_with_timeout 5 gsutil du -s "gs://$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
                SIZE_HUMAN=$(numfmt --to=iec $SIZE 2>/dev/null || echo "${SIZE}B")
                echo "  ✅ $bucket: exists ($SIZE_HUMAN)"
            else
                echo "  ❌ $bucket: not found"
            fi
        fi
    done
    
    # Cloud SQL
    echo ""
    log_info "Cloud SQL (PostgreSQL + pgvector):"
    if run_with_timeout 10 gcloud sql instances list --format="value(name)" 2>/dev/null | grep -q "digitwinlive-db"; then
        STATUS=$(run_with_timeout 5 gcloud sql instances describe digitwinlive-db --format="value(state)" 2>/dev/null || echo "unknown")
        echo "  ✅ digitwinlive-db: $STATUS"
        
        # Show connection info
        CONNECTION=$(run_with_timeout 5 gcloud sql instances describe digitwinlive-db --format="value(connectionName)" 2>/dev/null || echo "")
        if [ -n "$CONNECTION" ]; then
            echo "  📍 Connection: $CONNECTION"
        fi
    else
        echo "  ❌ digitwinlive-db: not found"
    fi
    
    # Secrets
    echo ""
    log_info "Secret Manager:"
    if run_with_timeout 5 gcloud services list --enabled --filter="name:secretmanager.googleapis.com" --format="value(name)" 2>/dev/null | grep -q "secretmanager"; then
        SECRET_COUNT=$(run_with_timeout 5 gcloud secrets list --format="value(name)" 2>/dev/null | wc -l | xargs || echo "0")
        echo "  ℹ️  $SECRET_COUNT secrets configured"
    else
        echo "  ℹ️  Secret Manager API not enabled"
    fi
    
    # Cloud Run Services
    echo ""
    log_info "Cloud Run Services:"
    CLOUD_RUN_SERVICES=("api-gateway" "websocket-server" "face-processing-service")
    for service in "${CLOUD_RUN_SERVICES[@]}"; do
        if run_with_timeout 10 gcloud run services describe "$service" --region="$GCP_REGION" &>/dev/null; then
            URL=$(run_with_timeout 5 gcloud run services describe "$service" --region="$GCP_REGION" --format="value(status.url)" 2>/dev/null || echo "unknown")
            echo "  ✅ $service: $URL"
        else
            echo "  ❌ $service: not deployed"
        fi
    done
}

# Enable service
enable_service() {
    local service=$1
    load_env
    
    case $service in
        apis)
            log_header "Enabling APIs"
            APIS=(
                "compute.googleapis.com"
                "sqladmin.googleapis.com"
                "storage-api.googleapis.com"
                "run.googleapis.com"
                "secretmanager.googleapis.com"
            )
            for api in "${APIS[@]}"; do
                log_info "Enabling $api..."
                gcloud services enable "$api"
            done
            log_success "APIs enabled"
            ;;
        storage)
            log_header "Creating Storage Buckets"
            ./scripts/gcp-setup.sh
            ;;
        *)
            log_error "Unknown service: $service"
            usage
            ;;
    esac
}

# Start resource
start_resource() {
    local resource=$1
    load_env
    
    case $resource in
        sql-instance)
            log_info "Starting Cloud SQL instance..."
            gcloud sql instances patch digitwinlive-db --activation-policy=ALWAYS
            log_success "Cloud SQL instance started"
            ;;
        *)
            log_error "Unknown resource: $resource"
            usage
            ;;
    esac
}

# Stop resource
stop_resource() {
    local resource=$1
    load_env
    
    case $resource in
        sql-instance)
            log_warning "Stopping Cloud SQL instance..."
            gcloud sql instances patch digitwinlive-db --activation-policy=NEVER
            log_success "Cloud SQL instance stopped"
            log_info "Estimated savings: ~$7.67/month"
            ;;
        *)
            log_error "Unknown resource: $resource"
            usage
            ;;
    esac
}

# Delete resource
delete_resource() {
    local resource=$1
    load_env
    
    log_warning "This will permanently delete $resource"
    read -p "Are you sure? (yes/NO) " -r
    echo
    
    if [[ ! $REPLY =~ ^yes$ ]]; then
        log_info "Cancelled"
        return 0
    fi
    
    case $resource in
        sql-instance)
            log_warning "Deleting Cloud SQL instance..."
            gcloud sql instances delete digitwinlive-db --quiet
            log_success "Cloud SQL instance deleted"
            ;;
        buckets)
            log_warning "Deleting all storage buckets..."
            BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_FACE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
            for bucket in "${BUCKETS[@]}"; do
                if [ -n "$bucket" ]; then
                    log_info "Deleting gs://$bucket..."
                    gsutil -m rm -r "gs://$bucket" 2>/dev/null || true
                fi
            done
            log_success "Buckets deleted"
            ;;
        cloud-run)
            log_warning "Deleting all Cloud Run services..."
            SERVICES=("api-gateway" "websocket-server" "face-processing-service")
            for service in "${SERVICES[@]}"; do
                log_info "Deleting $service..."
                gcloud run services delete "$service" --region="$GCP_REGION" --quiet 2>/dev/null || true
            done
            log_success "Cloud Run services deleted"
            ;;
        *)
            log_error "Unknown resource: $resource"
            usage
            ;;
    esac
}

# List resources
list_resources() {
    log_header "GCP Resources"
    
    load_env
    gcloud config set project "$GCP_PROJECT_ID" &> /dev/null
    
    echo ""
    log_info "Storage Buckets:"
    gsutil ls 2>/dev/null | grep "gs://" || echo "  No buckets found"
    
    echo ""
    log_info "Cloud SQL Instances:"
    gcloud sql instances list 2>/dev/null || echo "  No instances found"
    
    echo ""
    log_info "Cloud Run Services:"
    gcloud run services list --region="$GCP_REGION" 2>/dev/null || echo "  No services found"
    
    echo ""
    log_info "Secrets:"
    gcloud secrets list --limit=10 2>/dev/null || echo "  No secrets found"
}

# Show estimated costs
show_costs() {
    log_header "Estimated Monthly Costs"
    
    load_env
    
    echo ""
    log_info "Cloud SQL PostgreSQL (with pgvector):"
    echo '  db-f1-micro: ~$7.67/month (if running)'
    echo '  Storage: ~$0.17/GB/month'
    echo ""
    
    log_info "Storage Buckets:"
    BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_FACE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
    TOTAL_SIZE=0
    for bucket in "${BUCKETS[@]}"; do
        if [ -n "$bucket" ] && gsutil ls "gs://$bucket" &> /dev/null; then
            SIZE=$(gsutil du -s "gs://$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
            TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
        fi
    done
    TOTAL_GB=$((TOTAL_SIZE / 1024 / 1024 / 1024))
    echo "  Total Storage: ${TOTAL_GB}GB (~\$0.02/GB/month)"
    
    echo ""
    log_info "Cloud Run (pay per use):"
    echo '  First 2M requests: Free'
    echo '  CPU: $0.00002400/vCPU-second'
    echo '  Memory: $0.00000250/GiB-second'
    echo '  Typically very low cost for moderate usage'
    
    echo ""
    log_info "Estimated Total (minimal usage):"
    echo '  ~$8-15/month'
    echo ""
    log_info "Cost Savings vs Weaviate/GKE:"
    echo '  No GKE cluster needed: Saves ~$24/month'
    echo '  pgvector in PostgreSQL handles all vector operations'
    
    echo ""
    log_warning "Note: Actual costs may vary based on usage"
    log_info "View actual costs: https://console.cloud.google.com/billing"
}

# Deploy Cloud Run services
deploy_services() {
    local script="./scripts/gcp-deploy-services.sh"
    
    if [ ! -f "$script" ]; then
        log_error "Deployment script not found: $script"
        log_info "Run from project root directory"
        exit 1
    fi
    
    if [ ! -x "$script" ]; then
        chmod +x "$script"
    fi
    
    "$script" deploy "$@"
}

# Main
main() {
    if [ $# -eq 0 ]; then
        usage
    fi
    
    COMMAND=$1
    shift
    
    case $COMMAND in
        status)
            show_status
            ;;
        enable)
            enable_service "$@"
            ;;
        start)
            start_resource "$@"
            ;;
        stop)
            stop_resource "$@"
            ;;
        delete)
            delete_resource "$@"
            ;;
        list)
            list_resources
            ;;
        cost)
            show_costs
            ;;
        deploy)
            deploy_services "$@"
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            usage
            ;;
    esac
}

main "$@"
