#!/bin/bash

# GCP Setup Script
# Creates all required GCP resources for DigitWin Live
# Uses PostgreSQL with pgvector for vector storage (no GKE/Weaviate needed)

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

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not installed"
        log_info "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    log_success "gcloud CLI installed"
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        log_error "Not authenticated with gcloud"
        log_info "Run: gcloud auth login"
        exit 1
    fi
    log_success "Authenticated with gcloud"
}

# Set GCP project
setup_project() {
    log_header "Setting Up GCP Project"
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env"
        exit 1
    fi
    
    gcloud config set project "$GCP_PROJECT_ID"
    log_success "Project set to: $GCP_PROJECT_ID"
    
    # Set region
    GCP_REGION=${GCP_REGION:-us-central1}
    gcloud config set compute/region "$GCP_REGION"
    log_success "Region set to: $GCP_REGION"
}

# Enable required APIs
enable_apis() {
    log_header "Enabling Required APIs"
    
    APIS=(
        "compute.googleapis.com"
        "sqladmin.googleapis.com"
        "storage-api.googleapis.com"
        "storage-component.googleapis.com"
        "run.googleapis.com"
        "secretmanager.googleapis.com"
        "cloudresourcemanager.googleapis.com"
        "iam.googleapis.com"
        "servicenetworking.googleapis.com"
        "artifactregistry.googleapis.com"
        "cloudbuild.googleapis.com"
    )
    
    for api in "${APIS[@]}"; do
        log_info "Enabling $api..."
        
        if gcloud services list --enabled --filter="name:$api" 2>/dev/null | grep -q "$api"; then
            log_success "$api already enabled"
        else
            if gcloud services enable "$api" 2>&1; then
                log_success "$api enabled"
            else
                log_warning "Could not enable $api (may need billing or permissions)"
            fi
        fi
    done
}

# Create Artifact Registry repository
create_artifact_registry() {
    log_header "Creating Artifact Registry Repository"
    
    REPO_NAME="digitwinlive"
    REPO_LOCATION="$GCP_REGION"
    
    log_info "Checking if Artifact Registry repository exists..."
    
    if gcloud artifacts repositories describe "$REPO_NAME" --location="$REPO_LOCATION" &> /dev/null; then
        log_success "Artifact Registry repository $REPO_NAME already exists"
    else
        log_info "Creating Artifact Registry repository: $REPO_NAME"
        
        if gcloud artifacts repositories create "$REPO_NAME" \
            --repository-format=docker \
            --location="$REPO_LOCATION" \
            --description="DigitWin Live container images" 2>&1; then
            log_success "Artifact Registry repository created: $REPO_NAME"
        else
            log_error "Failed to create Artifact Registry repository"
            return 1
        fi
    fi
    
    # Configure Docker authentication
    log_info "Configuring Docker authentication for Artifact Registry..."
    gcloud auth configure-docker "$REPO_LOCATION-docker.pkg.dev" --quiet 2>/dev/null || true
    log_success "Docker authentication configured"
}

# Create Cloud Storage buckets
create_storage_buckets() {
    log_header "Creating Cloud Storage Buckets"
    
    # Determine environment from GCS bucket names or default to dev
    ENV="dev"
    if [[ "$GCS_BUCKET_VOICE_MODELS" == *"-prod" ]]; then
        ENV="prod"
    fi
    
    BUCKETS=(
        "$GCS_BUCKET_VOICE_MODELS:Voice models storage"
        "$GCS_BUCKET_FACE_MODELS:Face models storage"
        "$GCS_BUCKET_DOCUMENTS:Documents storage"
        "$GCS_BUCKET_UPLOADS:User uploads storage"
        "digitwinlive-terraform-state-${ENV}:Terraform state storage"
    )
    
    for bucket_info in "${BUCKETS[@]}"; do
        bucket=$(echo "$bucket_info" | cut -d: -f1)
        description=$(echo "$bucket_info" | cut -d: -f2)
        
        if [ -z "$bucket" ]; then
            log_warning "Bucket name not set, skipping"
            continue
        fi
        
        log_info "Creating bucket: $bucket ($description)"
        
        if gsutil ls "gs://$bucket" &> /dev/null; then
            log_success "Bucket $bucket already exists"
        else
            if gsutil mb -p "$GCP_PROJECT_ID" -l "$GCP_REGION" "gs://$bucket"; then
                log_success "Created bucket: $bucket"
                
                # Special handling for Terraform state bucket
                if [[ "$bucket" == *"terraform-state"* ]]; then
                    log_info "Configuring Terraform state bucket..."
                    
                    # Enable versioning (critical for state files)
                    gsutil versioning set on "gs://$bucket"
                    log_success "Versioning enabled"
                    
                    # Set lifecycle policy to keep old versions for 30 days
                    cat > /tmp/tf-lifecycle.json << EOF
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
                    gsutil lifecycle set /tmp/tf-lifecycle.json "gs://$bucket" 2>/dev/null || true
                    rm /tmp/tf-lifecycle.json
                    log_success "Lifecycle policy set (keeps 3 versions, 30 days)"
                else
                    # Regular lifecycle policy for other buckets
                    cat > /tmp/lifecycle.json << EOF
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
                    gsutil lifecycle set /tmp/lifecycle.json "gs://$bucket" 2>/dev/null || true
                    rm /tmp/lifecycle.json
                fi
            else
                log_error "Failed to create bucket: $bucket"
            fi
        fi
    done
}

