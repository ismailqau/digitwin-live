#!/bin/bash

# GCP Cleanup Script
# Safely delete all GCP resources

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

# Show usage
usage() {
    cat << EOF
Usage: $0 [options]

GCP Resource Cleanup Script

Options:
  --help, -h          Show this help message
  --all               Delete all resources (non-interactive)
  --selective         Interactive selective deletion (y/n for each)
  --menu              Menu-based selection (choose from list)

Interactive Mode (default):
  The script will show a menu to choose between:
  1) Complete cleanup (delete everything)
  2) Selective cleanup (choose what to delete)
  3) Cancel

Selective Deletion Methods:
  - Menu mode: Select resources from numbered list (e.g., 1,3,4)
  - Interactive mode: Answer y/n for each resource type

Examples:
  $0                  # Interactive mode with menu
  $0 --menu           # Skip to menu selection
  $0 --selective      # Skip to y/n selection
  $0 --all            # Delete everything (with confirmation)

EOF
    exit 0
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

# Show cleanup menu
show_cleanup_menu() {
    log_header "GCP Resource Cleanup"
    
    echo ""
    log_info "Select cleanup mode:"
    echo ""
    echo "  1) Delete ALL resources (complete cleanup)"
    echo "  2) Delete SELECTED resources (interactive)"
    echo "  3) Cancel"
    echo ""
    read -p "Enter choice (1-3): " MENU_CHOICE
    
    case $MENU_CHOICE in
        1)
            confirm_full_deletion
            return 0
            ;;
        2)
            return 1  # Continue to selective deletion
            ;;
        3)
            log_info "Cleanup cancelled"
            exit 0
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
}

# Discover all resources
discover_resources() {
    log_header "Discovering GCP Resources"
    
    echo ""
    log_info "Scanning project: $GCP_PROJECT_ID"
    echo ""
    
    # GKE Clusters
    log_info "Checking GKE clusters..."
    GKE_CLUSTERS=$(gcloud container clusters list --format="value(name,location)" 2>/dev/null || echo "")
    if [ -n "$GKE_CLUSTERS" ]; then
        GKE_COUNT=$(echo "$GKE_CLUSTERS" | wc -l | xargs)
        echo "  ✓ Found $GKE_COUNT GKE cluster(s)"
    else
        echo "  - No GKE clusters found"
    fi
    
    # Cloud SQL Instances
    log_info "Checking Cloud SQL instances..."
    SQL_INSTANCES=$(gcloud sql instances list --format="value(name)" 2>/dev/null || echo "")
    if [ -n "$SQL_INSTANCES" ]; then
        SQL_COUNT=$(echo "$SQL_INSTANCES" | wc -l | xargs)
        echo "  ✓ Found $SQL_COUNT Cloud SQL instance(s)"
    else
        echo "  - No Cloud SQL instances found"
    fi
    
    # Storage Buckets
    log_info "Checking storage buckets..."
    STORAGE_BUCKETS=$(gsutil ls 2>/dev/null | sed 's|gs://||' | sed 's|/||' || echo "")
    if [ -n "$STORAGE_BUCKETS" ]; then
        BUCKET_COUNT=$(echo "$STORAGE_BUCKETS" | wc -l | xargs)
        echo "  ✓ Found $BUCKET_COUNT storage bucket(s)"
    else
        echo "  - No storage buckets found"
    fi
    
    # Cloud Run Services
    log_info "Checking Cloud Run services..."
    CLOUD_RUN_SERVICES=$(gcloud run services list --format="value(metadata.name)" 2>/dev/null || echo "")
    if [ -n "$CLOUD_RUN_SERVICES" ]; then
        RUN_COUNT=$(echo "$CLOUD_RUN_SERVICES" | wc -l | xargs)
        echo "  ✓ Found $RUN_COUNT Cloud Run service(s)"
    else
        echo "  - No Cloud Run services found"
    fi
    
    # Service Accounts
    log_info "Checking service accounts..."
    SERVICE_ACCOUNTS=$(gcloud iam service-accounts list --format="value(email)" --filter="email:digitwinlive*" 2>/dev/null || echo "")
    if [ -n "$SERVICE_ACCOUNTS" ]; then
        SA_COUNT=$(echo "$SERVICE_ACCOUNTS" | wc -l | xargs)
        echo "  ✓ Found $SA_COUNT service account(s)"
    else
        echo "  - No service accounts found"
    fi
    
    # Secrets
    log_info "Checking secrets..."
    SECRETS=$(gcloud secrets list --format="value(name)" 2>/dev/null || echo "")
    if [ -n "$SECRETS" ]; then
        SECRET_COUNT=$(echo "$SECRETS" | wc -l | xargs)
        echo "  ✓ Found $SECRET_COUNT secret(s)"
    else
        echo "  - No secrets found"
    fi
    
    echo ""
}

