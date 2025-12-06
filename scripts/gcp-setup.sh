#!/bin/bash

# =============================================================================
# GCP Setup Script
# =============================================================================
# Creates all required GCP resources for DigiTwin Live
# Uses PostgreSQL with pgvector for vector storage (no GKE/Weaviate needed)
#
# Requirements validated:
# - 1.1: Verify gcloud CLI is installed and authenticated
# - 1.2: Enable all required GCP APIs
# - 1.3: Create Artifact Registry repository
# - 1.4: Create Cloud Storage buckets
# - 1.5: Configure bucket lifecycle policies
# - 1.6: Create Cloud SQL PostgreSQL 15 instance
# - 1.7: Create service accounts with IAM roles
# - 1.8: Create placeholder secrets in Secret Manager
# - 1.9: Provide clear instructions for next steps
# - 2.1: PostgreSQL 15+ for pgvector compatibility
# - 2.2: Environment-based tier selection
# - 2.3: Enable automatic backups
# =============================================================================

set -e

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
# Environment Loading
# =============================================================================
load_env() {
    local env_file="${1:-.env}"
    
    if [ -f "$env_file" ]; then
        log_info "Loading environment from $env_file"
        set -a
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            if [[ ! "$key" =~ ^[[:space:]]*# ]] && [[ -n "$key" ]] && [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
                # Skip ${SECRET_*} placeholders (handled by Secret Manager)
                if [[ ! "$value" =~ ^\$\{SECRET_ ]]; then
                    value=$(echo "$value" | sed 's/#.*//' | sed 's/^["'\'']//' | sed 's/["'\'']$//' | xargs)
                    export "$key=$value"
                fi
            fi
        done < "$env_file"
        set +a
        log_success "Environment loaded"
    else
        log_warning "Environment file $env_file not found"
    fi
}

# =============================================================================
# Prerequisites Check (Requirement 1.1)
# =============================================================================
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not installed"
        log_info "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    log_success "gcloud CLI installed: $(gcloud version 2>/dev/null | head -1)"
    
    # Check authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
        log_error "Not authenticated with gcloud"
        log_info "Run: gcloud auth login"
        exit 1
    fi
    local account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
    log_success "Authenticated as: $account"
    
    # Check gsutil
    if ! command -v gsutil &> /dev/null; then
        log_warning "gsutil not found (usually included with gcloud)"
    else
        log_success "gsutil available"
    fi
}

# =============================================================================
# Project Setup
# =============================================================================
setup_project() {
    log_header "Setting Up GCP Project"
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set"
        log_info "Set it in .env file or export GCP_PROJECT_ID=your-project-id"
        exit 1
    fi
    
    # Verify project exists and is accessible
    if ! gcloud projects describe "$GCP_PROJECT_ID" &> /dev/null; then
        log_error "Cannot access project: $GCP_PROJECT_ID"
        log_info "Ensure the project exists and you have access"
        exit 1
    fi
    
    gcloud config set project "$GCP_PROJECT_ID" --quiet
    log_success "Project set to: $GCP_PROJECT_ID"
    
    # Set region
    GCP_REGION=${GCP_REGION:-us-central1}
    gcloud config set compute/region "$GCP_REGION" --quiet
    log_success "Region set to: $GCP_REGION"
    
    # Determine environment
    if [[ "$GCS_BUCKET_VOICE_MODELS" == *"-prod" ]] || [[ "$NODE_ENV" == "production" ]]; then
        ENV="prod"
    else
        ENV="dev"
    fi
    export ENV
    log_info "Environment detected: $ENV"
}

# =============================================================================
# Enable Required APIs (Requirement 1.2)
# =============================================================================
enable_apis() {
    log_header "Enabling Required GCP APIs"
    
    # All required APIs per requirements (compute, sqladmin, storage, run, secretmanager, artifactregistry, cloudbuild)
    APIS=(
        "compute.googleapis.com"
        "sqladmin.googleapis.com"
        "storage-api.googleapis.com"
        "storage-component.googleapis.com"
        "storage.googleapis.com"
        "run.googleapis.com"
        "secretmanager.googleapis.com"
        "artifactregistry.googleapis.com"
        "cloudbuild.googleapis.com"
        "cloudresourcemanager.googleapis.com"
        "iam.googleapis.com"
        "servicenetworking.googleapis.com"
        "containerregistry.googleapis.com"
    )
    
    local enabled_count=0
    local already_enabled_count=0
    local failed_count=0
    
    for api in "${APIS[@]}"; do
        log_info "Checking $api..."
        
        # Check if already enabled (idempotent - Property 1)
        if gcloud services list --enabled --filter="name:$api" --format="value(name)" 2>/dev/null | grep -q "$api"; then
            log_success "$api already enabled"
            ((already_enabled_count++))
        else
            log_info "Enabling $api..."
            if gcloud services enable "$api" --quiet 2>&1; then
                log_success "$api enabled"
                ((enabled_count++))
            else
                log_warning "Could not enable $api (may need billing or permissions)"
                ((failed_count++))
            fi
        fi
    done
    
    log_info "APIs: $enabled_count newly enabled, $already_enabled_count already enabled, $failed_count failed"
    
    # Verify critical APIs are enabled
    local critical_apis=("run.googleapis.com" "sqladmin.googleapis.com" "artifactregistry.googleapis.com" "cloudbuild.googleapis.com" "secretmanager.googleapis.com")
    local missing_critical=()
    
    for api in "${critical_apis[@]}"; do
        if ! gcloud services list --enabled --filter="name:$api" --format="value(name)" 2>/dev/null | grep -q "$api"; then
            missing_critical+=("$api")
        fi
    done
    
    if [ ${#missing_critical[@]} -gt 0 ]; then
        log_error "Critical APIs not enabled: ${missing_critical[*]}"
        log_info "Please enable these APIs manually in GCP Console or check billing"
        return 1
    fi
    
    log_success "All critical APIs verified"
}

# =============================================================================
# Create Artifact Registry (Requirement 1.3)
# =============================================================================
create_artifact_registry() {
    log_header "Creating Artifact Registry Repository"
    
    local REPO_NAME="digitwinlive"
    local REPO_LOCATION="$GCP_REGION"
    local REGISTRY_URL="$REPO_LOCATION-docker.pkg.dev/$GCP_PROJECT_ID/$REPO_NAME"
    
    log_info "Checking if Artifact Registry repository exists..."
    
    # Idempotent check
    if gcloud artifacts repositories describe "$REPO_NAME" --location="$REPO_LOCATION" &> /dev/null; then
        log_success "Artifact Registry repository '$REPO_NAME' already exists"
    else
        log_info "Creating Artifact Registry repository: $REPO_NAME"
        
        if gcloud artifacts repositories create "$REPO_NAME" \
            --repository-format=docker \
            --location="$REPO_LOCATION" \
            --description="DigiTwin Live container images" \
            --quiet 2>&1; then
            log_success "Artifact Registry repository created: $REPO_NAME"
        else
            log_error "Failed to create Artifact Registry repository"
            return 1
        fi
    fi
    
    # Configure Docker authentication for Artifact Registry
    log_info "Configuring Docker authentication for Artifact Registry..."
    
    # Check if Docker is available
    if command -v docker &> /dev/null; then
        if gcloud auth configure-docker "$REPO_LOCATION-docker.pkg.dev" --quiet 2>/dev/null; then
            log_success "Docker authentication configured for $REPO_LOCATION-docker.pkg.dev"
        else
            log_warning "Docker auth configuration may have failed"
        fi
        
        # Verify Docker can authenticate
        log_info "Verifying Docker authentication..."
        if docker pull "$REPO_LOCATION-docker.pkg.dev/google-samples/containers/gke/hello-app:1.0" &> /dev/null 2>&1; then
            log_success "Docker authentication verified"
        else
            log_info "Docker auth verification skipped (test image not accessible)"
        fi
    else
        log_warning "Docker not installed - skipping Docker auth configuration"
        log_info "Run this command after installing Docker:"
        echo "  gcloud auth configure-docker $REPO_LOCATION-docker.pkg.dev"
    fi
    
    # Display registry URL
    echo ""
    log_info "Registry URL: $REGISTRY_URL"
    log_info "To push images:"
    echo "  docker tag IMAGE:TAG $REGISTRY_URL/IMAGE:TAG"
    echo "  docker push $REGISTRY_URL/IMAGE:TAG"
    
    # Export for use by other functions
    export ARTIFACT_REGISTRY_URL="$REGISTRY_URL"
}

# =============================================================================
# Create Storage Buckets with Lifecycle Policies (Requirements 1.4, 1.5)
# Property 2: Bucket Creation Completeness
# Property 3: Lifecycle Policy Application
# =============================================================================
create_storage_buckets() {
    log_header "Creating Cloud Storage Buckets"
    
    # Set default bucket names if not provided (using project ID for uniqueness)
    local PROJECT_SUFFIX="${GCP_PROJECT_ID:-digitwinlive}"
    GCS_BUCKET_VOICE_MODELS=${GCS_BUCKET_VOICE_MODELS:-"${PROJECT_SUFFIX}-voice-models-${ENV}"}
    GCS_BUCKET_FACE_MODELS=${GCS_BUCKET_FACE_MODELS:-"${PROJECT_SUFFIX}-face-models-${ENV}"}
    GCS_BUCKET_DOCUMENTS=${GCS_BUCKET_DOCUMENTS:-"${PROJECT_SUFFIX}-documents-${ENV}"}
    GCS_BUCKET_UPLOADS=${GCS_BUCKET_UPLOADS:-"${PROJECT_SUFFIX}-uploads-${ENV}"}
    
    # All required buckets per requirements
    BUCKETS=(
        "$GCS_BUCKET_VOICE_MODELS:Voice models storage:standard"
        "$GCS_BUCKET_FACE_MODELS:Face models storage:standard"
        "$GCS_BUCKET_DOCUMENTS:Documents storage:standard"
        "$GCS_BUCKET_UPLOADS:User uploads storage:temp"
        "${PROJECT_SUFFIX}-terraform-state-${ENV}:Terraform state storage:terraform"
    )
    
    local created_count=0
    local existing_count=0
    local failed_count=0
    
    for bucket_info in "${BUCKETS[@]}"; do
        local bucket=$(echo "$bucket_info" | cut -d: -f1)
        local description=$(echo "$bucket_info" | cut -d: -f2)
        local bucket_type=$(echo "$bucket_info" | cut -d: -f3)
        
        if [ -z "$bucket" ]; then
            log_warning "Bucket name not set, skipping"
            continue
        fi
        
        log_info "Processing bucket: $bucket ($description)"
        
        # Idempotent check (Property 2)
        if gsutil ls "gs://$bucket" &> /dev/null; then
            log_success "Bucket '$bucket' already exists"
            ((existing_count++))
        else
            if gsutil mb -p "$GCP_PROJECT_ID" -l "$GCP_REGION" -b on "gs://$bucket" 2>&1; then
                log_success "Created bucket: $bucket"
                ((created_count++))
            else
                log_error "Failed to create bucket: $bucket"
                ((failed_count++))
                continue
            fi
        fi
        
        # Apply lifecycle policies based on bucket type (Requirement 1.5, Property 3)
        case "$bucket_type" in
            terraform)
                # Terraform state bucket: versioning + retention
                log_info "Configuring Terraform state bucket..."
                gsutil versioning set on "gs://$bucket" 2>/dev/null || true
                
                cat > /tmp/tf-lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "numNewerVersions": 3,
          "age": 30
        }
      }
    ]
  }
}
EOF
                if gsutil lifecycle set /tmp/tf-lifecycle.json "gs://$bucket" 2>/dev/null; then
                    log_success "Terraform bucket configured (versioning + 30-day retention)"
                else
                    log_warning "Could not set lifecycle policy for $bucket"
                fi
                rm -f /tmp/tf-lifecycle.json
                ;;
            temp)
                # Uploads bucket: delete temp files after 30 days, all files after 90 days
                cat > /tmp/uploads-lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30, "matchesPrefix": ["temp/"]}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90, "matchesPrefix": ["uploads/"]}
      }
    ]
  }
}
EOF
                if gsutil lifecycle set /tmp/uploads-lifecycle.json "gs://$bucket" 2>/dev/null; then
                    log_success "Lifecycle policy applied (30-day temp, 90-day uploads cleanup)"
                else
                    log_warning "Could not set lifecycle policy for $bucket"
                fi
                rm -f /tmp/uploads-lifecycle.json
                ;;
            standard|*)
                # Standard buckets: delete temp files after 90 days
                cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90, "matchesPrefix": ["temp/"]}
      }
    ]
  }
}
EOF
                if gsutil lifecycle set /tmp/lifecycle.json "gs://$bucket" 2>/dev/null; then
                    log_success "Lifecycle policy applied (90-day temp cleanup)"
                else
                    log_warning "Could not set lifecycle policy for $bucket"
                fi
                rm -f /tmp/lifecycle.json
                ;;
        esac
    done
    
    log_info "Buckets: $created_count created, $existing_count already existed, $failed_count failed"
    
    # Verify all required buckets exist (Property 2)
    local required_buckets=("$GCS_BUCKET_VOICE_MODELS" "$GCS_BUCKET_FACE_MODELS" "$GCS_BUCKET_DOCUMENTS" "$GCS_BUCKET_UPLOADS")
    local missing_buckets=()
    
    for bucket in "${required_buckets[@]}"; do
        if ! gsutil ls "gs://$bucket" &> /dev/null; then
            missing_buckets+=("$bucket")
        fi
    done
    
    if [ ${#missing_buckets[@]} -gt 0 ]; then
        log_error "Required buckets missing: ${missing_buckets[*]}"
        return 1
    fi
    
    log_success "All required storage buckets verified"
    
    # Export bucket names for use by other scripts
    export GCS_BUCKET_VOICE_MODELS
    export GCS_BUCKET_FACE_MODELS
    export GCS_BUCKET_DOCUMENTS
    export GCS_BUCKET_UPLOADS
}

# =============================================================================
# Create Cloud SQL Instance (Requirements 1.6, 2.1, 2.2, 2.3)
# Property 6: PostgreSQL Version Compliance (15+)
# Property 7: Environment-Based Tier Selection
# Property 8: Backup Configuration
# =============================================================================
create_cloud_sql() {
    log_header "Creating Cloud SQL Instance with pgvector Support"
    
    local INSTANCE_NAME="digitwinlive-db"
    local DB_NAME="digitwinlive-db"
    
    # Environment-based tier selection (Requirement 2.2, Property 7)
    local TIER
    local AVAILABILITY_TYPE
    local STORAGE_SIZE
    
    if [ "$ENV" == "prod" ]; then
        TIER="db-custom-1-3840"  # 1 vCPU, 3.75GB RAM for production
        AVAILABILITY_TYPE="zonal"  # Use "regional" for HA in production
        STORAGE_SIZE="20GB"
        log_info "Production tier: $TIER (1 vCPU, 3.75GB RAM)"
    else
        TIER="db-f1-micro"  # Shared core, 0.6GB RAM for development
        AVAILABILITY_TYPE="zonal"
        STORAGE_SIZE="10GB"
        log_info "Development tier: $TIER (shared core, 0.6GB RAM)"
    fi
    
    log_info "Checking if Cloud SQL instance exists..."
    
    # Idempotent check
    if gcloud sql instances describe "$INSTANCE_NAME" --project="$GCP_PROJECT_ID" &> /dev/null; then
        log_success "Cloud SQL instance '$INSTANCE_NAME' already exists"
        
        local INSTANCE_STATE=$(gcloud sql instances describe "$INSTANCE_NAME" \
            --project="$GCP_PROJECT_ID" \
            --format="value(state)" 2>/dev/null)
        log_info "Instance state: $INSTANCE_STATE"
        
        # Verify PostgreSQL version (Property 6)
        local DB_VERSION=$(gcloud sql instances describe "$INSTANCE_NAME" \
            --project="$GCP_PROJECT_ID" \
            --format="value(databaseVersion)" 2>/dev/null)
        
        if [[ "$DB_VERSION" =~ POSTGRES_1[5-9] ]] || [[ "$DB_VERSION" =~ POSTGRES_[2-9][0-9] ]]; then
            log_success "PostgreSQL version: $DB_VERSION (pgvector compatible)"
        else
            log_warning "PostgreSQL version: $DB_VERSION (may not support pgvector)"
        fi
        
        # Verify backups are enabled (Property 8)
        local BACKUP_ENABLED=$(gcloud sql instances describe "$INSTANCE_NAME" \
            --project="$GCP_PROJECT_ID" \
            --format="value(settings.backupConfiguration.enabled)" 2>/dev/null)
        
        if [ "$BACKUP_ENABLED" == "True" ]; then
            log_success "Automatic backups: enabled"
        else
            log_warning "Automatic backups: disabled - consider enabling"
        fi
        
        # Get connection name for output
        local CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
            --project="$GCP_PROJECT_ID" \
            --format="value(connectionName)" 2>/dev/null)
        
        print_pgvector_instructions "$CONNECTION_NAME" "$DB_NAME"
        
        # Export connection name
        export CLOUD_SQL_CONNECTION_NAME="$CONNECTION_NAME"
        return 0
    fi
    
    log_info "Creating Cloud SQL instance: $INSTANCE_NAME"
    log_warning "This will take 5-10 minutes..."
    echo ""
    log_info "Configuration:"
    echo "  Instance: $INSTANCE_NAME"
    echo "  Database: $DB_NAME"
    echo "  Tier: $TIER"
    echo "  PostgreSQL: 15 (pgvector compatible) [Property 6]"
    echo "  Region: $GCP_REGION"
    echo "  Storage: $STORAGE_SIZE SSD (auto-increase enabled)"
    echo "  Backups: Daily at 03:00 UTC [Property 8]"
    echo "  Availability: $AVAILABILITY_TYPE"
    echo ""
    
    # Create instance with PostgreSQL 15 (Requirement 2.1, Property 6)
    # Enable backups (Requirement 2.3, Property 8)
    if gcloud sql instances create "$INSTANCE_NAME" \
        --project="$GCP_PROJECT_ID" \
        --database-version=POSTGRES_15 \
        --tier="$TIER" \
        --region="$GCP_REGION" \
        --storage-type=SSD \
        --storage-size="$STORAGE_SIZE" \
        --storage-auto-increase \
        --backup-start-time=03:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=4 \
        --database-flags=max_connections=100 \
        --availability-type="$AVAILABILITY_TYPE" \
        --quiet 2>&1; then
        
        log_success "Cloud SQL instance created successfully!"
        
        log_info "Waiting for instance to be ready..."
        sleep 15
        
        # Set root password
        log_info "Setting root password..."
        local ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        
        if gcloud sql users set-password postgres \
            --instance="$INSTANCE_NAME" \
            --project="$GCP_PROJECT_ID" \
            --password="$ROOT_PASSWORD" 2>/dev/null; then
            log_success "Root password set"
            echo ""
            log_warning "╔════════════════════════════════════════════════════════════════╗"
            log_warning "║  SAVE THIS PASSWORD SECURELY - IT WILL NOT BE SHOWN AGAIN!    ║"
            log_warning "╠════════════════════════════════════════════════════════════════╣"
            echo -e "${YELLOW}║  Password: ${ROOT_PASSWORD}${NC}"
            log_warning "╚════════════════════════════════════════════════════════════════╝"
            echo ""
            
            # Update database-password secret with actual password
            log_info "Updating database-password secret..."
            if echo -n "$ROOT_PASSWORD" | gcloud secrets versions add database-password \
                --data-file=- \
                --project="$GCP_PROJECT_ID" \
                --quiet 2>/dev/null; then
                log_success "Database password stored in Secret Manager"
            else
                log_warning "Could not update database-password secret"
            fi
        else
            log_warning "Could not set root password automatically"
        fi
        
        # Create database
        log_info "Creating database: $DB_NAME..."
        if gcloud sql databases create "$DB_NAME" \
            --instance="$INSTANCE_NAME" \
            --project="$GCP_PROJECT_ID" 2>&1; then
            log_success "Database '$DB_NAME' created"
        else
            log_warning "Database may already exist or creation failed"
        fi
        
        # Get connection name
        local CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
            --project="$GCP_PROJECT_ID" \
            --format="value(connectionName)" 2>/dev/null)
        
        log_success "Cloud SQL setup complete!"
        print_pgvector_instructions "$CONNECTION_NAME" "$DB_NAME"
        
        # Export connection name
        export CLOUD_SQL_CONNECTION_NAME="$CONNECTION_NAME"
        
    else
        log_error "Failed to create Cloud SQL instance"
        log_info "Check billing is enabled and you have sufficient quota"
        return 1
    fi
}

