#!/bin/bash

# GCP Management Script
# Manage GCP resources: enable, disable, start, stop, delete

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
        # Fallback: run without timeout on macOS
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
  start-all           Start all stoppable resources
  stop <resource>     Stop a GCP resource
  stop-all            Stop all running resources (save costs)
  delete <resource>   Delete a GCP resource
  list                List all resources
  cost                Show estimated costs

Services:
  apis                All required APIs
  storage             Cloud Storage buckets
  sql                 Cloud SQL instance
  gke                 GKE cluster
  weaviate            Weaviate deployment
  secrets             Secret Manager

Resources:
  sql-instance        Cloud SQL instance
  gke-cluster         GKE cluster
  weaviate-deployment Weaviate in GKE
  buckets             All storage buckets

Examples:
  $0 status
  $0 enable apis
  $0 start sql-instance
  $0 stop gke-cluster
  $0 stop-all              # Stop everything to save costs
  $0 start-all             # Start everything back up
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
    APIS=("compute" "container" "sqladmin" "storage-api" "run" "secretmanager")
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
    BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
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
    log_info "Cloud SQL:"
    if run_with_timeout 10 gcloud sql instances list --format="value(name)" 2>/dev/null | grep -q "digitwinlive-db"; then
        STATUS=$(run_with_timeout 5 gcloud sql instances describe digitwinlive-db --format="value(state)" 2>/dev/null || echo "unknown")
        echo "  ✅ digitwinlive-db: $STATUS"
    else
        echo "  ❌ digitwinlive-db: not found"
    fi
    
    # GKE
    echo ""
    log_info "GKE Cluster:"
    if run_with_timeout 10 gcloud container clusters list --format="value(name)" 2>/dev/null | grep -q "digitwinlive-cluster"; then
        STATUS=$(run_with_timeout 10 gcloud container clusters describe digitwinlive-cluster --region="$GCP_REGION" --format="value(status)" 2>/dev/null || echo "unknown")
        echo "  ✅ digitwinlive-cluster: $STATUS"
        
        # Weaviate deployment
        if command -v kubectl &> /dev/null; then
            if run_with_timeout 5 kubectl get deployment weaviate &> /dev/null; then
                REPLICAS=$(run_with_timeout 5 kubectl get deployment weaviate -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
                echo "  ✅ weaviate: $REPLICAS replicas ready"
            else
                echo "  ❌ weaviate: not deployed"
            fi
        fi
    else
        echo "  ❌ digitwinlive-cluster: not found"
    fi
    
    # Secrets
    echo ""
    log_info "Secret Manager:"
    
    # Check if Secret Manager API is enabled first
    if run_with_timeout 5 gcloud services list --enabled --filter="name:secretmanager.googleapis.com" --format="value(name)" 2>/dev/null | grep -q "secretmanager"; then
        # API is enabled, try to list secrets with timeout
        SECRET_COUNT=$(run_with_timeout 5 gcloud secrets list --format="value(name)" 2>/dev/null | wc -l | xargs || echo "0")
        echo "  ℹ️  $SECRET_COUNT secrets configured"
    else
        echo "  ℹ️  Secret Manager API not enabled"
    fi
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
                "container.googleapis.com"
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
        gke-cluster)
            log_info "Resizing GKE cluster to 1 node..."
            gcloud container clusters resize digitwinlive-cluster \
                --region="$GCP_REGION" \
                --num-nodes=1 \
                --quiet
            log_success "GKE cluster started"
            ;;
        weaviate-deployment)
            log_info "Scaling Weaviate to 1 replica..."
            kubectl scale deployment weaviate --replicas=1
            log_success "Weaviate started"
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
            ;;
        gke-cluster)
            log_warning "Resizing GKE cluster to 0 nodes..."
            gcloud container clusters resize digitwinlive-cluster \
                --region="$GCP_REGION" \
                --num-nodes=0 \
                --quiet
            log_success "GKE cluster stopped (0 nodes)"
            ;;
        weaviate-deployment)
            log_warning "Scaling Weaviate to 0 replicas..."
            kubectl scale deployment weaviate --replicas=0
            log_success "Weaviate stopped"
            ;;
        *)
            log_error "Unknown resource: $resource"
            usage
            ;;
    esac
}