# Show detailed resource list
show_resource_details() {
    log_header "Resource Details"
    
    echo ""
    
    # GKE Clusters
    if [ -n "$GKE_CLUSTERS" ]; then
        log_info "GKE Clusters:"
        gcloud container clusters list --format="table(name,location,currentMasterVersion,currentNodeCount,status)" 2>/dev/null || echo "  (Unable to list)"
        echo ""
    fi
    
    # Cloud SQL Instances
    if [ -n "$SQL_INSTANCES" ]; then
        log_info "Cloud SQL Instances:"
        gcloud sql instances list --format="table(name,databaseVersion,region,tier,state)" 2>/dev/null || echo "  (Unable to list)"
        echo ""
    fi
    
    # Storage Buckets
    if [ -n "$STORAGE_BUCKETS" ]; then
        log_info "Storage Buckets:"
        echo "$STORAGE_BUCKETS" | while read -r bucket; do
            if [ -n "$bucket" ]; then
                SIZE=$(gsutil du -s "gs://$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
                SIZE_HUMAN=$(numfmt --to=iec "$SIZE" 2>/dev/null || echo "${SIZE}B")
                LOCATION=$(gsutil ls -L -b "gs://$bucket" 2>/dev/null | grep "Location constraint:" | awk '{print $3}' || echo "unknown")
                echo "  - $bucket ($SIZE_HUMAN, $LOCATION)"
            fi
        done
        echo ""
    fi
    
    # Cloud Run Services
    if [ -n "$CLOUD_RUN_SERVICES" ]; then
        log_info "Cloud Run Services:"
        gcloud run services list --format="table(metadata.name,status.url,status.conditions.status)" 2>/dev/null || echo "  (Unable to list)"
        echo ""
    fi
    
    # Service Accounts
    if [ -n "$SERVICE_ACCOUNTS" ]; then
        log_info "Service Accounts:"
        echo "$SERVICE_ACCOUNTS" | while read -r sa; do
            if [ -n "$sa" ]; then
                echo "  - $sa"
            fi
        done
        echo ""
    fi
    
    # Secrets
    if [ -n "$SECRETS" ]; then
        log_info "Secrets:"
        gcloud secrets list --format="table(name,created,replication.automatic)" 2>/dev/null || echo "  (Unable to list)"
        echo ""
    fi
}

# Confirm full deletion
confirm_full_deletion() {
    # First discover resources
    discover_resources
    
    # Check if any resources exist
    TOTAL_RESOURCES=0
    [ -n "$GKE_CLUSTERS" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$GKE_CLUSTERS" | wc -l | xargs)))
    [ -n "$SQL_INSTANCES" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$SQL_INSTANCES" | wc -l | xargs)))
    [ -n "$STORAGE_BUCKETS" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$STORAGE_BUCKETS" | wc -l | xargs)))
    [ -n "$CLOUD_RUN_SERVICES" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$CLOUD_RUN_SERVICES" | wc -l | xargs)))
    [ -n "$SERVICE_ACCOUNTS" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$SERVICE_ACCOUNTS" | wc -l | xargs)))
    [ -n "$SECRETS" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$SECRETS" | wc -l | xargs)))
    
    if [ "$TOTAL_RESOURCES" -eq 0 ]; then
        log_success "No resources found to delete!"
        exit 0
    fi
    
    # Show detailed list
    echo ""
    read -p "Show detailed resource information? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        show_resource_details
    fi
    
    log_warning "This will DELETE $TOTAL_RESOURCES resource(s):"
    echo ""
    [ -n "$GKE_CLUSTERS" ] && echo "  - GKE clusters: $(echo "$GKE_CLUSTERS" | wc -l | xargs)"
    [ -n "$SQL_INSTANCES" ] && echo "  - Cloud SQL instances: $(echo "$SQL_INSTANCES" | wc -l | xargs)"
    [ -n "$STORAGE_BUCKETS" ] && echo "  - Storage buckets: $(echo "$STORAGE_BUCKETS" | wc -l | xargs)"
    [ -n "$CLOUD_RUN_SERVICES" ] && echo "  - Cloud Run services: $(echo "$CLOUD_RUN_SERVICES" | wc -l | xargs)"
    [ -n "$SERVICE_ACCOUNTS" ] && echo "  - Service accounts: $(echo "$SERVICE_ACCOUNTS" | wc -l | xargs)"
    [ -n "$SECRETS" ] && echo "  - Secrets: $(echo "$SECRETS" | wc -l | xargs)"
    echo ""
    log_error "THIS ACTION CANNOT BE UNDONE!"
    echo ""
    
    read -p "Type 'DELETE ALL' to confirm: " -r
    echo
    
    if [[ $REPLY != "DELETE ALL" ]]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
}

# Selective deletion menu
selective_deletion() {
    # First discover resources
    discover_resources
    
    # Check if any resources exist
    TOTAL_RESOURCES=0
    [ -n "$GKE_CLUSTERS" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$GKE_CLUSTERS" | wc -l | xargs)))
    [ -n "$SQL_INSTANCES" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$SQL_INSTANCES" | wc -l | xargs)))
    [ -n "$STORAGE_BUCKETS" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$STORAGE_BUCKETS" | wc -l | xargs)))
    [ -n "$CLOUD_RUN_SERVICES" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$CLOUD_RUN_SERVICES" | wc -l | xargs)))
    [ -n "$SERVICE_ACCOUNTS" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$SERVICE_ACCOUNTS" | wc -l | xargs)))
    [ -n "$SECRETS" ] && TOTAL_RESOURCES=$((TOTAL_RESOURCES + $(echo "$SECRETS" | wc -l | xargs)))
    
    if [ "$TOTAL_RESOURCES" -eq 0 ]; then
        log_success "No resources found to delete!"
        exit 0
    fi
    
    # Show detailed list
    echo ""
    read -p "Show detailed resource information? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        show_resource_details
    fi
    
    log_header "Selective Resource Deletion"
    
    echo ""
    log_info "Select resources to delete (y/n for each):"
    echo ""
    
    # GKE
    if [ -n "$GKE_CLUSTERS" ]; then
        read -p "Delete GKE cluster(s)? (y/N) " -n 1 -r
        echo
        DELETE_GKE=$REPLY
    else
        DELETE_GKE="n"
    fi
    
    # Cloud SQL
    if [ -n "$SQL_INSTANCES" ]; then
        read -p "Delete Cloud SQL instance(s)? (y/N) " -n 1 -r
        echo
        DELETE_SQL=$REPLY
    else
        DELETE_SQL="n"
    fi
    
    # Cloud Run
    if [ -n "$CLOUD_RUN_SERVICES" ]; then
        read -p "Delete Cloud Run service(s)? (y/N) " -n 1 -r
        echo
        DELETE_CLOUD_RUN=$REPLY
    else
        DELETE_CLOUD_RUN="n"
    fi
    
    # Buckets
    if [ -n "$STORAGE_BUCKETS" ]; then
        read -p "Delete Storage bucket(s)? (y/N) " -n 1 -r
        echo
        DELETE_BUCKETS=$REPLY
    else
        DELETE_BUCKETS="n"
    fi
    
    # Service accounts
    if [ -n "$SERVICE_ACCOUNTS" ]; then
        read -p "Delete Service account(s)? (y/N) " -n 1 -r
        echo
        DELETE_SA=$REPLY
    else
        DELETE_SA="n"
    fi
    
    # Secrets
    if [ -n "$SECRETS" ]; then
        read -p "Delete Secret(s)? (y/N) " -n 1 -r
        echo
        DELETE_SECRETS=$REPLY
    else
        DELETE_SECRETS="n"
    fi
    
    # Confirm selections
    echo ""
    log_warning "You selected to delete:"
    [[ $DELETE_GKE =~ ^[Yy]$ ]] && echo "  ✓ GKE cluster(s)"
    [[ $DELETE_SQL =~ ^[Yy]$ ]] && echo "  ✓ Cloud SQL instance(s)"
    [[ $DELETE_CLOUD_RUN =~ ^[Yy]$ ]] && echo "  ✓ Cloud Run service(s)"
    [[ $DELETE_BUCKETS =~ ^[Yy]$ ]] && echo "  ✓ Storage bucket(s)"
    [[ $DELETE_SA =~ ^[Yy]$ ]] && echo "  ✓ Service account(s)"
    [[ $DELETE_SECRETS =~ ^[Yy]$ ]] && echo "  ✓ Secret(s)"
    echo ""
    
    read -p "Confirm deletion? (yes/NO) " -r
    echo
    
    if [[ ! $REPLY =~ ^yes$ ]]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
}

# Weaviate is no longer used - using PostgreSQL pgvector instead

# Delete Cloud Run services
delete_cloud_run() {
    if [[ ! $DELETE_CLOUD_RUN =~ ^[Yy]$ ]] && [ "$1" != "force" ]; then
        log_info "Skipping Cloud Run services deletion"
        return 0
    fi
    
    log_header "Deleting Cloud Run Services"
    
    # Get all Cloud Run services
    SERVICES=$(gcloud run services list --format="value(metadata.name)" 2>/dev/null || echo "")
    
    if [ -z "$SERVICES" ]; then
        log_info "No Cloud Run services found, skipping"
        return 0
    fi
    
    # Delete each service
    echo "$SERVICES" | while read -r service; do
        if [ -n "$service" ]; then
            log_warning "Deleting Cloud Run service: $service..."
            if gcloud run services delete "$service" --region="$GCP_REGION" --quiet 2>/dev/null; then
                log_success "Cloud Run service $service deleted"
            else
                log_warning "Failed to delete $service (may not exist or already deleted)"
            fi
        fi
    done
    
    log_success "Cloud Run cleanup completed"
}

# Delete GKE cluster
delete_gke() {
    if [[ ! $DELETE_GKE =~ ^[Yy]$ ]] && [ "$1" != "force" ]; then
        log_info "Skipping GKE cluster deletion"
        return 0
    fi
    
    log_header "Deleting GKE Cluster"
    
    # Use discovered clusters if available
    if [ -n "$GKE_CLUSTERS" ]; then
        echo "$GKE_CLUSTERS" | while read -r cluster_info; do
            if [ -n "$cluster_info" ]; then
                CLUSTER_NAME=$(echo "$cluster_info" | awk '{print $1}')
                CLUSTER_LOCATION=$(echo "$cluster_info" | awk '{print $2}')
                log_warning "Deleting GKE cluster: $CLUSTER_NAME in $CLUSTER_LOCATION (this may take 5-10 minutes)..."
                if gcloud container clusters delete "$CLUSTER_NAME" \
                    --region="$CLUSTER_LOCATION" \
                    --quiet 2>/dev/null; then
                    log_success "GKE cluster $CLUSTER_NAME deleted"
                else
                    log_warning "Failed to delete GKE cluster $CLUSTER_NAME (may not exist or already deleted)"
                fi
            fi
        done
    else
        log_info "No GKE clusters found, skipping"
    fi
}

# Delete Cloud SQL
delete_cloud_sql() {
    # Skip if not selected (unless forced)
    if [[ ! $DELETE_SQL =~ ^[Yy]$ ]] && [ "$1" != "force" ]; then
        log_info "Skipping Cloud SQL deletion"
        return 0
    fi
    
    log_header "Deleting Cloud SQL"
    
    # Get all Cloud SQL instances
    INSTANCES=$(gcloud sql instances list --format="value(name)" 2>/dev/null)
    
    if [ -z "$INSTANCES" ]; then
        log_info "No Cloud SQL instances found"
        return 0
    fi
    
    # Count instances
    INSTANCE_COUNT=$(echo "$INSTANCES" | wc -l | xargs)
    
    # Show all instances with details
    echo ""
    log_info "Found $INSTANCE_COUNT Cloud SQL instance(s):"
    echo ""
    
    # Display instances with details
    gcloud sql instances list --format="table(name,databaseVersion,region,tier,ipAddresses[0].ipAddress,state)" 2>/dev/null
    
    if [ "$INSTANCE_COUNT" -eq 1 ]; then
        # Only one instance, delete directly with confirmation
        INSTANCE_NAME=$(echo "$INSTANCES" | head -1)
        echo ""
        log_warning "Delete $INSTANCE_NAME?"
        read -p "Confirm? (yes/NO) " -r
        echo
        
        if [[ $REPLY =~ ^yes$ ]]; then
            log_warning "Deleting Cloud SQL instance: $INSTANCE_NAME..."
            if gcloud sql instances delete "$INSTANCE_NAME" --quiet 2>/dev/null; then
                log_success "Cloud SQL instance $INSTANCE_NAME deleted"
            else
                log_warning "Failed to delete $INSTANCE_NAME (may not exist or already deleted)"
            fi
        else
            log_info "Cancelled"
        fi
    else
        # Multiple instances, let user choose
        echo ""
        log_warning "Select instances to delete:"
        echo ""
        
        # Create array of instances
        IFS=$'\n' read -d '' -r -a INSTANCE_ARRAY <<< "$INSTANCES" || true
        
        # Show menu
        for i in "${!INSTANCE_ARRAY[@]}"; do
            echo "  $((i+1))) ${INSTANCE_ARRAY[$i]}"
        done
        echo "  $((${#INSTANCE_ARRAY[@]}+1))) All instances"
        echo "  $((${#INSTANCE_ARRAY[@]}+2))) Cancel"
        echo ""
        
        read -p "Enter choices (comma-separated, e.g., 1,2): " INSTANCE_CHOICES
        
        # Parse choices
        if [[ $INSTANCE_CHOICES == "$((${#INSTANCE_ARRAY[@]}+2))" ]] || [ -z "$INSTANCE_CHOICES" ]; then
            log_info "Cancelled Cloud SQL deletion"
            return 0
        fi
        
        # Show what will be deleted
        echo ""
        log_warning "You selected to delete:"
        
        if [[ $INSTANCE_CHOICES == "$((${#INSTANCE_ARRAY[@]}+1))" ]]; then
            # All instances
            for instance in "${INSTANCE_ARRAY[@]}"; do
                echo "  ✓ $instance"
            done
        else
            # Selected instances
            IFS=',' read -ra CHOICES <<< "$INSTANCE_CHOICES"
            for choice in "${CHOICES[@]}"; do
                choice=$(echo "$choice" | xargs)
                if [[ $choice =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#INSTANCE_ARRAY[@]}" ]; then
                    echo "  ✓ ${INSTANCE_ARRAY[$((choice-1))]}"
                fi
            done
        fi
        
        echo ""
        read -p "Confirm deletion? (yes/NO) " -r
        echo
        
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log_info "Cancelled Cloud SQL deletion"
            return 0
        fi
        
        # Delete instances
        if [[ $INSTANCE_CHOICES == "$((${#INSTANCE_ARRAY[@]}+1))" ]]; then
            # Delete all
            for instance in "${INSTANCE_ARRAY[@]}"; do
                log_warning "Deleting Cloud SQL instance: $instance..."
                if gcloud sql instances delete "$instance" --quiet 2>/dev/null; then
                    log_success "Cloud SQL instance $instance deleted"
                else
                    log_warning "Failed to delete $instance (may not exist or already deleted)"
                fi
            done
        else
            # Delete selected instances
            IFS=',' read -ra CHOICES <<< "$INSTANCE_CHOICES"
            for choice in "${CHOICES[@]}"; do
                choice=$(echo "$choice" | xargs)
                if [[ $choice =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#INSTANCE_ARRAY[@]}" ]; then
                    instance="${INSTANCE_ARRAY[$((choice-1))]}"
                    log_warning "Deleting Cloud SQL instance: $instance..."
                    if gcloud sql instances delete "$instance" --quiet 2>/dev/null; then
                        log_success "Cloud SQL instance $instance deleted"
                    else
                        log_warning "Failed to delete $instance (may not exist or already deleted)"
                    fi
                else
                    log_warning "Invalid choice: $choice"
                fi
            done
        fi
    fi
}

# Delete storage buckets
delete_buckets() {
    if [[ ! $DELETE_BUCKETS =~ ^[Yy]$ ]] && [ "$1" != "force" ]; then
        log_info "Skipping storage buckets deletion"
        return 0
    fi
    
    log_header "Deleting Storage Buckets"
    
    # Get all buckets in the project
    ALL_BUCKETS=$(gsutil ls 2>/dev/null | sed 's|gs://||' | sed 's|/||' || echo "")
    
    if [ -z "$ALL_BUCKETS" ]; then
        log_info "No storage buckets found"
        return 0
    fi
    
    # Count buckets
    BUCKET_COUNT=$(echo "$ALL_BUCKETS" | wc -l | xargs)
    
    # Show all buckets with sizes
    echo ""
    log_info "Found $BUCKET_COUNT storage bucket(s):"
    echo ""
    
    # Display buckets with sizes
    IFS=$'\n' read -d '' -r -a BUCKET_ARRAY <<< "$ALL_BUCKETS" || true
    
    for bucket in "${BUCKET_ARRAY[@]}"; do
        SIZE=$(gsutil du -s "gs://$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
        SIZE_HUMAN=$(numfmt --to=iec "$SIZE" 2>/dev/null || echo "${SIZE}B")
        echo "  - $bucket ($SIZE_HUMAN)"
    done
    
    if [ "$BUCKET_COUNT" -eq 1 ]; then
        # Only one bucket, delete directly with confirmation
        BUCKET_NAME="${BUCKET_ARRAY[0]}"
        echo ""
        log_warning "Delete $BUCKET_NAME?"
        read -p "Confirm? (yes/NO) " -r
        echo
        
        if [[ $REPLY =~ ^yes$ ]]; then
            log_warning "Deleting bucket: $BUCKET_NAME..."
            if gsutil -m rm -r "gs://$BUCKET_NAME" 2>/dev/null; then
                log_success "Bucket $BUCKET_NAME deleted"
            else
                log_warning "Failed to delete bucket $BUCKET_NAME (may not exist or already deleted)"
            fi
        else
            log_info "Cancelled"
        fi
    else
        # Multiple buckets, let user choose
        echo ""
        log_warning "Select buckets to delete:"
        echo ""
        
        # Show menu
        for i in "${!BUCKET_ARRAY[@]}"; do
            echo "  $((i+1))) ${BUCKET_ARRAY[$i]}"
        done
        echo "  $((${#BUCKET_ARRAY[@]}+1))) All buckets"
        echo "  $((${#BUCKET_ARRAY[@]}+2))) Cancel"
        echo ""
        
        read -p "Enter choices (comma-separated, e.g., 1,3): " BUCKET_CHOICES
        
        # Parse choices
        if [[ $BUCKET_CHOICES == "$((${#BUCKET_ARRAY[@]}+2))" ]] || [ -z "$BUCKET_CHOICES" ]; then
            log_info "Cancelled bucket deletion"
            return 0
        fi
        
        # Show what will be deleted
        echo ""
        log_warning "You selected to delete:"
        
        if [[ $BUCKET_CHOICES == "$((${#BUCKET_ARRAY[@]}+1))" ]]; then
            # All buckets
            for bucket in "${BUCKET_ARRAY[@]}"; do
                echo "  ✓ $bucket"
            done
        else
            # Selected buckets
            IFS=',' read -ra CHOICES <<< "$BUCKET_CHOICES"
            for choice in "${CHOICES[@]}"; do
                choice=$(echo "$choice" | xargs)
                if [[ $choice =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#BUCKET_ARRAY[@]}" ]; then
                    echo "  ✓ ${BUCKET_ARRAY[$((choice-1))]}"
                fi
            done
        fi
        
        echo ""
        read -p "Confirm deletion? (yes/NO) " -r
        echo
        
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log_info "Cancelled bucket deletion"
            return 0
        fi
        
        # Delete buckets
        if [[ $BUCKET_CHOICES == "$((${#BUCKET_ARRAY[@]}+1))" ]]; then
            # Delete all
            for bucket in "${BUCKET_ARRAY[@]}"; do
                log_warning "Deleting bucket: $bucket..."
                if gsutil -m rm -r "gs://$bucket" 2>/dev/null; then
                    log_success "Bucket $bucket deleted"
                else
                    log_warning "Failed to delete bucket $bucket (may not exist or already deleted)"
                fi
            done
        else
            # Delete selected buckets
            IFS=',' read -ra CHOICES <<< "$BUCKET_CHOICES"
            for choice in "${CHOICES[@]}"; do
                choice=$(echo "$choice" | xargs)
                if [[ $choice =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#BUCKET_ARRAY[@]}" ]; then
                    bucket="${BUCKET_ARRAY[$((choice-1))]}"
                    log_warning "Deleting bucket: $bucket..."
                    if gsutil -m rm -r "gs://$bucket" 2>/dev/null; then
                        log_success "Bucket $bucket deleted"
                    else
                        log_warning "Failed to delete bucket $bucket (may not exist or already deleted)"
                    fi
                else
                    log_warning "Invalid choice: $choice"
                fi
            done
        fi
    fi
}

# Delete service accounts (optional)
delete_service_accounts() {
    if [[ ! $DELETE_SA =~ ^[Yy]$ ]] && [ "$1" != "force" ]; then
        log_info "Skipping service accounts deletion"
        return 0
    fi
    
    log_header "Deleting Service Accounts"
    
    SA_EMAIL="digitwinlive-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com"
    
    if gcloud iam service-accounts describe "$SA_EMAIL" &> /dev/null; then
        log_info "Deleting service account: $SA_EMAIL"
        if gcloud iam service-accounts delete "$SA_EMAIL" --quiet 2>/dev/null; then
            log_success "Service account deleted"
        else
            log_warning "Failed to delete service account (may not exist or already deleted)"
        fi
        
        # Delete local key file
        if [ -f "secrets/gcp-service-account-prod.json" ]; then
            rm "secrets/gcp-service-account-prod.json" 2>/dev/null || true
            log_success "Local key file deleted"
        fi
    else
        log_info "Service account not found, skipping"
    fi
}

# Delete secrets (optional)
delete_secrets() {
    if [[ ! $DELETE_SECRETS =~ ^[Yy]$ ]] && [ "$1" != "force" ]; then
        log_info "Skipping secrets deletion"
        return 0
    fi
    
    log_header "Deleting Secrets"
    
    log_info "Listing secrets..."
    SECRETS=$(gcloud secrets list --format="value(name)" 2>/dev/null || echo "")
    
    if [ -n "$SECRETS" ]; then
        for secret in $SECRETS; do
            log_info "Deleting secret: $secret"
            if gcloud secrets delete "$secret" --quiet 2>/dev/null; then
                log_success "Secret $secret deleted"
            else
                log_warning "Failed to delete secret $secret (may not exist or already deleted)"
            fi
        done
        log_success "Secrets cleanup completed"
    else
        log_info "No secrets found, skipping"
    fi
}

# Disable APIs (optional)
disable_apis() {
    log_header "Disabling APIs"
    
    log_info "Disabling APIs..."
    
    APIS=(
        "container.googleapis.com"
        "sqladmin.googleapis.com"
        "run.googleapis.com"
    )
    
    for api in "${APIS[@]}"; do
        log_info "Disabling $api..."
        if gcloud services disable "$api" --force --quiet 2>/dev/null; then
            log_success "API $api disabled"
        else
            log_warning "Failed to disable $api (may not be enabled or already disabled)"
        fi
    done
    
    log_success "API cleanup completed"
}

# Print summary
print_summary() {
    log_header "Cleanup Summary"
    
    echo ""
    log_success "Cleanup completed!"
    echo ""
    log_info "Resources processed:"
    [[ $DELETE_CLOUD_RUN =~ ^[Yy]$ ]] && echo "  ✅ Cloud Run services"
    [[ $DELETE_GKE =~ ^[Yy]$ ]] && echo "  ✅ GKE clusters"
    [[ $DELETE_SQL =~ ^[Yy]$ ]] && echo "  ✅ Cloud SQL instances"
    [[ $DELETE_BUCKETS =~ ^[Yy]$ ]] && echo "  ✅ Storage buckets"
    [[ $DELETE_SA =~ ^[Yy]$ ]] && echo "  ✅ Service accounts"
    [[ $DELETE_SECRETS =~ ^[Yy]$ ]] && echo "  ✅ Secrets"
    echo ""
    log_info "To verify remaining resources, run:"
    echo "  gcloud projects get-iam-policy $GCP_PROJECT_ID"
    echo "  gcloud services list --enabled"
}

# Show resource selection menu (streamlined - no extra confirmation)
show_resource_menu() {
    # First discover resources
    discover_resources
    
    log_header "Select Resources to Delete"
    
    echo ""
    log_info "Available resources:"
    echo ""
    echo "  1) GKE cluster(s)"
    echo "  2) Cloud SQL instances"
    echo "  3) Cloud Run services"
    echo "  4) Storage buckets"
    echo "  5) Service accounts"
    echo "  6) Secrets"
    echo "  7) Show detailed resource info"
    echo "  8) All of the above"
    echo "  9) Cancel"
    echo ""
    read -p "Enter choices (comma-separated, e.g., 1,3,4): " -r
    echo
    
    SELECTED_RESOURCES=$REPLY
    
    # Handle show details option
    if [[ $SELECTED_RESOURCES == *"7"* ]]; then
        show_resource_details
        echo ""
        read -p "Continue with selection? Enter new choices or press Enter to cancel: " -r
        echo
        SELECTED_RESOURCES=$REPLY
    fi
    
    # Parse selections
    DELETE_GKE="n"
    DELETE_SQL="n"
    DELETE_CLOUD_RUN="n"
    DELETE_BUCKETS="n"
    DELETE_SA="n"
    DELETE_SECRETS="n"
    
    if [[ $SELECTED_RESOURCES == "9" ]] || [ -z "$SELECTED_RESOURCES" ]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
    
    if [[ $SELECTED_RESOURCES == "8" ]]; then
        DELETE_GKE="y"
        DELETE_SQL="y"
        DELETE_CLOUD_RUN="y"
        DELETE_BUCKETS="y"
        DELETE_SA="y"
        DELETE_SECRETS="y"
    else
        IFS=',' read -ra CHOICES <<< "$SELECTED_RESOURCES"
        for choice in "${CHOICES[@]}"; do
            choice=$(echo "$choice" | xargs)  # Trim whitespace
            case $choice in
                1) DELETE_GKE="y" ;;
                2) DELETE_SQL="y" ;;
                3) DELETE_CLOUD_RUN="y" ;;
                4) DELETE_BUCKETS="y" ;;
                5) DELETE_SA="y" ;;
                6) DELETE_SECRETS="y" ;;
                *) log_warning "Invalid choice: $choice" ;;
            esac
        done
    fi
    
    # No extra confirmation - proceed directly to deletion
    # Each delete function will show details and ask for confirmation
}

# Main execution
main() {
    # Handle command line arguments
    case "${1:-}" in
        --help|-h)
            usage
            ;;
        --all)
            FORCE_ALL=true
            ;;
        --selective)
            FORCE_SELECTIVE=true
            ;;
        --menu)
            FORCE_MENU=true
            ;;
    esac
    
    load_env
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env"
        exit 1
    fi
    
    # Set project (ignore auth errors - will be caught by individual commands)
    gcloud config set project "$GCP_PROJECT_ID" 2>/dev/null || true
    
    # Verify authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
        log_error "Not authenticated with gcloud. Please run: gcloud auth login"
        exit 1
    fi
    
    # Determine cleanup mode
    if [ "$FORCE_ALL" = "true" ]; then
        # Force full deletion
        confirm_full_deletion
        DELETE_GKE="y"
        DELETE_SQL="y"
        DELETE_CLOUD_RUN="y"
        DELETE_BUCKETS="y"
        DELETE_SA="y"
        DELETE_SECRETS="y"
        delete_cloud_run force
        delete_gke force
        delete_cloud_sql force
        delete_buckets force
        delete_service_accounts force
        delete_secrets force
        disable_apis
    elif [ "$FORCE_SELECTIVE" = "true" ]; then
        # Force selective deletion (y/n for each)
        selective_deletion
        delete_cloud_run
        delete_gke
        delete_cloud_sql
        delete_buckets
        delete_service_accounts
        delete_secrets
        
        echo ""
        read -p "Disable GCP APIs? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            disable_apis
        fi
    elif [ "$FORCE_MENU" = "true" ]; then
        # Force menu selection
        show_resource_menu
        delete_cloud_run
        delete_gke
        delete_cloud_sql
        delete_buckets
        delete_service_accounts
        delete_secrets
        
        echo ""
        read -p "Disable GCP APIs? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            disable_apis
        fi
    else
        # Interactive menu
        if show_cleanup_menu; then
            # Full deletion mode
            DELETE_GKE="y"
            DELETE_SQL="y"
            DELETE_CLOUD_RUN="y"
            DELETE_BUCKETS="y"
            DELETE_SA="y"
            DELETE_SECRETS="y"
            delete_cloud_run force
            delete_gke force
            delete_cloud_sql force
            delete_buckets force
            delete_service_accounts force
            delete_secrets force
            disable_apis
        else
            # Show submenu for selective deletion
            echo ""
            log_info "Choose deletion method:"
            echo ""
            echo "  1) Select from menu (choose specific resources)"
            echo "  2) Interactive (y/n for each resource)"
            echo "  3) Cancel"
            echo ""
            read -p "Enter choice (1-3): " SUBMENU_CHOICE
            
            case $SUBMENU_CHOICE in
                1)
                    show_resource_menu
                    ;;
                2)
                    selective_deletion
                    ;;
                3)
                    log_info "Cleanup cancelled"
                    exit 0
                    ;;
                *)
                    log_error "Invalid choice"
                    exit 1
                    ;;
            esac
            
            delete_cloud_run
            delete_gke
            delete_cloud_sql
            delete_buckets
            delete_service_accounts
            delete_secrets
            
            # Ask about APIs separately
            echo ""
            read -p "Disable GCP APIs? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                disable_apis
            fi
        fi
    fi
    
    print_summary
}

main "$@"