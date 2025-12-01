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

# Confirm full deletion
confirm_full_deletion() {
    log_warning "This will DELETE ALL resources:"
    echo ""
    echo "  - All Cloud Storage buckets"
    echo "  - Cloud SQL instances"
    echo "  - GKE clusters"
    echo "  - Service accounts"
    echo "  - Secrets"
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
    log_header "Selective Resource Deletion"
    
    echo ""
    log_info "Select resources to delete (y/n for each):"
    echo ""
    
    # GKE
    read -p "Delete GKE cluster? (y/N) " -n 1 -r
    echo
    DELETE_GKE=$REPLY
    
    # Cloud SQL
    read -p "Delete Cloud SQL instances? (y/N) " -n 1 -r
    echo
    DELETE_SQL=$REPLY
    
    # Buckets
    read -p "Delete Storage buckets? (y/N) " -n 1 -r
    echo
    DELETE_BUCKETS=$REPLY
    
    # Service accounts
    read -p "Delete Service accounts? (y/N) " -n 1 -r
    echo
    DELETE_SA=$REPLY
    
    # Secrets
    read -p "Delete Secrets? (y/N) " -n 1 -r
    echo
    DELETE_SECRETS=$REPLY
    
    # Confirm selections
    echo ""
    log_warning "You selected to delete:"
    [[ $DELETE_GKE =~ ^[Yy]$ ]] && echo "  ✓ GKE cluster"
    [[ $DELETE_SQL =~ ^[Yy]$ ]] && echo "  ✓ Cloud SQL instances"
    [[ $DELETE_BUCKETS =~ ^[Yy]$ ]] && echo "  ✓ Storage buckets"
    [[ $DELETE_SA =~ ^[Yy]$ ]] && echo "  ✓ Service accounts"
    [[ $DELETE_SECRETS =~ ^[Yy]$ ]] && echo "  ✓ Secrets"
    echo ""
    
    read -p "Confirm deletion? (yes/NO) " -r
    echo
    
    if [[ ! $REPLY =~ ^yes$ ]]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
}

# Weaviate is no longer used - using PostgreSQL pgvector instead