# Stop all resources
stop_all_resources() {
    load_env
    
    log_header "Stopping All Resources"
    
    echo ""
    log_warning "This will stop all running GCP resources to minimize costs:"
    echo ""
    echo "  - Cloud SQL instance (~\$50/month savings)"
    echo "  - GKE cluster (~\$24/month savings)"
    echo "  - Weaviate deployment"
    echo ""
    log_info "Resources can be restarted with: $0 start-all"
    echo ""
    
    read -p "Continue? (y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cancelled"
        return 0
    fi
    
    echo ""
    
    # Stop Weaviate first (if GKE exists)
    if run_with_timeout 10 gcloud container clusters list --format="value(name)" 2>/dev/null | grep -q "digitwinlive-cluster"; then
        if command -v kubectl &> /dev/null; then
            if run_with_timeout 5 kubectl get deployment weaviate &> /dev/null 2>&1; then
                log_info "Stopping Weaviate deployment..."
                kubectl scale deployment weaviate --replicas=0 2>/dev/null || log_warning "Could not stop Weaviate"
                log_success "Weaviate stopped"
            fi
        fi
        
        # Stop GKE cluster
        log_info "Stopping GKE cluster (resizing to 0 nodes)..."
        gcloud container clusters resize digitwinlive-cluster \
            --region="$GCP_REGION" \
            --num-nodes=0 \
            --quiet 2>/dev/null || log_warning "Could not stop GKE cluster"
        log_success "GKE cluster stopped"
    else
        log_info "GKE cluster not found, skipping"
    fi
    
    # Stop Cloud SQL
    if run_with_timeout 10 gcloud sql instances list --format="value(name)" 2>/dev/null | grep -q "digitwinlive-db"; then
        log_info "Stopping Cloud SQL instance..."
        gcloud sql instances patch digitwinlive-db --activation-policy=NEVER 2>/dev/null || log_warning "Could not stop Cloud SQL"
        log_success "Cloud SQL instance stopped"
    else
        log_info "Cloud SQL instance not found, skipping"
    fi
    
    echo ""
    log_success "All resources stopped!"
    echo ""
    log_info "Estimated monthly savings: ~\$74"
    log_info "To restart: $0 start-all"
}

