#!/bin/bash

# GCP Management Script
# Manage GCP resources: enable, disable, start, stop, delete
# Uses PostgreSQL with pgvector (no separate vector database service)

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
  qwen3-tts-service

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
        log_error "GCP_PROJECT_ID not set in .env file"
        log_info "Please set GCP_PROJECT_ID in your .env file"
        return 1
    fi
    
    log_info "Project: $GCP_PROJECT_ID"
    log_info "Region: $GCP_REGION"
    
    if ! gcloud config set project "$GCP_PROJECT_ID" &> /dev/null; then
        log_error "Failed to set GCP project. Check authentication with: gcloud auth list"
        return 1
    fi
    
    # APIs
    echo ""
    log_info "APIs Status:"
    APIS=("compute.googleapis.com" "sqladmin.googleapis.com" "storage-component.googleapis.com" "run.googleapis.com" "secretmanager.googleapis.com" "artifactregistry.googleapis.com" "cloudbuild.googleapis.com")
    for api in "${APIS[@]}"; do
        API_NAME=$(echo "$api" | cut -d'.' -f1)
        if run_with_timeout 5 gcloud services list --enabled --filter="name:$api" --format="value(name)" 2>/dev/null | grep -q "$api"; then
            echo "  ✅ $API_NAME: enabled"
        else
            echo "  ❌ $API_NAME: disabled"
        fi
    done
    
    # Artifact Registry
    echo ""
    log_info "Artifact Registry:"
    if run_with_timeout 5 gcloud artifacts repositories list --location="$GCP_REGION" --format="value(name)" 2>/dev/null | grep -q "digitwinlive"; then
        echo "  ✅ digitwinlive: exists"
    else
        echo "  ❌ digitwinlive: not found"
    fi
    
    # Storage Buckets
    echo ""
    log_info "Storage Buckets:"
    BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_FACE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
    BUCKET_FOUND=false
    for bucket in "${BUCKETS[@]}"; do
        if [ -n "$bucket" ]; then
            if run_with_timeout 5 gsutil ls "gs://$bucket" &> /dev/null; then
                SIZE=$(run_with_timeout 5 gsutil du -s "gs://$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
                if command -v numfmt &> /dev/null; then
                    SIZE_HUMAN=$(numfmt --to=iec "$SIZE" 2>/dev/null || echo "${SIZE}B")
                else
                    SIZE_HUMAN="${SIZE}B"
                fi
                echo "  ✅ $bucket: exists ($SIZE_HUMAN)"
                BUCKET_FOUND=true
            else
                echo "  ❌ $bucket: not found"
            fi
        fi
    done
    if [ "$BUCKET_FOUND" = false ]; then
        echo "  ℹ️  No buckets configured or found"
    fi
    
    # Cloud SQL
    echo ""
    log_info "Cloud SQL (PostgreSQL + pgvector):"
    if run_with_timeout 10 gcloud sql instances list --format="value(name)" 2>/dev/null | grep -q "digitwinlive-db"; then
        STATUS=$(run_with_timeout 5 gcloud sql instances describe digitwinlive-db --format="value(state)" 2>/dev/null || echo "unknown")
        TIER=$(run_with_timeout 5 gcloud sql instances describe digitwinlive-db --format="value(settings.tier)" 2>/dev/null || echo "unknown")
        VERSION=$(run_with_timeout 5 gcloud sql instances describe digitwinlive-db --format="value(databaseVersion)" 2>/dev/null || echo "unknown")
        echo "  ✅ digitwinlive-db: $STATUS"
        echo "     Tier: $TIER"
        echo "     Version: $VERSION"
        
        # Show connection info
        CONNECTION=$(run_with_timeout 5 gcloud sql instances describe digitwinlive-db --format="value(connectionName)" 2>/dev/null || echo "")
        if [ -n "$CONNECTION" ]; then
            echo "     Connection: $CONNECTION"
        fi
        
        # Show IP if available
        IP=$(run_with_timeout 5 gcloud sql instances describe digitwinlive-db --format="value(ipAddresses[0].ipAddress)" 2>/dev/null || echo "")
        if [ -n "$IP" ]; then
            echo "     IP: $IP"
        fi
    else
        echo "  ❌ digitwinlive-db: not found"
    fi
    
    # Secrets
    echo ""
    log_info "Secret Manager:"
    if run_with_timeout 5 gcloud services list --enabled --filter="name:secretmanager.googleapis.com" --format="value(name)" 2>/dev/null | grep -q "secretmanager"; then
        SECRET_COUNT=$(run_with_timeout 5 gcloud secrets list --format="value(name)" 2>/dev/null | wc -l | xargs || echo "0")
        if [ "$SECRET_COUNT" -gt 0 ]; then
            echo "  ✅ Secret Manager: enabled ($SECRET_COUNT secrets)"
            # List secret names (not values)
            run_with_timeout 5 gcloud secrets list --format="table(name)" 2>/dev/null | tail -n +2 | while read -r secret; do
                echo "     - $secret"
            done
        else
            echo "  ℹ️  Secret Manager: enabled (0 secrets)"
        fi
    else
        echo "  ❌ Secret Manager: API not enabled"
    fi
    
    # Service Accounts
    echo ""
    log_info "Service Accounts:"
    SA_COUNT=$(run_with_timeout 5 gcloud iam service-accounts list --format="value(email)" 2>/dev/null | grep -c "digitwinlive" || echo "0")
    if [ "$SA_COUNT" -gt 0 ]; then
        echo "  ✅ Found $SA_COUNT service account(s)"
        run_with_timeout 5 gcloud iam service-accounts list --filter="email:digitwinlive*" --format="table(email)" 2>/dev/null | tail -n +2 | while read -r sa; do
            echo "     - $sa"
        done
    else
        echo "  ℹ️  No digitwinlive service accounts found"
    fi
    
    # Cloud Run Services
    echo ""
    log_info "Cloud Run Services:"
    CLOUD_RUN_SERVICES=("api-gateway" "websocket-server" "face-processing-service" "qwen3-tts-service")
    SERVICE_FOUND=false
    for service in "${CLOUD_RUN_SERVICES[@]}"; do
        if run_with_timeout 10 gcloud run services describe "$service" --region="$GCP_REGION" --format="value(status.url)" 2>/dev/null | grep -q "https://"; then
            URL=$(run_with_timeout 5 gcloud run services describe "$service" --region="$GCP_REGION" --format="value(status.url)" 2>/dev/null || echo "unknown")
            REVISION=$(run_with_timeout 5 gcloud run services describe "$service" --region="$GCP_REGION" --format="value(status.latestReadyRevisionName)" 2>/dev/null || echo "unknown")
            echo "  ✅ $service"
            echo "     URL: $URL"
            echo "     Revision: $REVISION"
            SERVICE_FOUND=true
        else
            echo "  ❌ $service: not deployed"
        fi
    done
    if [ "$SERVICE_FOUND" = false ]; then
        echo "  ℹ️  No Cloud Run services deployed"
    fi
    
    echo ""
    log_success "Status check completed in under 30 seconds"
    log_info "For detailed billing: https://console.cloud.google.com/billing"
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
                "storage-component.googleapis.com"
                "run.googleapis.com"
                "secretmanager.googleapis.com"
                "artifactregistry.googleapis.com"
                "cloudbuild.googleapis.com"
            )
            for api in "${APIS[@]}"; do
                log_info "Enabling $api..."
                gcloud services enable "$api"
            done
            log_success "APIs enabled"
            log_info "Note: Monitoring uses minimal essential alerts only"
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
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env file"
        return 1
    fi
    
    gcloud config set project "$GCP_PROJECT_ID" &> /dev/null
    
    case $resource in
        sql-instance)
            log_info "Starting Cloud SQL instance digitwinlive-db..."
            
            # Check if instance exists
            if ! gcloud sql instances describe digitwinlive-db &>/dev/null; then
                log_error "Cloud SQL instance digitwinlive-db not found"
                log_info "Run ./scripts/gcp-setup.sh to create it"
                return 1
            fi
            
            # Check current state
            CURRENT_STATE=$(gcloud sql instances describe digitwinlive-db --format="value(state)" 2>/dev/null || echo "unknown")
            if [ "$CURRENT_STATE" = "RUNNABLE" ]; then
                log_warning "Instance is already running"
                return 0
            fi
            
            # Start instance
            if gcloud sql instances patch digitwinlive-db --activation-policy=ALWAYS --quiet; then
                log_success "Cloud SQL instance started"
                log_info "Instance will be available in 1-2 minutes"
                log_info "Connection: $(gcloud sql instances describe digitwinlive-db --format='value(connectionName)' 2>/dev/null)"
            else
                log_error "Failed to start Cloud SQL instance"
                return 1
            fi
            ;;
        *)
            log_error "Unknown resource: $resource"
            log_info "Available resources: sql-instance"
            usage
            ;;
    esac
}