# Create Cloud SQL instance with pgvector
create_cloud_sql() {
    log_header "Creating Cloud SQL Instance with pgvector"
    
    INSTANCE_NAME="digitwinlive-db"
    DB_NAME="digitwinlive_prod"
    
    log_info "Checking if Cloud SQL instance exists..."
    
    if gcloud sql instances describe "$INSTANCE_NAME" --project="$GCP_PROJECT_ID" &> /dev/null; then
        log_success "Cloud SQL instance $INSTANCE_NAME already exists"
        
        INSTANCE_STATE=$(gcloud sql instances describe "$INSTANCE_NAME" --project="$GCP_PROJECT_ID" --format="value(state)" 2>/dev/null)
        log_info "Instance state: $INSTANCE_STATE"
    else
        log_info "Creating Cloud SQL instance: $INSTANCE_NAME"
        log_warning "This will take 5-10 minutes..."
        log_info "Instance type: db-f1-micro (shared core, 0.6GB RAM)"
        log_info "PostgreSQL 15 (pgvector extension available)"
        log_info "Cost: ~$7.67/month"
        log_info "Project: $GCP_PROJECT_ID"
        log_info "Region: $GCP_REGION"
        echo ""
        
        # Create instance - PostgreSQL 15 supports pgvector
        # Note: pgvector is enabled by default in PostgreSQL 15, no flag needed
        if gcloud sql instances create "$INSTANCE_NAME" \
            --project="$GCP_PROJECT_ID" \
            --database-version=POSTGRES_15 \
            --tier=db-f1-micro \
            --region="$GCP_REGION" \
            --storage-type=SSD \
            --storage-size=10GB \
            --storage-auto-increase \
            --backup-start-time=03:00 \
            --maintenance-window-day=SUN \
            --maintenance-window-hour=4 \
            --database-flags=max_connections=100 \
            --availability-type=zonal 2>&1; then
            
            log_success "Cloud SQL instance created successfully!"
            
            log_info "Waiting for instance to be ready..."
            sleep 15
            
            # Set root password
            log_info "Setting root password..."
            ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
            gcloud sql users set-password postgres \
                --instance="$INSTANCE_NAME" \
                --project="$GCP_PROJECT_ID" \
                --password="$ROOT_PASSWORD" 2>/dev/null || true
            
            log_success "Root password set"
            log_warning "Save this password securely:"
            echo "  Password: $ROOT_PASSWORD"
            echo ""
            
            # Create database
            log_info "Creating database: $DB_NAME..."
            if gcloud sql databases create "$DB_NAME" \
                --instance="$INSTANCE_NAME" \
                --project="$GCP_PROJECT_ID" 2>&1; then
                log_success "Database $DB_NAME created"
            else
                log_warning "Database may already exist"
            fi
            
            # Get connection name
            CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
                --project="$GCP_PROJECT_ID" \
                --format="value(connectionName)" 2>/dev/null)
            
            log_success "Cloud SQL setup complete!"
            echo ""
            log_info "Connection details:"
            echo "  Instance: $INSTANCE_NAME"
            echo "  Database: $DB_NAME"
            echo "  Connection: $CONNECTION_NAME"
            echo "  Region: $GCP_REGION"
            echo ""
            log_info "To connect and enable pgvector:"
            echo "  1. Install Cloud SQL Proxy:"
            echo "     https://cloud.google.com/sql/docs/postgres/sql-proxy"
            echo ""
            echo "  2. Start proxy:"
            echo "     cloud-sql-proxy $CONNECTION_NAME --port=5432"
            echo ""
            echo "  3. Connect and enable pgvector:"
            echo "     psql \"host=127.0.0.1 port=5432 dbname=$DB_NAME user=postgres\""
            echo "     CREATE EXTENSION IF NOT EXISTS vector;"
            echo ""
            log_info "pgvector is used for:"
            echo "  - Embedding storage and similarity search"
            echo "  - Vector caching (replaces Weaviate)"
            echo "  - RAG document retrieval"
            echo ""
        else
            log_error "Failed to create Cloud SQL instance"
            log_info "Check billing is enabled and you have sufficient quota"
            return 1
        fi
    fi
}

