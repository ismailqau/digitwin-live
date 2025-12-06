# Design Document

## Overview

The GCP Infrastructure Management system provides a set of bash scripts for managing Google Cloud Platform resources for the DigiTwin Live application. The system uses PostgreSQL with pgvector extension for vector storage, eliminating the need for separate vector database services like Weaviate. All infrastructure management is done through simple bash scripts using the gcloud CLI, without requiring Terraform or other infrastructure-as-code tools.

### Key Design Principles

1. **Simplicity**: Use bash scripts and gcloud CLI only - no Terraform, no complex tooling
2. **PostgreSQL-First**: Use PostgreSQL with pgvector for all data storage including vectors
3. **Environment Separation**: Clear separation between development (localhost) and production (Cloud Run)
4. **Safety**: Interactive confirmations for destructive operations
5. **Idempotency**: Scripts can be run multiple times safely
6. **Clear Feedback**: Verbose logging with color-coded output

## Architecture

### Script Organization

```
scripts/
├── gcp-setup.sh           # Initial infrastructure setup
├── gcp-manage.sh          # Resource management (start/stop/status)
├── gcp-deploy.sh          # Service deployment to Cloud Run
├── gcp-cleanup.sh         # Resource deletion
└── gcp-create-sql.sh      # Quick Cloud SQL creation
```

### GCP Resources

```
┌─────────────────────────────────────────────────────────────┐
│                     GCP Project                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Cloud Run Services                                 │    │
│  │  ├── api-gateway (port 8080)                       │    │
│  │  ├── websocket-server (port 8080)                  │    │
│  │  └── face-processing-service (port 8080)           │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Cloud SQL PostgreSQL 15                           │    │
│  │  ├── Database: digitwinlive-db                     │    │
│  │  ├── Extension: pgvector                           │    │
│  │  ├── Tables: application data + cache tables       │    │
│  │  └── Connection: Unix socket from Cloud Run        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Cloud Storage Buckets                             │    │
│  │  ├── clone-voice-models-{env}                      │    │
│  │  ├── clone-face-models-{env}                       │    │
│  │  ├── clone-documents-{env}                         │    │
│  │  └── clone-uploads-{env}                           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Artifact Registry                                  │    │
│  │  └── digitwinlive (Docker images)                  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Secret Manager                                     │    │
│  │  ├── jwt-secret                                     │    │
│  │  ├── refresh-secret                                 │    │
│  │  └── database-password                              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Setup Script (gcp-setup.sh)

**Purpose**: Create all required GCP infrastructure from scratch

**Functions**:

- `check_prerequisites()`: Verify gcloud CLI and authentication
- `setup_project()`: Configure GCP project and region
- `enable_apis()`: Enable required GCP APIs
- `create_artifact_registry()`: Create container image repository
- `create_storage_buckets()`: Create GCS buckets with lifecycle policies
- `create_cloud_sql()`: Create PostgreSQL instance with pgvector support
- `create_service_accounts()`: Create service accounts with IAM roles
- `setup_secrets()`: Create placeholder secrets in Secret Manager
- `print_summary()`: Display setup summary and next steps

**Exit Codes**:

- 0: Success
- 1: Prerequisites not met or configuration error
- 2: Resource creation failed

### 2. Management Script (gcp-manage.sh)

**Purpose**: Manage existing GCP resources

**Commands**:

- `status`: Show status of all resources
- `enable <service>`: Enable GCP services
- `start <resource>`: Start stopped resources
- `stop <resource>`: Stop running resources
- `delete <resource>`: Delete specific resources
- `list`: List all resources
- `cost`: Show estimated costs
- `deploy [service]`: Deploy services (delegates to gcp-deploy.sh)

**Functions**:

- `show_status()`: Display comprehensive resource status
- `start_resource()`: Start Cloud SQL instance
- `stop_resource()`: Stop Cloud SQL instance
- `show_costs()`: Calculate and display cost estimates

### 3. Deployment Script (gcp-deploy.sh)

**Purpose**: Build and deploy services to Cloud Run

**Commands**:

- `deploy [service] [--env=ENV]`: Deploy one or all services
- `status`: Show deployment status
- `urls`: Show all service URLs
- `delete [service]`: Delete deployed services

**Functions**:

- `load_env(file)`: Load environment variables from specified file
- `validate_env()`: Validate required environment variables
- `ensure_artifact_registry()`: Ensure registry exists
- `ensure_secret_permissions()`: Grant secret access to service accounts
- `build_and_push_image(service)`: Build container and push to registry
- `deploy_service(service, image)`: Deploy service to Cloud Run
- `get_service_url(service)`: Retrieve deployed service URL

**Build Process**:

1. Create cloudbuild.yaml for service
2. Submit build to Cloud Build
3. Tag with timestamp and latest
4. Push to Artifact Registry
5. Return image URL

**Deployment Process**:

1. Load environment configuration
2. Build container image
3. Configure environment variables
4. Mount secrets from Secret Manager
5. Configure Cloud SQL connection
6. Deploy to Cloud Run
7. Verify deployment
8. Return service URL

### 4. Cleanup Script (gcp-cleanup.sh)

**Purpose**: Safely delete GCP resources

**Modes**:

- Interactive menu (default)
- Full cleanup (`--all`)
- Selective cleanup (`--selective`)
- Menu-based selection (`--menu`)

**Functions**:

- `discover_resources()`: Find all existing resources
- `show_resource_details()`: Display detailed resource information
- `confirm_full_deletion()`: Require "DELETE ALL" confirmation
- `selective_deletion()`: Interactive y/n for each resource type
- `show_resource_menu()`: Menu-based resource selection
- `delete_cloud_run()`: Delete Cloud Run services
- `delete_cloud_sql()`: Delete Cloud SQL instances
- `delete_buckets()`: Delete storage buckets
- `delete_service_accounts()`: Delete service accounts
- `delete_secrets()`: Delete secrets
- `disable_apis()`: Disable GCP APIs

**Safety Features**:

- Resource discovery before deletion
- Detailed resource information display
- Multiple confirmation prompts
- Explicit "DELETE ALL" text requirement for full cleanup
- Continue on error (don't stop if one deletion fails)

## Data Models

### Environment Configuration

```typescript
interface EnvironmentConfig {
  // Environment
  NODE_ENV: 'development' | 'production';