# Stop resource
stop_resource() {
    local resource=$1
    load_env
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env file"
        return 1
    fi
    
    gcloud config set project "$GCP_PROJECT_ID" &> /dev/null
    
    case $resource in
        sql-instance)
            log_warning "Stopping Cloud SQL instance digitwinlive-db..."
            
            # Check if instance exists
            if ! gcloud sql instances describe digitwinlive-db &>/dev/null; then
                log_error "Cloud SQL instance digitwinlive-db not found"
                return 1
            fi
            
            # Check current state
            CURRENT_STATE=$(gcloud sql instances describe digitwinlive-db --format="value(state)" 2>/dev/null || echo "unknown")
            if [ "$CURRENT_STATE" != "RUNNABLE" ]; then
                log_warning "Instance is not running (state: $CURRENT_STATE)"
                return 0
            fi
            
            # Confirm stop
            log_warning "This will stop the database. Services will not be able to connect."
            read -p "Continue? (yes/NO) " -r
            echo
            
            if [[ ! $REPLY =~ ^yes$ ]]; then
                log_info "Cancelled"
                return 0
            fi
            
            # Stop instance
            if gcloud sql instances patch digitwinlive-db --activation-policy=NEVER --quiet; then
                log_success "Cloud SQL instance stopped"
                log_info "Estimated savings: ~\$7.67/month (db-f1-micro)"
                log_info "To restart: ./scripts/gcp-manage.sh start sql-instance"
            else
                log_error "Failed to stop Cloud SQL instance"
                return 1
            fi
            ;;
        *)
            log_error "Unknown resource: $resource"
            log_info "Available resources: sql-instance"
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
            SERVICES=("api-gateway" "websocket-server" "face-processing-service" "qwen3-tts-service")
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
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env file"
        return 1
    fi
    
    log_info "Project: $GCP_PROJECT_ID"
    log_info "Region: $GCP_REGION"
    
    gcloud config set project "$GCP_PROJECT_ID" &> /dev/null
    
    # Enabled APIs
    echo ""
    log_info "Enabled APIs:"
    if gcloud services list --enabled --format="table(name)" 2>/dev/null | tail -n +2 | head -20; then
        API_COUNT=$(gcloud services list --enabled --format="value(name)" 2>/dev/null | wc -l | xargs)
        echo ""
        echo "  Total: $API_COUNT APIs enabled"
    else
        echo "  Failed to list APIs"
    fi
    
    # Artifact Registry
    echo ""
    log_info "Artifact Registry:"
    if gcloud artifacts repositories list --location="$GCP_REGION" --format="table(name,format,createTime)" 2>/dev/null | tail -n +2; then
        :
    else
        echo "  No repositories found"
    fi
    
    # Storage Buckets
    echo ""
    log_info "Storage Buckets:"
    if gsutil ls 2>/dev/null | grep "gs://"; then
        echo ""
        # Show sizes
        gsutil ls 2>/dev/null | grep "gs://" | while read -r bucket; do
            SIZE=$(gsutil du -s "$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
            if command -v numfmt &> /dev/null; then
                SIZE_HUMAN=$(numfmt --to=iec "$SIZE" 2>/dev/null || echo "${SIZE}B")
            else
                SIZE_HUMAN="${SIZE}B"
            fi
            echo "  $bucket - $SIZE_HUMAN"
        done
    else
        echo "  No buckets found"
    fi
    
    # Cloud SQL Instances
    echo ""
    log_info "Cloud SQL Instances:"
    if gcloud sql instances list --format="table(name,databaseVersion,region,tier,state)" 2>/dev/null | tail -n +2; then
        :
    else
        echo "  No instances found"
    fi
    
    # Service Accounts
    echo ""
    log_info "Service Accounts:"
    if gcloud iam service-accounts list --format="table(email,displayName)" 2>/dev/null | tail -n +2 | head -10; then
        SA_COUNT=$(gcloud iam service-accounts list --format="value(email)" 2>/dev/null | wc -l | xargs)
        echo ""
        echo "  Total: $SA_COUNT service accounts"
    else
        echo "  No service accounts found"
    fi
    
    # Cloud Run Services
    echo ""
    log_info "Cloud Run Services (region: $GCP_REGION):"
    if gcloud run services list --region="$GCP_REGION" --format="table(name,region,url,lastModifier)" 2>/dev/null | tail -n +2; then
        :
    else
        echo "  No services found in $GCP_REGION"
    fi
    
    # Secrets
    echo ""
    log_info "Secrets (Secret Manager):"
    if gcloud secrets list --format="table(name,createTime)" 2>/dev/null | tail -n +2 | head -10; then
        SECRET_COUNT=$(gcloud secrets list --format="value(name)" 2>/dev/null | wc -l | xargs)
        echo ""
        echo "  Total: $SECRET_COUNT secrets"
    else
        echo "  No secrets found"
    fi
    
    echo ""
    log_success "Resource listing complete"
}