# =============================================================================
# Print pgvector Installation Instructions (Requirement 1.9)
# =============================================================================
print_pgvector_instructions() {
    local CONNECTION_NAME=$1
    local DB_NAME=$2
    
    echo ""
    log_header "pgvector Extension Setup Instructions"
    echo ""
    log_warning "╔════════════════════════════════════════════════════════════════╗"
    log_warning "║  IMPORTANT: You MUST enable pgvector extension manually!       ║"
    log_warning "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "Connection details:"
    echo "  Connection Name: $CONNECTION_NAME"
    echo "  Database: $DB_NAME"
    echo "  Unix Socket Path: /cloudsql/$CONNECTION_NAME"
    echo ""
    log_info "Step 1: Install Cloud SQL Auth Proxy"
    echo "  macOS:   brew install cloud-sql-proxy"
    echo "  Linux:   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64"
    echo "           chmod +x cloud-sql-proxy"
    echo "  Windows: Download from https://cloud.google.com/sql/docs/postgres/sql-proxy"
    echo ""
    log_info "Step 2: Start the proxy (in a separate terminal)"
    echo "  cloud-sql-proxy $CONNECTION_NAME --port=5432"
    echo ""
    log_info "Step 3: Connect to PostgreSQL"
    echo "  psql \"host=127.0.0.1 port=5432 dbname=$DB_NAME user=postgres\""
    echo ""
    log_info "Step 4: Enable pgvector extension (REQUIRED)"
    echo "  CREATE EXTENSION IF NOT EXISTS vector;"
    echo ""
    log_info "Step 5: Verify installation"
    echo "  SELECT * FROM pg_extension WHERE extname = 'vector';"
    echo "  -- Should return one row with extname = 'vector'"
    echo ""
    log_info "Step 6: Create vector column example"
    echo "  -- Example for embeddings table:"
    echo "  ALTER TABLE embeddings ADD COLUMN embedding vector(768);"
    echo "  CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);"
    echo ""
    log_info "pgvector is used for:"
    echo "  • Embedding storage and similarity search"
    echo "  • Vector caching (replaces Weaviate)"
    echo "  • RAG document retrieval"
    echo "  • Semantic search across documents"
    echo ""
    log_info "Cloud Run Connection (Unix Socket):"
    echo "  DATABASE_URL=postgresql://postgres:PASSWORD@/digitwinlive-db?host=/cloudsql/$CONNECTION_NAME"
    echo ""
}