# Create service accounts
create_service_accounts() {
    log_header "Creating Service Accounts"
    
    SA_NAME="digitwinlive-sa"
    SA_EMAIL="$SA_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"
    
    log_info "Creating service account: $SA_NAME"
    
    if gcloud iam service-accounts describe "$SA_EMAIL" &> /dev/null; then
        log_success "Service account already exists"
    else
        gcloud iam service-accounts create "$SA_NAME" \
            --display-name="DigitWin Live Service Account"
        
        log_success "Service account created"
    fi
    
    log_info "Granting roles to service account..."
    
    ROLES=(
        "roles/cloudsql.client"
        "roles/storage.objectAdmin"
        "roles/secretmanager.secretAccessor"
        "roles/run.invoker"
    )
    
    for role in "${ROLES[@]}"; do
        gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
            --member="serviceAccount:$SA_EMAIL" \
            --role="$role" \
            --condition=None \
            &> /dev/null || true
    done
    
    log_success "Roles granted"
    
    KEY_FILE="secrets/gcp-service-account-prod.json"
    
    if [ -f "$KEY_FILE" ]; then
        log_success "Service account key already exists"
    else
        mkdir -p secrets
        
        log_info "Creating service account key..."
        if gcloud iam service-accounts keys create "$KEY_FILE" \
            --iam-account="$SA_EMAIL" 2>&1; then
            log_success "Service account key created: $KEY_FILE"
            log_warning "Keep this file secure and never commit to git!"
        else
            log_warning "Could not create service account key"
            log_info "You can create keys manually in GCP Console"
        fi
    fi
}

# Setup secrets in Secret Manager
setup_secrets() {
    log_header "Setting Up Secret Manager"
    
    log_info "Creating secrets in Secret Manager..."
    
    SECRETS=(
        "jwt-secret:your-jwt-secret-here"
        "refresh-secret:your-refresh-secret-here"
        "database-password:your-db-password-here"
    )
    
    for secret_info in "${SECRETS[@]}"; do
        secret_name=$(echo "$secret_info" | cut -d: -f1)
        secret_value=$(echo "$secret_info" | cut -d: -f2)
        
        if gcloud secrets describe "$secret_name" &> /dev/null; then
            log_success "Secret $secret_name already exists"
        else
            echo -n "$secret_value" | gcloud secrets create "$secret_name" \
                --data-file=- \
                --replication-policy="automatic"
            
            log_success "Created secret: $secret_name"
        fi
    done
    
    log_warning "Remember to update secret values with actual production secrets!"
}

# Print summary
print_summary() {
    log_header "Setup Summary"
    
    echo ""
    log_info "GCP Resources Created:"
    echo "  Project: $GCP_PROJECT_ID"
    echo "  Region: $GCP_REGION"
    echo ""
    
    log_info "Architecture:"
    echo "  - Cloud Run: API Gateway, WebSocket Server, Face Processing"
    echo "  - Cloud SQL: PostgreSQL 15 with pgvector extension"
    echo "  - Cloud Storage: Voice models, Face models, Documents, Uploads, Terraform state"
    echo "  - Secret Manager: JWT secrets, Database credentials"
    echo ""
    
    log_info "Vector Storage:"
    echo "  Using PostgreSQL pgvector extension instead of Weaviate"
    echo "  Benefits:"
    echo "    - No separate vector database to manage"
    echo "    - Lower cost (no GKE cluster needed)"
    echo "    - ACID compliance for vector operations"
    echo "    - Simplified infrastructure"
    echo ""
    
    log_info "Next Steps:"
    echo "  1. Update .env with production values"
    echo "  2. Connect to Cloud SQL and run: CREATE EXTENSION vector;"
    echo "  3. Run Prisma migrations: pnpm db:migrate"
    echo "  4. Deploy with Terraform: cd infrastructure/terraform && terraform init -backend-config=backend-dev.hcl"
    echo "  5. Or deploy services directly: pnpm gcp:deploy"
    echo ""
    
    log_info "Terraform Backend:"
    echo "  - State bucket created: digitwinlive-terraform-state-${ENV}"
    echo "  - Versioning enabled (keeps 3 versions, 30 days)"
    echo "  - Initialize: terraform init -backend-config=backend-dev.hcl"
    echo ""
    
    log_info "Useful Commands:"
    echo "  - View buckets: gsutil ls"
    echo "  - View SQL instances: gcloud sql instances list"
    echo "  - View Cloud Run services: gcloud run services list"
    echo "  - View secrets: gcloud secrets list"
    echo "  - Test monitoring: pnpm test:monitoring"
}

# Main execution
main() {
    log_header "GCP Setup for DigitWin Live"
    log_info "Using PostgreSQL with pgvector for vector storage"
    
    load_env
    check_prerequisites
    setup_project
    enable_apis
    create_artifact_registry
    create_storage_buckets
    create_service_accounts
    setup_secrets
    
    echo ""
    log_header "Cloud SQL PostgreSQL with pgvector"
    echo ""
    log_info "Cloud SQL PostgreSQL 15 with pgvector:"
    echo "  - Cost: ~$7.67/month (db-f1-micro)"
    echo "  - Storage: 10GB SSD (auto-increase enabled)"
    echo "  - Backups: Daily at 3:00 AM"
    echo "  - pgvector: Available (enable after creation with CREATE EXTENSION)"
    echo "  - Use for: Database + Vector storage (replaces Weaviate)"
    echo ""
    
    read -p "Create Cloud SQL instance? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_cloud_sql
    else
        log_info "Skipping Cloud SQL creation"
        log_info "You can create it later with: ./scripts/gcp-setup.sh"
    fi
    
    print_summary
    
    log_success "GCP setup completed!"
}

main "$@"
