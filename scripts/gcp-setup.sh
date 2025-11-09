#!/bin/bash

# GCP Setup Script
# Creates all required GCP resources for DigitWin Live

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
        "container.googleapis.com"
        "sqladmin.googleapis.com"
        "storage-api.googleapis.com"
        "storage-component.googleapis.com"
        "run.googleapis.com"
        "secretmanager.googleapis.com"
        "cloudresourcemanager.googleapis.com"
        "iam.googleapis.com"
        "servicenetworking.googleapis.com"
    )
    
    for api in "${APIS[@]}"; do
        log_info "Enabling $api..."
        
        # Check if already enabled
        if gcloud services list --enabled --filter="name:$api" 2>/dev/null | grep -q "$api"; then
            log_success "$api already enabled"
        else
            # Try to enable
            if gcloud services enable "$api" 2>&1; then
                log_success "$api enabled"
            else
                log_warning "Could not enable $api (may need billing or permissions)"
            fi
        fi
    done
}

# Create Cloud Storage buckets
create_storage_buckets() {
    log_header "Creating Cloud Storage Buckets"
    
    BUCKETS=(
        "$GCS_BUCKET_VOICE_MODELS:Voice models storage"
        "$GCS_BUCKET_FACE_MODELS:Face models storage"
        "$GCS_BUCKET_DOCUMENTS:Documents storage"
        "$GCS_BUCKET_UPLOADS:User uploads storage"
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
                
                # Set lifecycle policy (optional)
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
            else
                log_error "Failed to create bucket: $bucket"
            fi
        fi
    done
}

# Create Cloud SQL instance
create_cloud_sql() {
    log_header "Creating Cloud SQL Instance"
    
    INSTANCE_NAME="digitwinlive-db"
    DB_NAME="digitwinline_prod"
    
    log_info "Checking if Cloud SQL instance exists..."
    
    if gcloud sql instances describe "$INSTANCE_NAME" &> /dev/null; then
        log_success "Cloud SQL instance $INSTANCE_NAME already exists"
        
        # Check instance state
        INSTANCE_STATE=$(gcloud sql instances describe "$INSTANCE_NAME" --format="value(state)" 2>/dev/null)
        log_info "Instance state: $INSTANCE_STATE"
    else
        log_info "Creating Cloud SQL instance: $INSTANCE_NAME"
        log_warning "This will take 5-10 minutes..."
        log_info "Instance type: db-f1-micro (shared core, 0.6GB RAM)"
        log_info "Cost: ~$7.67/month"
        echo ""
        
        # Create instance with better configuration
        if gcloud sql instances create "$INSTANCE_NAME" \
            --database-version=POSTGRES_17 \
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
            
            # Wait for instance to be ready
            log_info "Waiting for instance to be ready..."
            sleep 10
            
            # Set root password
            log_info "Setting root password..."
            ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
            gcloud sql users set-password postgres \
                --instance="$INSTANCE_NAME" \
                --password="$ROOT_PASSWORD" 2>/dev/null || true
            
            log_success "Root password set"
            log_warning "Save this password securely:"
            echo "  Password: $ROOT_PASSWORD"
            echo ""
            
            # Create database
            log_info "Creating database: $DB_NAME..."
            if gcloud sql databases create "$DB_NAME" \
                --instance="$INSTANCE_NAME" 2>&1; then
                log_success "Database $DB_NAME created"
            else
                log_warning "Database may already exist"
            fi
            
            # Get connection name
            CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
                --format="value(connectionName)" 2>/dev/null)
            
            log_success "Cloud SQL setup complete!"
            echo ""
            log_info "Connection details:"
            echo "  Instance: $INSTANCE_NAME"
            echo "  Database: $DB_NAME"
            echo "  Connection: $CONNECTION_NAME"
            echo "  Region: $GCP_REGION"
            echo ""
            log_info "To connect:"
            echo "  1. Install Cloud SQL Proxy:"
            echo "     https://cloud.google.com/sql/docs/postgres/sql-proxy"
            echo ""
            echo "  2. Start proxy:"
            echo "     cloud_sql_proxy -instances=$CONNECTION_NAME=tcp:5432"
            echo ""
            echo "  3. Connect:"
            echo "     psql \"host=127.0.0.1 port=5432 dbname=$DB_NAME user=postgres\""
            echo ""
            log_info "To install pgvector extension:"
            echo "  psql -h 127.0.0.1 -U postgres -d $DB_NAME -c \"CREATE EXTENSION IF NOT EXISTS vector;\""
            echo ""
        else
            log_error "Failed to create Cloud SQL instance"
            log_info "Check billing is enabled and you have sufficient quota"
            return 1
        fi
    fi
}

# Create GKE cluster for Weaviate
create_gke_cluster() {
    log_header "Creating GKE Cluster"
    
    if [ "$WEAVIATE_ENABLED" != "true" ]; then
        log_info "Weaviate not enabled, skipping GKE cluster creation"
        return 0
    fi
    
    CLUSTER_NAME="digitwinlive-cluster"
    
    log_info "Checking if GKE cluster exists..."
    
    if gcloud container clusters describe "$CLUSTER_NAME" --region="$GCP_REGION" &> /dev/null; then
        log_success "GKE cluster $CLUSTER_NAME already exists"
    else
        log_info "Creating GKE cluster: $CLUSTER_NAME"
        log_warning "This may take 5-10 minutes..."
        
        gcloud container clusters create "$CLUSTER_NAME" \
            --region="$GCP_REGION" \
            --num-nodes=1 \
            --machine-type=e2-medium \
            --enable-autoscaling \
            --min-nodes=1 \
            --max-nodes=3 \
            --enable-autorepair \
            --enable-autoupgrade
        
        log_success "GKE cluster created"
        
        # Get credentials
        gcloud container clusters get-credentials "$CLUSTER_NAME" --region="$GCP_REGION"
        log_success "kubectl configured"
    fi
}