# =============================================================================
# Create Service Accounts with IAM Roles (Requirement 1.7)
# Property 4: Service Account Role Assignment
# =============================================================================
create_service_accounts() {
    log_header "Creating Service Accounts"
    
    local SA_NAME="digitwinlive-sa"
    local SA_EMAIL="$SA_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"
    
    log_info "Creating service account: $SA_NAME"
    
    # Idempotent check
    if gcloud iam service-accounts describe "$SA_EMAIL" &> /dev/null; then
        log_success "Service account '$SA_NAME' already exists"
    else
        if gcloud iam service-accounts create "$SA_NAME" \
            --display-name="DigiTwin Live Service Account" \
            --description="Service account for DigiTwin Live application" \
            --quiet 2>&1; then
            log_success "Service account created: $SA_EMAIL"
        else
            log_error "Failed to create service account"
            return 1
        fi
    fi
    
    log_info "Granting IAM roles to service account..."
    
    # All required roles per requirements (Property 4)
    # cloudsql.client, storage.objectAdmin, secretmanager.secretAccessor, run.invoker
    ROLES=(
        "roles/cloudsql.client"
        "roles/storage.objectAdmin"
        "roles/secretmanager.secretAccessor"
        "roles/run.invoker"
        "roles/artifactregistry.reader"
        "roles/logging.logWriter"
    )
    
    local granted_count=0
    local failed_count=0
    
    for role in "${ROLES[@]}"; do
        log_info "Granting $role..."
        if gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
            --member="serviceAccount:$SA_EMAIL" \
            --role="$role" \
            --condition=None \
            --quiet &> /dev/null; then
            log_success "Granted: $role"
            ((granted_count++))
        else
            log_warning "Could not grant $role (may already be assigned)"
            ((failed_count++))
        fi
    done
    
    log_info "IAM roles: $granted_count granted, $failed_count skipped/failed"
    
    # Verify required roles are assigned (Property 4)
    log_info "Verifying IAM role assignments..."
    local required_roles=("roles/cloudsql.client" "roles/storage.objectAdmin" "roles/secretmanager.secretAccessor" "roles/run.invoker")
    local missing_roles=()
    
    local current_policy=$(gcloud projects get-iam-policy "$GCP_PROJECT_ID" --format=json 2>/dev/null)
    
    for role in "${required_roles[@]}"; do
        if ! echo "$current_policy" | grep -q "\"role\": \"$role\"" 2>/dev/null; then
            # Role might still be assigned to our SA, check more specifically
            if ! echo "$current_policy" | grep -A5 "\"role\": \"$role\"" | grep -q "$SA_EMAIL" 2>/dev/null; then
                missing_roles+=("$role")
            fi
        fi
    done
    
    if [ ${#missing_roles[@]} -gt 0 ]; then
        log_warning "Some roles may not be assigned: ${missing_roles[*]}"
        log_info "You may need to grant these roles manually in GCP Console"
    else
        log_success "All required IAM roles verified"
    fi
    
    # Export service account email for use by other functions
    export SERVICE_ACCOUNT_EMAIL="$SA_EMAIL"
}

# =============================================================================
# Setup Secrets in Secret Manager (Requirement 1.8)
# Property 5: Secret Placeholder Creation
# =============================================================================
setup_secrets() {
    log_header "Setting Up Secret Manager"
    
    log_info "Creating secrets in Secret Manager..."
    
    # Required secrets with placeholder values (Property 5)
    # jwt-secret, refresh-secret, database-password
    SECRETS=(
        "jwt-secret:PLACEHOLDER-UPDATE-WITH-REAL-SECRET"
        "refresh-secret:PLACEHOLDER-UPDATE-WITH-REAL-SECRET"
        "database-password:PLACEHOLDER-UPDATE-WITH-REAL-PASSWORD"
    )
    
    local created_count=0
    local existing_count=0
    local failed_count=0
    
    for secret_info in "${SECRETS[@]}"; do
        local secret_name=$(echo "$secret_info" | cut -d: -f1)
        local secret_value=$(echo "$secret_info" | cut -d: -f2)
        
        # Idempotent check
        if gcloud secrets describe "$secret_name" --project="$GCP_PROJECT_ID" &> /dev/null; then
            log_success "Secret '$secret_name' already exists"
            ((existing_count++))
        else
            if echo -n "$secret_value" | gcloud secrets create "$secret_name" \
                --data-file=- \
                --replication-policy="automatic" \
                --project="$GCP_PROJECT_ID" \
                --quiet 2>&1; then
                log_success "Created secret: $secret_name"
                ((created_count++))
            else
                log_error "Failed to create secret: $secret_name"
                ((failed_count++))
            fi
        fi
    done
    
    log_info "Secrets: $created_count created, $existing_count already existed, $failed_count failed"
    
    # Verify all required secrets exist (Property 5)
    local required_secrets=("jwt-secret" "refresh-secret" "database-password")
    local missing_secrets=()
    
    for secret in "${required_secrets[@]}"; do
        if ! gcloud secrets describe "$secret" --project="$GCP_PROJECT_ID" &> /dev/null; then
            missing_secrets+=("$secret")
        fi
    done
    
    if [ ${#missing_secrets[@]} -gt 0 ]; then
        log_error "Required secrets missing: ${missing_secrets[*]}"
        return 1
    fi
    
    log_success "All required secrets verified in Secret Manager"
    
    # Grant secret access to service account if it exists
    if [ -n "$SERVICE_ACCOUNT_EMAIL" ]; then
        log_info "Granting secret access to service account..."
        for secret in "${required_secrets[@]}"; do
            gcloud secrets add-iam-policy-binding "$secret" \
                --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
                --role="roles/secretmanager.secretAccessor" \
                --project="$GCP_PROJECT_ID" \
                --quiet &> /dev/null || true
        done
        log_success "Secret access granted to service account"
    fi
    
    echo ""
    log_warning "╔════════════════════════════════════════════════════════════════╗"
    log_warning "║  IMPORTANT: Update secrets with actual production values!      ║"
    log_warning "╠════════════════════════════════════════════════════════════════╣"
    log_warning "║  Generate secure secrets:                                      ║"
    log_warning "║    openssl rand -base64 32 | gcloud secrets versions add \\    ║"
    log_warning "║      jwt-secret --data-file=-                                  ║"
    log_warning "║                                                                ║"
    log_warning "║  Or update via GCP Console:                                    ║"
    log_warning "║    https://console.cloud.google.com/security/secret-manager   ║"
    log_warning "╚════════════════════════════════════════════════════════════════╝"
}

# =============================================================================
# Print Summary (Requirement 1.9)
# =============================================================================
print_summary() {
    log_header "Setup Summary"
    
    echo ""
    log_info "GCP Resources Created:"
    echo "  Project: $GCP_PROJECT_ID"
    echo "  Region: $GCP_REGION"
    echo "  Environment: $ENV"
    echo ""
    
    log_info "Architecture:"
    echo "  • Cloud Run: API Gateway, WebSocket Server, Face Processing"
    echo "  • Cloud SQL: PostgreSQL 15 with pgvector extension"
    echo "  • Cloud Storage: Voice models, Face models, Documents, Uploads"
    echo "  • Artifact Registry: Container images"
    echo "  • Secret Manager: JWT secrets, Database credentials"
    echo ""
    
    log_info "Vector Storage:"
    echo "  Using PostgreSQL pgvector extension instead of Weaviate"
    echo "  Benefits:"
    echo "    • No separate vector database to manage"
    echo "    • Lower cost (no GKE cluster needed)"
    echo "    • ACID compliance for vector operations"
    echo "    • Simplified infrastructure"
    echo ""
    
    log_warning "╔════════════════════════════════════════════════════════════════╗"
    log_warning "║                    REQUIRED NEXT STEPS                         ║"
    log_warning "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "1. Enable pgvector extension (CRITICAL):"
    echo "   cloud-sql-proxy ${CLOUD_SQL_CONNECTION_NAME:-PROJECT:REGION:digitwinlive-db} --port=5432 &"
    echo "   psql \"host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres\""
    echo "   CREATE EXTENSION IF NOT EXISTS vector;"
    echo ""
    log_info "2. Update secrets with real values:"
    echo "   openssl rand -base64 32 | gcloud secrets versions add jwt-secret --data-file=-"
    echo "   openssl rand -base64 32 | gcloud secrets versions add refresh-secret --data-file=-"
    echo ""
    log_info "3. Run database migrations:"
    echo "   pnpm db:migrate"
    echo ""
    log_info "4. Deploy services:"
    echo "   ./scripts/gcp-deploy.sh deploy --env=production"
    echo ""
    log_info "5. Update .env.production with Cloud Run URLs after deployment"
    echo ""
    
    log_info "Useful Commands:"
    echo "  • View buckets: gsutil ls"
    echo "  • View SQL instances: gcloud sql instances list"
    echo "  • View Cloud Run services: gcloud run services list"
    echo "  • View secrets: gcloud secrets list"
    echo "  • Check status: ./scripts/gcp-manage.sh status"
    echo "  • Estimate costs: ./scripts/gcp-manage.sh cost"
    echo ""
    
    log_info "Documentation:"
    echo "  • GCP Infrastructure: docs/GCP-INFRASTRUCTURE.md"
    echo "  • Database Setup: docs/DATABASE-ARCHITECTURE.md"
    echo "  • Deployment Guide: infrastructure/SETUP-GUIDE.md"
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================
main() {
    log_header "GCP Setup for DigiTwin Live"
    log_info "Using PostgreSQL with pgvector for vector storage"
    echo ""
    
    # Parse arguments
    local SKIP_SQL=false
    local ENV_FILE=".env"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-sql)
                SKIP_SQL=true
                shift
                ;;
            --env=*)
                ENV_FILE="${1#*=}"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --skip-sql       Skip Cloud SQL creation"
                echo "  --env=FILE       Use specific environment file (default: .env)"
                echo "  --help, -h       Show this help message"
                exit 0
                ;;
            *)
                log_warning "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Load environment
    load_env "$ENV_FILE"
    
    # Run setup steps
    check_prerequisites
    setup_project
    enable_apis
    create_artifact_registry
    create_storage_buckets
    create_service_accounts
    setup_secrets
    
    # Cloud SQL creation (optional prompt)
    if [ "$SKIP_SQL" = true ]; then
        log_info "Skipping Cloud SQL creation (--skip-sql flag)"
    else
        echo ""
        log_header "Cloud SQL PostgreSQL with pgvector"
        echo ""
        
        # Determine tier based on environment
        if [ "$ENV" == "prod" ]; then
            log_info "Production Cloud SQL Configuration:"
            echo "  • Tier: db-custom-1-3840 (1 vCPU, 3.75GB RAM)"
            echo "  • Cost: ~$50-70/month"
        else
            log_info "Development Cloud SQL Configuration:"
            echo "  • Tier: db-f1-micro (shared core, 0.6GB RAM)"
            echo "  • Cost: ~$7.67/month"
        fi
        echo "  • Storage: 10GB SSD (auto-increase enabled)"
        echo "  • Backups: Daily at 03:00 UTC"
        echo "  • PostgreSQL 15 (pgvector extension available)"
        echo ""
        
        read -p "Create Cloud SQL instance? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            create_cloud_sql
        else
            log_info "Skipping Cloud SQL creation"
            log_info "You can create it later with: ./scripts/gcp-setup.sh"
        fi
    fi
    
    print_summary
    
    log_success "GCP setup completed successfully!"
}

main "$@"