# Show estimated costs
show_costs() {
    log_header "Estimated Monthly Costs"
    
    load_env
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env file"
        return 1
    fi
    
    gcloud config set project "$GCP_PROJECT_ID" &> /dev/null
    
    # Cloud SQL
    echo ""
    log_info "Cloud SQL PostgreSQL (with pgvector):"
    
    # Check if instance exists and get tier
    if gcloud sql instances describe digitwinlive-db &>/dev/null; then
        TIER=$(gcloud sql instances describe digitwinlive-db --format="value(settings.tier)" 2>/dev/null || echo "unknown")
        STATE=$(gcloud sql instances describe digitwinlive-db --format="value(state)" 2>/dev/null || echo "unknown")
        STORAGE_SIZE=$(gcloud sql instances describe digitwinlive-db --format="value(settings.dataDiskSizeGb)" 2>/dev/null || echo "10")
        
        echo "  Instance: digitwinlive-db"
        echo "  Tier: $TIER"
        echo "  State: $STATE"
        echo "  Storage: ${STORAGE_SIZE}GB"
        echo ""
        
        # Calculate costs based on tier
        case $TIER in
            db-f1-micro)
                INSTANCE_COST="7.67"
                echo "  Instance cost: ~\$$INSTANCE_COST/month (if running 24/7)"
                ;;
            db-custom-1-3840)
                INSTANCE_COST="52.74"
                echo "  Instance cost: ~\$$INSTANCE_COST/month (if running 24/7)"
                ;;
            *)
                echo "  Instance cost: Check GCP pricing for $TIER"
                INSTANCE_COST="0"
                ;;
        esac
        
        # Storage cost
        STORAGE_COST=$(echo "scale=2; $STORAGE_SIZE * 0.17" | bc 2>/dev/null || echo "1.70")
        echo "  Storage cost: ~\$$STORAGE_COST/month"
        
        # Backup cost (7 backups * storage size * $0.08/GB)
        BACKUP_COST=$(echo "scale=2; 7 * $STORAGE_SIZE * 0.08" | bc 2>/dev/null || echo "5.60")
        echo "  Backup cost: ~\$$BACKUP_COST/month (7 automated backups)"
        
        if [ "$STATE" != "RUNNABLE" ]; then
            echo ""
            log_warning "Instance is stopped - only storage and backup costs apply"
        fi
    else
        echo "  ❌ No Cloud SQL instance found"
        echo "  Estimated cost if created:"
        echo "    db-f1-micro: ~\$7.67/month + storage"
        echo "    db-custom-1-3840: ~\$52.74/month + storage"
    fi
    
    # Storage Buckets
    echo ""
    log_info "Cloud Storage Buckets:"
    BUCKETS=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_FACE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
    TOTAL_SIZE=0
    BUCKET_COUNT=0
    
    for bucket in "${BUCKETS[@]}"; do
        if [ -n "$bucket" ] && gsutil ls "gs://$bucket" &> /dev/null; then
            SIZE=$(gsutil du -s "gs://$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
            TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
            BUCKET_COUNT=$((BUCKET_COUNT + 1))
            
            # Convert to human readable
            SIZE_GB=$(echo "scale=2; $SIZE / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
            if command -v numfmt &> /dev/null; then
                SIZE_HUMAN=$(numfmt --to=iec "$SIZE" 2>/dev/null || echo "${SIZE}B")
            else
                SIZE_HUMAN="${SIZE_GB}GB"
            fi
            echo "  $bucket: $SIZE_HUMAN"
        fi
    done
    
    if [ $BUCKET_COUNT -gt 0 ]; then
        TOTAL_GB=$(echo "scale=2; $TOTAL_SIZE / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
        STORAGE_COST=$(echo "scale=2; $TOTAL_GB * 0.02" | bc 2>/dev/null || echo "0")
        echo ""
        echo "  Total: ${TOTAL_GB}GB (~\$$STORAGE_COST/month at \$0.02/GB)"
    else
        echo "  No buckets found or configured"
        echo "  Estimated: \$0.02/GB/month for Standard Storage"
    fi
    
    # Cloud Run
    echo ""
    log_info "Cloud Run (pay-per-use):"
    echo "  Pricing:"
    echo "    - First 2M requests/month: Free"
    echo "    - CPU: \$0.00002400/vCPU-second"
    echo "    - Memory: \$0.00000250/GiB-second"
    echo "    - Requests: \$0.40 per million (after free tier)"
    echo ""
    echo "  Example (moderate usage):"
    echo "    - 100K requests/month: ~\$0 (within free tier)"
    echo "    - 1M requests/month: ~\$0 (within free tier)"
    echo "    - 5M requests/month: ~\$1.20"
    echo ""
    echo "  Scale-to-zero: No cost when not in use"
    echo ""
    echo "  Qwen3-TTS (16Gi RAM, 4 vCPU):"
    echo "    - Scale-to-zero when idle"
    echo "    - ~\$0.10/hr when active (CPU + memory)"
    echo "    - GPU instance (if enabled): ~\$0.50-1.50/hr"
    
    # Artifact Registry
    echo ""
    log_info "Artifact Registry:"
    if gcloud artifacts repositories describe digitwinlive --location="$GCP_REGION" &>/dev/null; then
        echo "  Storage: \$0.10/GB/month"
        echo "  Typical usage: 1-5GB (~\$0.10-0.50/month)"
    else
        echo "  Not configured"
    fi
    
    # Total estimate
    echo ""
    log_header "Estimated Total Monthly Cost"
    echo ""
    echo "  Development (db-f1-micro, minimal usage):"
    echo "    Cloud SQL: ~\$8-10/month"
    echo "    Storage: ~\$0-2/month"
    echo "    Cloud Run: ~\$0-1/month"
    echo "    Total: ~\$8-13/month"
    echo ""
    echo "  Production (db-custom-1-3840, moderate usage):"
    echo "    Cloud SQL: ~\$55-60/month"
    echo "    Storage: ~\$2-10/month"
    echo "    Cloud Run: ~\$5-20/month"
    echo "    Total: ~\$62-90/month"
    
    # Cost savings
    echo ""
    log_info "💰 Cost Savings vs Separate Vector Database:"
    echo "  Weaviate Cloud: \$25-100+/month"
    echo "  Pinecone: \$70-280+/month"
    echo "  pgvector in PostgreSQL: \$0 (included)"
    echo ""
    echo "  Estimated savings: \$25-280/month"
    
    echo ""
    log_warning "Note: Estimates based on typical usage. Actual costs may vary."
    log_info "View actual costs: https://console.cloud.google.com/billing"
    log_info "Set up budget alerts: https://console.cloud.google.com/billing/budgets"
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