  // GCP Configuration
  GCP_PROJECT_ID: string;
  GCP_REGION: string;
  GOOGLE_APPLICATION_CREDENTIALS?: string;

  // Service URLs
  API_GATEWAY_URL: string;
  WEBSOCKET_URL: string;
  FACE_PROCESSING_URL: string;

  // Service Ports (local only)
  API_GATEWAY_PORT?: number;
  WEBSOCKET_PORT?: number;
  FACE_PROCESSING_PORT?: number;

  // Database
  DATABASE_URL: string;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_NAME: string;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_SSL: boolean;
  CLOUD_SQL_CONNECTION_NAME?: string;

  // Storage Buckets
  GCS_BUCKET_VOICE_MODELS: string;
  GCS_BUCKET_FACE_MODELS: string;
  GCS_BUCKET_DOCUMENTS: string;
  GCS_BUCKET_UPLOADS: string;

  // Secrets (production uses ${SECRET_*} placeholders)
  JWT_SECRET: string;
  REFRESH_SECRET: string;

  // Caching
  ENABLE_CACHING: boolean;
  CACHE_TTL_SHORT: number;
  CACHE_TTL_MEDIUM: number;
  CACHE_TTL_LONG: number;

  // Feature Flags
  ENABLE_API_DOCS: boolean;
  ENABLE_DEBUG_ENDPOINTS: boolean;

  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  LOG_FORMAT: 'json' | 'simple';
}
```

### Cloud Run Service Configuration

```typescript
interface CloudRunServiceConfig {
  name: string;
  image: string;
  port: number;
  region: string;

  // Resources
  memory: string; // e.g., "512Mi"
  cpu: string; // e.g., "1"

  // Scaling
  minInstances: number; // 0 for scale-to-zero
  maxInstances: number; // e.g., 10
  timeout: number; // seconds, e.g., 300

  // Environment Variables
  envVars: Record<string, string>;