# Delete GKE cluster
delete_gke() {
    log_header "Deleting GKE Cluster"
    
    if gcloud container clusters describe digitwinlive-cluster --region="$GCP_REGION" &> /dev/null; then
        log_warning "Deleting GKE cluster (this may take 5-10 minutes)..."
        gcloud container clusters delete digitwinlive-cluster \
            --region="$GCP_REGION" \
            --quiet
        log_success "GKE cluster deleted"
    else
        log_info "GKE cluster not found, skipping"
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
            gcloud sql instances delete "$INSTANCE_NAME" --quiet
            log_success "Cloud SQL instance $INSTANCE_NAME deleted"
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
                gcloud sql instances delete "$instance" --quiet 2>/dev/null || log_error "Failed to delete $instance"
                log_success "Cloud SQL instance $instance deleted"
            done
        else
            # Delete selected instances
            IFS=',' read -ra CHOICES <<< "$INSTANCE_CHOICES"
            for choice in "${CHOICES[@]}"; do
                choice=$(echo "$choice" | xargs)
                if [[ $choice =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#INSTANCE_ARRAY[@]}" ]; then
                    instance="${INSTANCE_ARRAY[$((choice-1))]}"
                    log_warning "Deleting Cloud SQL instance: $instance..."
                    gcloud sql instances delete "$instance" --quiet 2>/dev/null || log_error "Failed to delete $instance"
                    log_success "Cloud SQL instance $instance deleted"
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
            gsutil -m rm -r "gs://$BUCKET_NAME" 2>/dev/null || true
            log_success "Bucket $BUCKET_NAME deleted"
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
                gsutil -m rm -r "gs://$bucket" 2>/dev/null || true
                log_success "Bucket $bucket deleted"
            done
        else
            # Delete selected buckets
            IFS=',' read -ra CHOICES <<< "$BUCKET_CHOICES"
            for choice in "${CHOICES[@]}"; do
                choice=$(echo "$choice" | xargs)
                if [[ $choice =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#BUCKET_ARRAY[@]}" ]; then
                    bucket="${BUCKET_ARRAY[$((choice-1))]}"
                    log_warning "Deleting bucket: $bucket..."
                    gsutil -m rm -r "gs://$bucket" 2>/dev/null || true
                    log_success "Bucket $bucket deleted"
                else
                    log_warning "Invalid choice: $choice"
                fi
            done
        fi
    fi
}

# Delete service accounts (optional)
delete_service_accounts() {
    log_header "Service Accounts"
    
    read -p "Delete service accounts? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        SA_EMAIL="digitwinlive-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com"
        
        if gcloud iam service-accounts describe "$SA_EMAIL" &> /dev/null; then
            log_info "Deleting service account..."
            gcloud iam service-accounts delete "$SA_EMAIL" --quiet
            log_success "Service account deleted"
            
            # Delete local key file
            if [ -f "secrets/gcp-service-account-prod.json" ]; then
                rm "secrets/gcp-service-account-prod.json"
                log_success "Local key file deleted"
            fi
        else
            log_info "Service account not found"
        fi
    else
        log_info "Keeping service accounts"
    fi
}

# Delete secrets (optional)
delete_secrets() {
    log_header "Secrets"
    
    read -p "Delete all secrets from Secret Manager? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Listing secrets..."
        SECRETS=$(gcloud secrets list --format="value(name)" 2>/dev/null)
        
        if [ -n "$SECRETS" ]; then
            for secret in $SECRETS; do
                log_info "Deleting secret: $secret"
                gcloud secrets delete "$secret" --quiet 2>/dev/null || true
            done
            log_success "Secrets deleted"
        else
            log_info "No secrets found"
        fi
    else
        log_info "Keeping secrets"
    fi
}

# Disable APIs (optional)
disable_apis() {
    log_header "APIs"
    
    read -p "Disable GCP APIs? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Disabling APIs..."
        
        APIS=(
            "container.googleapis.com"
            "sqladmin.googleapis.com"
            "run.googleapis.com"
        )
        
        for api in "${APIS[@]}"; do
            log_info "Disabling $api..."
            gcloud services disable "$api" --force --quiet 2>/dev/null || true
        done
        
        log_success "APIs disabled"
    else
        log_info "Keeping APIs enabled"
    fi
}

# Print summary
print_summary() {
    log_header "Cleanup Summary"
    
    echo ""
    log_success "Cleanup completed!"
    echo ""
    log_info "Deleted resources:"
    echo "  ✅ Storage buckets"
    echo "  ✅ Cloud SQL instance (if existed)"
    echo "  ✅ GKE cluster (if existed)"
    echo ""
    log_info "Remaining resources (if not deleted):"
    echo "  - Service accounts"
    echo "  - Secrets in Secret Manager"
    echo "  - Enabled APIs"
    echo ""
    log_info "To view remaining resources:"
    echo "  ./scripts/gcp-manage.sh list"
    echo ""
    log_info "To check costs:"
    echo "  ./scripts/gcp-manage.sh cost"
}

# Show resource selection menu (streamlined - no extra confirmation)
show_resource_menu() {
    log_header "Select Resources to Delete"
    
    echo ""
    log_info "Available resources:"
    echo ""
    echo "  1) GKE cluster"
    echo "  2) Cloud SQL instances"
    echo "  4) Storage buckets"
    echo "  5) Service accounts"
    echo "  6) Secrets"
    echo "  7) All of the above"
    echo "  8) Cancel"
    echo ""
    read -p "Enter choices (comma-separated, e.g., 1,3,4): " -r
    echo
    
    SELECTED_RESOURCES=$REPLY
    
    # Parse selections
    DELETE_GKE="n"
    DELETE_SQL="n"
    DELETE_BUCKETS="n"
    DELETE_SA="n"
    DELETE_SECRETS="n"
    
    if [[ $SELECTED_RESOURCES == "8" ]] || [ -z "$SELECTED_RESOURCES" ]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
    
    if [[ $SELECTED_RESOURCES == "7" ]]; then
        DELETE_GKE="y"
        DELETE_SQL="y"
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
    
    gcloud config set project "$GCP_PROJECT_ID" &> /dev/null
    
    # Determine cleanup mode
    if [ "$FORCE_ALL" = "true" ]; then
        # Force full deletion
        confirm_full_deletion
        delete_gke force
        delete_cloud_sql force
        delete_buckets force
        delete_service_accounts force
        delete_secrets force
        disable_apis
    elif [ "$FORCE_SELECTIVE" = "true" ]; then
        # Force selective deletion (y/n for each)
        selective_deletion
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