# Start all resources
start_all_resources() {
    load_env
    
    log_header "Starting All Resources"
    
    echo ""
    log_info "This will start all stopped GCP resources:"
    echo ""
    echo "  - Cloud SQL instance"
    echo "  - GKE cluster (1 node)"
    echo "  - Weaviate deployment (1 replica)"
    echo ""
    
    read -p "Continue? (y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cancelled"
        return 0
    fi
    
    echo ""
    
    # Start Cloud SQL
    if run_with_timeout 10 gcloud sql instances list --format="value(name)" 2>/dev/null | grep -q "digitwinlive-db"; then
        log_info "Starting Cloud SQL instance..."
        gcloud sql instances patch digitwinlive-db --activation-policy=ALWAYS 2>/dev/null || log_warning "Could not start Cloud SQL"
        log_success "Cloud SQL instance started"
    else
        log_info "Cloud SQL instance not found, skipping"
    fi
    
    # Start GKE cluster
    if run_with_timeout 10 gcloud container clusters list --format="value(name)" 2>/dev/null | grep -q "digitwinlive-cluster"; then
        log_info "Starting GKE cluster (resizing to 1 node)..."
        gcloud container clusters resize digitwinlive-cluster \
            --region="$GCP_REGION" \
            --num-nodes=1 \
            --quiet 2>/dev/null || log_warning "Could not start GKE cluster"
        log_success "GKE cluster started"
        
        # Start Weaviate
        if command -v kubectl &> /dev/null; then
            log_info "Waiting for cluster to be ready..."
            sleep 10
            
            if run_with_timeout 5 kubectl get deployment weaviate &> /dev/null 2>&1; then
                log_info "Starting Weaviate deployment..."
                kubectl scale deployment weaviate --replicas=1 2>/dev/null || log_warning "Could not start Weaviate"
                log_success "Weaviate started"
            fi
        fi
    else
        log_info "GKE cluster not found, skipping"
    fi
    
    echo ""
    log_success "All resources started!"
    echo ""
    log_info "Check status: $0 status"
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
        gke-cluster)
            log_warning "Deleting GKE cluster..."
            gcloud container clusters delete digitwinlive-cluster \
                --region="$GCP_REGION" \
                --quiet
            log_success "GKE cluster deleted"
            ;;
        weaviate-deployment)
            log_warning "Deleting Weaviate deployment..."
            kubectl delete deployment weaviate
            kubectl delete service weaviate
            log_success "Weaviate deleted"
            ;;
        buckets)
            log_warning "Deleting all storage buckets..."
            BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
            for bucket in "${BUCKETS[@]}"; do
                if [ -n "$bucket" ]; then
                    log_info "Deleting gs://$bucket..."
                    gsutil -m rm -r "gs://$bucket" 2>/dev/null || true
                fi
            done
            log_success "Buckets deleted"
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
    log_info "GKE Clusters:"
    gcloud container clusters list 2>/dev/null || echo "  No clusters found"
    
    echo ""
    log_info "Cloud Run Services:"
    gcloud run services list 2>/dev/null || echo "  No services found"
    
    echo ""
    log_info "Secrets:"
    gcloud secrets list --limit=10 2>/dev/null || echo "  No secrets found"
}

# Show estimated costs
show_costs() {
    log_header "Estimated Monthly Costs"
    
    load_env
    
    echo ""
    log_info "Storage Buckets:"
    BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
    TOTAL_SIZE=0
    for bucket in "${BUCKETS[@]}"; do
        if [ -n "$bucket" ] && gsutil ls "gs://$bucket" &> /dev/null; then
            SIZE=$(gsutil du -s "gs://$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
            TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
            SIZE_GB=$((SIZE / 1024 / 1024 / 1024))
            COST=$(echo "scale=2; $SIZE_GB * 0.02" | bc)
            echo "  $bucket: ${SIZE_GB}GB (~\$$COST/month)"
        fi
    done
    TOTAL_GB=$((TOTAL_SIZE / 1024 / 1024 / 1024))
    TOTAL_COST=$(echo "scale=2; $TOTAL_GB * 0.02" | bc)
    echo "  Total Storage: ${TOTAL_GB}GB (~\$$TOTAL_COST/month)"
    
    echo ""
    log_info "Cloud SQL (if running):"
    echo "  db-f1-micro: ~\$7.67/month"
    echo "  db-n1-standard-1: ~\$25/month"
    
    echo ""
    log_info "GKE Cluster (if running):"
    echo "  1 x e2-medium node: ~\$24/month"
    echo "  Cluster management: Free (1 zonal cluster)"
    
    echo ""
    log_info "Cloud Run (pay per use):"
    echo "  First 2M requests: Free"
    echo "  Additional: \$0.40 per million requests"
    
    echo ""
    log_info "Estimated Total (with SQL + GKE):"
    ESTIMATED=$(echo "scale=2; $TOTAL_COST + 7.67 + 24" | bc)
    echo "  ~\$$ESTIMATED/month (excluding Cloud Run usage)"
    
    echo ""
    log_warning "Note: Actual costs may vary based on usage"
    log_info "View actual costs: https://console.cloud.google.com/billing"
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
        start-all)
            start_all_resources
            ;;
        stop)
            stop_resource "$@"
            ;;
        stop-all)
            stop_all_resources
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
        *)
            log_error "Unknown command: $COMMAND"
            usage
            ;;
    esac
}

main "$@"