  // Secrets
  secrets: Array<{
    name: string;
    secretName: string;
    version: string;
  }>;

  // Cloud SQL
  cloudSqlInstances?: string[];

  // IAM
  allowUnauthenticated: boolean;
}
```

### Cloud SQL Configuration

```typescript
interface CloudSQLConfig {
  instanceName: string;
  databaseVersion: 'POSTGRES_15' | 'POSTGRES_16' | 'POSTGRES_17';
  tier: string; // e.g., "db-f1-micro", "db-custom-1-3840"
  region: string;

  // Storage
  storageType: 'SSD' | 'HDD';
  storageSize: number; // GB
  storageAutoIncrease: boolean;

  // Backups
  backupStartTime: string; // e.g., "03:00"

  // Maintenance
  maintenanceWindowDay: string; // e.g., "SUN"
  maintenanceWindowHour: number; // 0-23

  // Database Flags
  maxConnections: number;

  // Availability
  availabilityType: 'ZONAL' | 'REGIONAL';

  // Connection
  connectionName: string; // project:region:instance
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: API Enablement Idempotency

_For any_ GCP API in the required list, enabling it multiple times should result in the API being enabled without errors, regardless of whether it was already enabled.
**Validates: Requirements 1.2**

### Property 2: Bucket Creation Completeness

_For any_ environment configuration, all specified bucket names (voice models, face models, documents, uploads) should exist after setup completes.
**Validates: Requirements 1.4**

### Property 3: Lifecycle Policy Application

_For any_ created storage bucket, the lifecycle policy should be configured to delete temporary files after the specified retention period.
**Validates: Requirements 1.5**

### Property 4: Service Account Role Assignment

_For any_ created service account, all required IAM roles (cloudsql.client, storage.objectAdmin, secretmanager.secretAccessor, run.invoker) should be granted.
**Validates: Requirements 1.7**

### Property 5: Secret Placeholder Creation

_For any_ secret name in the required list (jwt-secret, refresh-secret, database-password), the secret should exist in Secret Manager after setup.
**Validates: Requirements 1.8**

### Property 6: PostgreSQL Version Compliance

_For any_ created Cloud SQL instance, the PostgreSQL version should be 15 or higher to ensure pgvector compatibility.
**Validates: Requirements 2.1**

### Property 7: Environment-Based Tier Selection

_For any_ environment type (development or production), the Cloud SQL tier should match the expected tier for that environment (db-f1-micro for dev, db-custom-1-3840 for prod).
**Validates: Requirements 2.2**

### Property 8: Backup Configuration

_For any_ created Cloud SQL instance, automatic backups should be enabled with a configured backup start time.
**Validates: Requirements 2.3**

### Property 9: Unix Socket Connection Format

_For any_ Cloud Run service connecting to Cloud SQL, the connection configuration should use Unix socket format (/cloudsql/PROJECT:REGION:INSTANCE).
**Validates: Requirements 2.7**

### Property 10: Image Tagging Consistency

_For any_ built container image, both timestamp and latest tags should be created and pushed to Artifact Registry.
**Validates: Requirements 3.2**

### Property 11: Multi-Stage Dockerfile Structure

_For any_ service Dockerfile, it should contain at least two FROM statements (builder and production stages) for optimized image size.
**Validates: Requirements 3.3**

### Property 12: Workspace Dependency Inclusion

_For any_ built container image, all required workspace packages (@clone/\*) should be present in the final image.
**Validates: Requirements 3.4**

### Property 13: Prisma Client Generation

_For any_ service using Prisma, the Prisma client should be generated in both the builder stage and the production stage.
**Validates: Requirements 3.5**

### Property 14: Build Failure Handling

_For any_ container build that fails, the deployment script should exit with a non-zero exit code and display error messages without proceeding to deployment.
**Validates: Requirements 3.7**

### Property 15: Regional Deployment Consistency

_For any_ deployed Cloud Run service, the service region should match the configured GCP_REGION environment variable.
**Validates: Requirements 4.1**

### Property 16: Environment Variable Propagation

_For any_ deployed Cloud Run service, all non-secret environment variables from the .env file should be present in the service configuration.
**Validates: Requirements 4.2**

### Property 17: Secret Mount Configuration

_For any_ deployed Cloud Run service, secrets from Secret Manager (jwt-secret, refresh-secret, database-password) should be mounted as environment variables.
**Validates: Requirements 4.3**

### Property 18: Cloud SQL Connection Configuration

_For any_ deployed Cloud Run service requiring database access, the cloudsql-instances flag should be set with the correct connection name.
**Validates: Requirements 4.4**

### Property 19: Resource Limit Configuration

_For any_ deployed Cloud Run service, CPU and memory limits should be set according to the service configuration (512Mi memory, 1 CPU).
**Validates: Requirements 4.5**

### Property 20: Autoscaling Configuration

_For any_ deployed Cloud Run service, min-instances should be 0 and max-instances should be 10 for cost-effective scaling.
**Validates: Requirements 4.6**

### Property 21: Public Access Configuration

_For any_ deployed Cloud Run service, the IAM policy should allow allUsers the roles/run.invoker role for public access.
**Validates: Requirements 4.7**

### Property 22: Service URL Return

_For any_ successfully deployed Cloud Run service, the deployment script should output a valid HTTPS URL for the service.
**Validates: Requirements 4.8**

### Property 23: Inter-Service URL Configuration

_For any_ deployed service, environment variables for other service URLs (API_GATEWAY_URL, WEBSOCKET_URL, FACE_PROCESSING_URL) should be set to enable inter-service communication.
**Validates: Requirements 4.9**

### Property 24: Deployment Failure Reporting

_For any_ failed deployment, the script should exit with a non-zero exit code and display clear error messages about the failure.
**Validates: Requirements 4.10**

### Property 25: Environment File Support

_For any_ environment file type (.env, .env.development, .env.production), the deployment script should be able to load and parse the file correctly.
**Validates: Requirements 5.1**

### Property 26: Environment Flag Handling

_For any_ --env flag value (development, production), the deployment script should load the corresponding environment file.
**Validates: Requirements 5.2**

### Property 27: Secret Placeholder Skipping

_For any_ environment variable with value matching ${SECRET\_\*} pattern, the variable should not be loaded into the environment (handled by Secret Manager instead).
**Validates: Requirements 5.7**

### Property 28: Required Variable Validation

_For any_ missing required environment variable (GCP_PROJECT_ID, GCP_REGION), the deployment script should exit with error and display which variables are missing.
**Validates: Requirements 5.8**

### Property 29: Status Check Performance

_For any_ status check operation, the script should complete within 30 seconds to provide timely feedback.
**Validates: Requirements 6.6**

### Property 30: Missing Resource Indication

_For any_ resource that does not exist, the status output should clearly indicate the resource is missing with an appropriate message.
**Validates: Requirements 6.7**

### Property 31: Resource Discovery Completeness

_For any_ cleanup operation, all resource types (GKE, Cloud SQL, Cloud Run, Storage, Service Accounts, Secrets) should be discovered and listed.
**Validates: Requirements 7.1**

### Property 32: Regional Service Deletion

_For any_ Cloud Run service deletion operation, all services in the specified region should be deleted.
**Validates: Requirements 7.7**

### Property 33: Cleanup Error Resilience

_For any_ cleanup operation that encounters an error deleting one resource, the script should continue attempting to delete remaining resources and report all failures at the end.
**Validates: Requirements 7.9**

### Property 34: Post-Deployment URL Verification

_For any_ successfully deployed service, the deployment script should verify the service URL is accessible before completing.
**Validates: Requirements 10.1**

### Property 35: Environment File URL Update

_For any_ successful deployment, the service URL should be written to the appropriate environment file (.env.production) for future reference.
**Validates: Requirements 10.3**

### Property 36: Health Check Failure Reporting

_For any_ service that fails health checks after deployment, the script should report the failure with clear error messages.
**Validates: Requirements 10.5**

## Error Handling

### Error Categories

1. **Prerequisites Errors**: gcloud CLI not installed, not authenticated
2. **Configuration Errors**: Missing environment variables, invalid values
3. **Resource Creation Errors**: API quota exceeded, insufficient permissions
4. **Build Errors**: Dockerfile syntax errors, missing dependencies
5. **Deployment Errors**: Invalid configuration, resource limits exceeded
6. **Network Errors**: Timeout connecting to GCP services

### Error Handling Strategy

```bash
# Exit immediately on error
set -e

# Trap errors and provide context
trap 'error_handler $? $LINENO' ERR

error_handler() {
    local exit_code=$1
    local line_number=$2
    log_error "Script failed at line $line_number with exit code $exit_code"
    # Cleanup partial resources if needed
    exit $exit_code
}

# Validate prerequisites before proceeding
check_prerequisites() {
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not installed"
        log_info "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        log_error "Not authenticated with gcloud"
        log_info "Run: gcloud auth login"
        exit 1
    fi
}

# Validate environment variables
validate_env() {
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
}

# Handle resource creation errors gracefully
create_resource_safe() {
    local resource_type=$1
    local resource_name=$2

    if resource_exists "$resource_type" "$resource_name"; then
        log_success "$resource_type $resource_name already exists"
        return 0
    fi

    if create_resource "$resource_type" "$resource_name"; then
        log_success "$resource_type $resource_name created"
        return 0
    else
        log_error "Failed to create $resource_type $resource_name"
        return 1
    fi
}
```

### Logging

```bash
# Color-coded logging functions
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
```

## Testing Strategy

### Unit Testing

Unit tests will verify individual script functions:

1. **Environment Loading**: Test loading from different .env files
2. **Validation**: Test validation of required variables
3. **Resource Checking**: Test checking if resources exist
4. **URL Parsing**: Test extracting service URLs
5. **Error Handling**: Test error messages and exit codes

### Integration Testing

Integration tests will verify end-to-end workflows:

1. **Setup Flow**: Create all resources in a test project
2. **Deployment Flow**: Build and deploy a test service
3. **Status Flow**: Check status of all resources
4. **Cleanup Flow**: Delete all resources

### Property-Based Testing

Property-based tests will verify correctness properties using `bats` (Bash Automated Testing System):

1. **Idempotency**: Running setup twice should succeed
2. **Completeness**: All expected resources should be created
3. **Consistency**: Environment variables should match configuration
4. **Safety**: Cleanup should require confirmation

### Manual Testing

Manual testing checklist:

1. ✅ Run setup in fresh GCP project
2. ✅ Verify all resources created
3. ✅ Deploy all services
4. ✅ Verify services accessible
5. ✅ Check status command output
6. ✅ Test selective cleanup
7. ✅ Test full cleanup
8. ✅ Verify all resources deleted

### Testing Tools

- **bats**: Bash Automated Testing System for unit tests
- **shellcheck**: Static analysis for bash scripts
- **gcloud**: GCP CLI for integration tests
- **curl**: HTTP testing for deployed services

### Test Environment

- Separate GCP project for testing
- Automated cleanup after tests
- CI/CD integration with GitHub Actions

## Performance Considerations

### Script Execution Time

- Setup: 5-10 minutes (Cloud SQL creation is slowest)
- Deployment: 3-5 minutes per service (build + deploy)
- Status: < 30 seconds
- Cleanup: 2-5 minutes

### Optimization Strategies

1. **Parallel Operations**: Use `&` for independent operations
2. **Caching**: Cache gcloud command results
3. **Timeouts**: Set reasonable timeouts for operations
4. **Incremental Builds**: Use Docker layer caching

### Resource Limits

- Cloud Run: 512Mi memory, 1 CPU per service
- Cloud SQL: db-f1-micro (dev), db-custom-1-3840 (prod)
- Storage: No limits, pay per use
- Artifact Registry: No limits, pay per storage

## Security Considerations

### Secret Management

- Use GCP Secret Manager for all production secrets
- Never commit secrets to version control
- Use ${SECRET\_\*} placeholders in .env.production
- Rotate secrets regularly

### IAM Permissions

- Use least privilege principle
- Service accounts have minimal required roles
- No user credentials in containers
- Use Cloud Run service identity

### Network Security

- Cloud Run services use HTTPS only
- Cloud SQL uses Unix socket from Cloud Run
- No public IP for Cloud SQL
- VPC connector for private services (if needed)

### Audit Logging

- Enable Cloud Audit Logs
- Monitor resource creation/deletion
- Alert on suspicious activity
- Retain logs for compliance

## Deployment Workflow

### Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd digitwinlive

# 2. Copy environment file
cp .env.example .env

# 3. Configure GCP project
# Edit .env and set GCP_PROJECT_ID

# 4. Run setup
./scripts/gcp-setup.sh

# 5. Enable pgvector
cloud_sql_proxy <connection-name>=tcp:5432 &
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres"
CREATE EXTENSION IF NOT EXISTS vector;

# 6. Run migrations
pnpm db:migrate

# 7. Deploy services
./scripts/gcp-deploy.sh deploy --env=production
```

### Continuous Deployment

```bash
# Deploy specific service after code changes
./scripts/gcp-deploy.sh deploy api-gateway --env=production

# Deploy all services
./scripts/gcp-deploy.sh deploy --env=production

# Check deployment status
./scripts/gcp-deploy.sh status

# Get service URLs
./scripts/gcp-deploy.sh urls
```

### Rollback

```bash
# Cloud Run automatically keeps previous revisions
# Rollback via GCP Console or gcloud CLI:
gcloud run services update-traffic api-gateway \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1
```

## Monitoring and Observability

### Cloud Logging

- All Cloud Run logs sent to Cloud Logging automatically
- Structured JSON logging in production
- Log levels: error, warn, info, debug

### Cloud Monitoring

- Automatic metrics for Cloud Run (requests, latency, errors)
- Custom metrics for business logic
- Alerting policies for critical issues

### Health Checks

- Cloud Run built-in health checks
- Custom /health endpoints in services
- Automatic restart on failure

### Cost Monitoring

- Use `gcp-manage.sh cost` for estimates
- Set up budget alerts in GCP Console
- Monitor actual costs in Billing dashboard

## Maintenance

### Regular Tasks

- Update dependencies monthly
- Rotate secrets quarterly
- Review and optimize costs monthly
- Update PostgreSQL version annually
- Review and update IAM permissions quarterly

### Backup Strategy

- Cloud SQL automatic daily backups
- 30-day retention period
- Point-in-time recovery available
- Test restore procedure quarterly

### Disaster Recovery

- Document recovery procedures
- Test recovery annually
- Maintain off-site backups
- Have rollback plan ready

## Database Connection Strategy

### Development (Local)

```typescript
// Local PostgreSQL connection
const DATABASE_URL = 'postgresql://postgres:password@127.0.0.1:5432/digitwinlive-db';

// Connection configuration
{
  host: '127.0.0.1',
  port: 5432,
  database: 'digitwinlive-db',
  user: 'postgres',
  password: 'password',
  ssl: false
}
```

### Production (Cloud Run → Cloud SQL)

```typescript
// Unix socket connection (recommended for Cloud Run)
const DATABASE_URL = 'postgresql://postgres:password@/digitwinlive-db?host=/cloudsql/PROJECT:REGION:INSTANCE';

// Connection configuration
{
  host: '/cloudsql/digitwinlive:us-central1:digitwinlive-db',
  database: 'digitwinlive-db',
  user: 'postgres',
  password: process.env.DATABASE_PASSWORD, // from Secret Manager
  ssl: false // Not needed with Unix socket
}
```

### Connection Selection Logic

```typescript
// Automatic connection selection based on environment
const isCloudRun = process.env.K_SERVICE !== undefined;
const isDevelopment = process.env.NODE_ENV === 'development';

let databaseUrl: string;

if (isCloudRun && process.env.CLOUD_SQL_CONNECTION_NAME) {
  // Cloud Run with Unix socket
  databaseUrl = `postgresql://${user}:${pass}@/${db}?host=/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`;
} else if (isDevelopment) {
  // Local development
  databaseUrl = `postgresql://${user}:${pass}@127.0.0.1:5432/${db}`;
} else {
  // Fallback to DATABASE_URL from environment
  databaseUrl = process.env.DATABASE_URL;
}
```

### Why Unix Socket for Cloud Run?

1. **Performance**: 5-10ms lower latency vs TCP
2. **Security**: Automatic IAM authentication, no password needed
3. **Simplicity**: No Cloud SQL Proxy sidecar required
4. **Reliability**: Built-in connection pooling and retry logic
5. **Cost**: Doesn't count against Cloud SQL connection limits

### pgvector Extension Setup

After Cloud SQL instance creation, enable pgvector:

```sql
-- Connect via Cloud SQL Proxy
cloud_sql_proxy digitwinlive:us-central1:digitwinlive-db --port=5432 &

-- Connect to database
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres"

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Create vector column example
ALTER TABLE embeddings ADD COLUMN embedding vector(768);

-- Create index for fast similarity search
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## Service-Specific Configurations

### API Gateway

- **Port**: 8080 (Cloud Run standard)
- **Memory**: 512Mi
- **CPU**: 1
- **Requires**: Database, Storage, Secrets
- **Dockerfile**: `apps/api-gateway/Dockerfile`
- **Dependencies**: @clone/database, @clone/validation, @clone/logger

### WebSocket Server

- **Port**: 8080 (Cloud Run standard)
- **Memory**: 512Mi
- **CPU**: 1
- **Requires**: Database, Secrets
- **Dockerfile**: `apps/websocket-server/Dockerfile`
- **Dependencies**: @clone/database, @clone/logger
- **Special**: Requires WebSocket support (Cloud Run supports this)

### Face Processing Service

- **Port**: 8080 (Cloud Run standard)
- **Memory**: 512Mi
- **CPU**: 1
- **Requires**: Storage
- **Dockerfile**: `services/face-processing-service/Dockerfile`
- **Dependencies**: @clone/logger, @clone/config
- **Special**: May need GPU in future (use Cloud Run with GPU or GKE)

## Script Execution Flow

### Setup Flow

```
gcp-setup.sh
├── 1. check_prerequisites()
│   ├── Verify gcloud installed
│   └── Verify authenticated
├── 2. load_env()
│   └── Load .env file
├── 3. setup_project()
│   ├── Set GCP_PROJECT_ID
│   └── Set GCP_REGION
├── 4. enable_apis()
│   ├── compute.googleapis.com
│   ├── sqladmin.googleapis.com
│   ├── storage-api.googleapis.com
│   ├── run.googleapis.com
│   ├── secretmanager.googleapis.com
│   ├── artifactregistry.googleapis.com
│   └── cloudbuild.googleapis.com
├── 5. create_artifact_registry()
│   ├── Check if exists
│   ├── Create if needed
│   └── Configure Docker auth
├── 6. create_storage_buckets()
│   ├── voice-models bucket
│   ├── face-models bucket
│   ├── documents bucket
│   ├── uploads bucket
│   └── Set lifecycle policies
├── 7. create_service_accounts()
│   ├── Create digitwinlive-sa
│   ├── Grant IAM roles
│   └── Create key file
├── 8. setup_secrets()
│   ├── jwt-secret
│   ├── refresh-secret
│   └── database-password
├── 9. create_cloud_sql() [Optional]
│   ├── Create PostgreSQL 15 instance
│   ├── Set root password
│   ├── Create database
│   └── Show connection details
└── 10. print_summary()
    └── Display next steps
```

### Deployment Flow

```
gcp-deploy.sh deploy [service] [--env=ENV]
├── 1. parse_args()
│   ├── Parse service name
│   └── Parse --env flag
├── 2. load_env(file)
│   ├── Determine env file (.env, .env.development, .env.production)
│   ├── Load variables
│   └── Skip ${SECRET_*} placeholders
├── 3. validate_env()
│   ├── Check GCP_PROJECT_ID
│   ├── Check GCP_REGION
│   └── Check required vars
├── 4. ensure_artifact_registry()
│   └── Create if doesn't exist
├── 5. ensure_secret_permissions()
│   └── Grant service account access
├── 6. get_current_service_urls()
│   ├── Fetch api-gateway URL
│   ├── Fetch websocket-server URL
│   └── Fetch face-processing-service URL
├── 7. For each service:
│   ├── build_and_push_image()
│   │   ├── Create cloudbuild.yaml
│   │   ├── Submit to Cloud Build
│   │   ├── Tag with timestamp
│   │   ├── Tag with latest
│   │   └── Return image URL
│   └── deploy_service()
│       ├── Configure env vars
│       ├── Mount secrets
│       ├── Configure Cloud SQL
│       ├── Set resource limits
│       ├── Deploy to Cloud Run
│       ├── Get service URL
│       └── Update URL variables
└── 8. print_urls()
    └── Display all service URLs
```

### Status Flow

```
gcp-manage.sh status
├── 1. load_env()
├── 2. show_status()
│   ├── Check APIs (with timeout)
│   ├── Check Storage Buckets (with sizes)
│   ├── Check Cloud SQL (state, connection)
│   ├── Check Secrets (count)
│   ├── Check Cloud Run Services (URLs)
│   └── Check Monitoring (alert count)
└── 3. Display results
    └── Color-coded output
```

### Cleanup Flow

```
gcp-cleanup.sh [--all|--selective|--menu]
├── 1. load_env()
├── 2. discover_resources()
│   ├── Find GKE clusters
│   ├── Find Cloud SQL instances
│   ├── Find Storage buckets
│   ├── Find Cloud Run services
│   ├── Find Service accounts
│   └── Find Secrets
├── 3. show_cleanup_menu() or selective_deletion()
│   ├── Display resources
│   ├── Get user selection
│   └── Confirm deletion
├── 4. Delete selected resources:
│   ├── delete_cloud_run()
│   ├── delete_gke()
│   ├── delete_cloud_sql()
│   ├── delete_buckets()
│   ├── delete_service_accounts()
│   └── delete_secrets()
└── 5. print_summary()
    └── Show deleted resources
```

## Troubleshooting Guide

### Common Issues

#### 1. gcloud CLI Not Found

```bash
# Error: gcloud: command not found
# Solution: Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

#### 2. Authentication Failed

```bash
# Error: Not authenticated with gcloud
# Solution: Login to gcloud
gcloud auth login
gcloud auth application-default login
```

#### 3. API Not Enabled

```bash
# Error: API [service] is not enabled
# Solution: Enable the API
gcloud services enable [service].googleapis.com
```

#### 4. Insufficient Permissions

```bash
# Error: Permission denied
# Solution: Check IAM roles
gcloud projects get-iam-policy $GCP_PROJECT_ID
# Grant required roles
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="user:your-email@example.com" \
  --role="roles/owner"
```

#### 5. Cloud SQL Connection Failed

```bash
# Error: Could not connect to Cloud SQL
# Solution: Check connection name and use Cloud SQL Proxy
cloud_sql_proxy PROJECT:REGION:INSTANCE --port=5432
```

#### 6. Container Build Failed

```bash
# Error: Build failed
# Solution: Check Dockerfile and dependencies
docker build -f apps/api-gateway/Dockerfile .
# Check build logs in Cloud Build console
```

#### 7. Deployment Failed

```bash
# Error: Deployment failed
# Solution: Check Cloud Run logs
gcloud run services logs read api-gateway --region=us-central1
```

#### 8. Service Not Accessible

```bash
# Error: Service returns 404 or 500
# Solution: Check service logs and environment variables
gcloud run services describe api-gateway --region=us-central1
gcloud run services logs read api-gateway --region=us-central1 --limit=50
```

## Future Enhancements

1. **Multi-Region Deployment**: Deploy to multiple regions for HA
2. **Blue-Green Deployment**: Zero-downtime deployments
3. **Canary Releases**: Gradual rollout of new versions
4. **Automated Testing**: Run tests before deployment
5. **Cost Optimization**: Auto-scaling based on usage patterns
6. **Enhanced Monitoring**: Custom dashboards and alerts
7. **Compliance**: GDPR, HIPAA compliance features
8. **Backup Automation**: Automated backup verification
9. **CI/CD Integration**: GitHub Actions workflows
10. **Infrastructure Validation**: Pre-deployment checks