# Deploy Weaviate to GKE
deploy_weaviate() {
    log_header "Deploying Weaviate to GKE"
    
    if [ "$WEAVIATE_ENABLED" != "true" ]; then
        log_info "Weaviate not enabled, skipping deployment"
        return 0
    fi
    
    if ! command -v kubectl &> /dev/null; then
        log_warning "kubectl not installed, skipping Weaviate deployment"
        return 0
    fi
    
    log_info "Creating Weaviate deployment..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: weaviate
spec:
  replicas: 1
  selector:
    matchLabels:
      app: weaviate
  template:
    metadata:
      labels:
        app: weaviate
    spec:
      containers:
      - name: weaviate
        image: semitechnologies/weaviate:latest
        ports:
        - containerPort: 8080
        env:
        - name: QUERY_DEFAULTS_LIMIT
          value: "25"
        - name: AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED
          value: "true"
        - name: PERSISTENCE_DATA_PATH
          value: "/var/lib/weaviate"
        volumeMounts:
        - name: weaviate-data
          mountPath: /var/lib/weaviate
      volumes:
      - name: weaviate-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: weaviate
spec:
  type: LoadBalancer
  ports:
  - port: 8080
    targetPort: 8080
  selector:
    app: weaviate
EOF
    
    log_success "Weaviate deployed to GKE"
    
    log_info "Waiting for LoadBalancer IP..."
    sleep 10
    
    EXTERNAL_IP=$(kubectl get service weaviate -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    
    if [ "$EXTERNAL_IP" != "pending" ] && [ -n "$EXTERNAL_IP" ]; then
        log_success "Weaviate accessible at: http://$EXTERNAL_IP:8080"
        log_info "Update WEAVIATE_URL in .env to: http://$EXTERNAL_IP:8080"
    else
        log_info "LoadBalancer IP pending. Check with: kubectl get service weaviate"
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
    
    # Grant roles
    log_info "Granting roles to service account..."
    
    ROLES=(
        "roles/cloudsql.client"
        "roles/storage.objectAdmin"
        "roles/secretmanager.secretAccessor"
        "roles/container.developer"
    )
    
    for role in "${ROLES[@]}"; do
        gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
            --member="serviceAccount:$SA_EMAIL" \
            --role="$role" \
            --condition=None \
            &> /dev/null || true
    done
    
    log_success "Roles granted"
    
    # Create key
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
            log_info "This may be blocked by organization policy"
            log_info "You can create keys manually in GCP Console:"
            log_info "  https://console.cloud.google.com/iam-admin/serviceaccounts"
        fi
    fi
}

# Setup secrets in Secret Manager
setup_secrets() {
    log_header "Setting Up Secret Manager"
    
    log_info "Creating secrets in Secret Manager..."
    
    # Example secrets (you should set actual values)
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
    
    log_info "Storage Buckets:"
    for bucket_info in "${BUCKETS[@]}"; do
        bucket=$(echo "$bucket_info" | cut -d: -f1)
        [ -n "$bucket" ] && echo "  - gs://$bucket"
    done
    echo ""
    
    log_info "Next Steps:"
    echo "  1. Update .env with production values"
    echo "  2. Configure Cloud SQL connection"
    echo "  3. Deploy applications to Cloud Run"
    echo "  4. Run: pnpm test:gcp"
    echo ""
    
    log_info "Useful Commands:"
    echo "  - View buckets: gsutil ls"
    echo "  - View SQL instances: gcloud sql instances list"
    echo "  - View GKE clusters: gcloud container clusters list"
    echo "  - View secrets: gcloud secrets list"
}

# Main execution
main() {
    log_header "GCP Setup for DigitWin Live"
    
    load_env
    check_prerequisites
    setup_project
    enable_apis
    create_storage_buckets
    create_service_accounts
    setup_secrets
    
    # Optional: Create Cloud SQL and GKE
    echo ""
    log_header "Optional Resources"
    echo ""
    log_info "Cloud SQL PostgreSQL (db-f1-micro):"
    echo "  - Cost: ~$7.67/month"
    echo "  - Storage: 10GB SSD (auto-increase enabled)"
    echo "  - Backups: Daily at 3:00 AM"
    echo "  - Use for: Production database"
    echo ""
    
    read -p "Create Cloud SQL instance? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_cloud_sql
    else
        log_info "Skipping Cloud SQL creation"
        log_info "You can create it later with: ./scripts/gcp-setup.sh"
    fi
    
    echo ""
    log_info "GKE Cluster (1 x e2-medium node):"
    echo "  - Cost: ~$24/month"
    echo "  - Use for: Weaviate vector database"
    echo "  - Alternative: Use local Weaviate (free)"
    echo ""
    
    read -p "Create GKE cluster for Weaviate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_gke_cluster
        deploy_weaviate
    else
        log_info "Skipping GKE creation"
        log_info "Use local Weaviate with Docker instead (free)"
    fi
    
    print_summary
    
    log_success "GCP setup completed!"
}

main "$@"