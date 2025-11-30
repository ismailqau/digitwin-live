# Design Document

## Overview

The Cloud Run Deployment System provides a streamlined, script-based approach to deploying DigitWin Live services to Google Cloud Run. The system leverages Google Cloud Build for container image creation and Artifact Registry for image storage, enabling consistent and reproducible deployments.

### Design Goals

1. **Simplicity**: Single command deployment for all services or individual services
2. **Consistency**: Follow existing GCP script conventions and patterns
3. **Reliability**: Proper error handling and validation before deployment
4. **Security**: Use Secret Manager for sensitive configuration
5. **Cost Efficiency**: Configure auto-scaling with scale-to-zero capability

### Technology Stack

- **Container Runtime**: Google Cloud Run (fully managed)
- **Container Registry**: Google Artifact Registry
- **Build System**: Google Cloud Build
- **Database**: Cloud SQL PostgreSQL with Cloud SQL Proxy
- **Secrets**: Google Secret Manager
- **Scripts**: Bash (consistent with existing GCP scripts)

## Architecture

### Deployment Flow

```mermaid
graph TB
    subgraph "Developer Machine"
        Script[gcp-deploy-services.sh]
        Env[.env Configuration]
    end

    subgraph "Google Cloud Build"
        Build[Cloud Build]
        Dockerfile[Dockerfile]
    end

    subgraph "Google Artifact Registry"
        Registry[(Container Images)]
    end

    subgraph "Google Cloud Run"
        APIGateway[API Gateway Service]
        WebSocket[WebSocket Server Service]
        FaceProcessing[Face Processing Service]
    end

    subgraph "Google Cloud SQL"
        Database[(PostgreSQL + pgvector)]
    end

    subgraph "Google Secret Manager"
        Secrets[(JWT Secrets, DB Password)]
    end

    Script --> Env
    Script --> Build
    Build --> Dockerfile
    Build --> Registry
    Registry --> APIGateway
    Registry --> WebSocket
    Registry --> FaceProcessing

    APIGateway --> Database
    WebSocket --> Database
    FaceProcessing --> Database

    APIGateway --> Secrets
    WebSocket --> Secrets
    FaceProcessing --> Secrets
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloud Run Services                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   API Gateway   │ WebSocket Server│   Face Processing Service   │
│   (Port 8080)   │   (Port 8080)   │        (Port 8080)          │
│                 │                 │                             │
│  - REST API     │  - Socket.io    │  - Face Detection           │
│  - Auth         │  - Real-time    │  - Embedding Generation     │
│  - Rate Limit   │  - Sessions     │  - Model Storage            │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         └─────────────────┼───────────────────────┘
                           │
                    Cloud SQL Proxy
                           │
                    ┌──────┴──────┐
                    │  Cloud SQL  │
                    │ PostgreSQL  │
                    └─────────────┘
```

## Components and Interfaces

### 1. Deployment Script (gcp-deploy-services.sh)

**Responsibilities:**

- Parse command-line arguments
- Validate environment configuration
- Build Docker images using Cloud Build
- Deploy services to Cloud Run
- Display deployment status and URLs

**Script Interface:**

```bash
# Deploy all services
./scripts/gcp-deploy-services.sh deploy

# Deploy specific service
./scripts/gcp-deploy-services.sh deploy api-gateway
./scripts/gcp-deploy-services.sh deploy websocket-server
./scripts/gcp-deploy-services.sh deploy face-processing-service

# Check deployment status
./scripts/gcp-deploy-services.sh status

# Delete all services
./scripts/gcp-deploy-services.sh delete

# Delete specific service
./scripts/gcp-deploy-services.sh delete api-gateway
```

**Functions:**

```bash
# Load environment variables from .env
load_env()

# Validate required environment variables
validate_env()

# Build and push Docker image to Artifact Registry
build_and_push_image(service_name, dockerfile_path)

# Deploy service to Cloud Run
deploy_service(service_name, image_url)

# Get Cloud Run service status
get_service_status(service_name)

# Delete Cloud Run service
delete_service(service_name)
```

### 2. Dockerfiles

**API Gateway Dockerfile (apps/api-gateway/Dockerfile):**

```dockerfile
# Multi-stage build for minimal image size
FROM node:22-slim AS builder
WORKDIR /app
# Install dependencies and build
# ...

FROM node:22-slim AS production
WORKDIR /app
# Copy only production artifacts
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

**WebSocket Server Dockerfile (apps/websocket-server/Dockerfile):**

```dockerfile
# Similar multi-stage build pattern
FROM node:22-slim AS builder
# ...

FROM node:22-slim AS production
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### 3. Cloud Run Configuration

**Service Configuration:**

| Setting       | Value | Rationale                                |
| ------------- | ----- | ---------------------------------------- |
| Min Instances | 0     | Scale to zero for cost savings           |
| Max Instances | 10    | Limit costs while allowing scaling       |
| Memory        | 512Mi | Sufficient for Node.js services          |
| CPU           | 1     | Single CPU for standard workloads        |
| Timeout       | 300s  | Allow long-running requests              |
| Concurrency   | 80    | Default concurrent requests per instance |

**Environment Variables:**

```bash
# Common to all services
NODE_ENV=production
GCP_PROJECT_ID=${GCP_PROJECT_ID}
GCP_REGION=${GCP_REGION}

# Database (via Cloud SQL Proxy)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION}

# Storage
GCS_BUCKET_VOICE_MODELS=${GCS_BUCKET_VOICE_MODELS}
GCS_BUCKET_FACE_MODELS=${GCS_BUCKET_FACE_MODELS}
GCS_BUCKET_DOCUMENTS=${GCS_BUCKET_DOCUMENTS}
GCS_BUCKET_UPLOADS=${GCS_BUCKET_UPLOADS}

# Secrets (from Secret Manager)
JWT_SECRET=sm://${GCP_PROJECT_ID}/jwt-secret
REFRESH_SECRET=sm://${GCP_PROJECT_ID}/refresh-secret
```

### 4. Artifact Registry Configuration

**Repository Structure:**

```
${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/digitwinlive/
├── api-gateway:latest
├── api-gateway:v1.0.0
├── websocket-server:latest
├── websocket-server:v1.0.0
├── face-processing-service:latest
└── face-processing-service:v1.0.0
```

## Data Models

### Deployment Configuration

```typescript
interface DeploymentConfig {
  serviceName: string;
  dockerfilePath: string;
  contextPath: string;
  port: number;
  memory: string;
  cpu: string;
  minInstances: number;
  maxInstances: number;
  timeout: number;
  envVars: Record<string, string>;
  secrets: SecretReference[];
  cloudSqlConnection?: string;
}

interface SecretReference {
  envVar: string;
  secretName: string;
  version: string;
}

interface ServiceStatus {
  name: string;
  url: string;
  revision: string;
  status: 'READY' | 'DEPLOYING' | 'FAILED';
  lastDeployedAt: Date;
  instances: {
    min: number;
    max: number;
    current: number;
  };
}
```

### Service Definitions

```typescript
const SERVICES: Record<string, DeploymentConfig> = {
  'api-gateway': {
    serviceName: 'api-gateway',
    dockerfilePath: 'apps/api-gateway/Dockerfile',
    contextPath: '.',
    port: 8080,
    memory: '512Mi',
    cpu: '1',
    minInstances: 0,
    maxInstances: 10,
    timeout: 300,
    envVars: {
      NODE_ENV: 'production',
      API_GATEWAY_PORT: '8080',
    },
    secrets: [
      { envVar: 'JWT_SECRET', secretName: 'jwt-secret', version: 'latest' },
      { envVar: 'REFRESH_SECRET', secretName: 'refresh-secret', version: 'latest' },
    ],
    cloudSqlConnection: '${GCP_PROJECT_ID}:${GCP_REGION}:digitwinlive-db',
  },
  'websocket-server': {
    serviceName: 'websocket-server',
    dockerfilePath: 'apps/websocket-server/Dockerfile',
    contextPath: '.',
    port: 8080,
    memory: '512Mi',
    cpu: '1',
    minInstances: 0,
    maxInstances: 10,
    timeout: 300,
    envVars: {
      NODE_ENV: 'production',
      WEBSOCKET_PORT: '8080',
    },
    secrets: [{ envVar: 'JWT_SECRET', secretName: 'jwt-secret', version: 'latest' }],
    cloudSqlConnection: '${GCP_PROJECT_ID}:${GCP_REGION}:digitwinlive-db',
  },
  'face-processing-service': {
    serviceName: 'face-processing-service',
    dockerfilePath: 'services/face-processing-service/Dockerfile',
    contextPath: '.',
    port: 8080,
    memory: '512Mi',
    cpu: '1',
    minInstances: 0,
    maxInstances: 10,
    timeout: 300,
    envVars: {
      NODE_ENV: 'production',
      FACE_PROCESSING_PORT: '8080',
    },
    secrets: [],
    cloudSqlConnection: '${GCP_PROJECT_ID}:${GCP_REGION}:digitwinlive-db',
  },
};
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Based on the prework analysis, the following properties can be consolidated:

### Property 1: Service argument validation

_For any_ valid service name (api-gateway, websocket-server, face-processing-service), when passed as an argument to the deploy command, the script should only target that specific service for deployment.
**Validates: Requirements 1.2**

### Property 2: Error exit code on failure

_For any_ deployment failure scenario (missing env vars, build failure, deploy failure), the script should exit with a non-zero status code and display an error message.
**Validates: Requirements 1.5, 5.5**

### Property 3: Multi-stage Dockerfile structure

_For any_ service Dockerfile, parsing the file should reveal at least two FROM statements indicating multi-stage build.
**Validates: Requirements 2.3**

### Property 4: Port 8080 exposure

_For any_ service Dockerfile, the file should contain an EXPOSE 8080 directive for Cloud Run compatibility.
**Validates: Requirements 2.5**

### Property 5: Cloud Run configuration parameters

_For any_ service deployment, the gcloud run deploy command should include: --min-instances=0, --max-instances=10, --memory=512Mi, --cpu=1, --timeout=300, and --allow-unauthenticated flags.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 6: Environment variable injection

_For any_ service deployment, the gcloud command should include --set-env-vars with NODE_ENV=production and service-specific variables.
**Validates: Requirements 3.5, 5.1, 5.2, 5.3**

### Property 7: Cloud SQL connection configuration

_For any_ service requiring database access, the deployment command should include --add-cloudsql-instances with the correct connection name.
**Validates: Requirements 4.1, 4.2**

### Property 8: Secret Manager integration

_For any_ service requiring secrets, the deployment command should include --set-secrets with references to Secret Manager.
**Validates: Requirements 5.4**

### Property 9: Consistent script conventions

_For any_ deployment script function, the logging output should use the same color codes and format as gcp-setup.sh (log_info, log_success, log_error, log_warning).
**Validates: Requirements 7.2, 7.3**

## Error Handling

### Error Categories

**1. Environment Validation Errors**

- Missing GCP_PROJECT_ID
- Missing GCP_REGION
- Missing database credentials
- Missing required secrets

**Strategy:**

- Validate all required variables before any deployment
- Display clear error message indicating which variable is missing
- Exit with code 1

**2. Build Errors**

- Dockerfile not found
- Build compilation failure
- Push to registry failure

**Strategy:**

- Check Dockerfile exists before building
- Capture Cloud Build output for debugging
- Retry push once on transient failures
- Exit with code 2

**3. Deployment Errors**

- Service quota exceeded
- Invalid configuration
- Permission denied

**Strategy:**

- Display gcloud error output
- Suggest common fixes (enable APIs, check permissions)
- Exit with code 3

**4. Network Errors**

- Timeout connecting to GCP
- API unavailable

**Strategy:**

- Retry with exponential backoff (3 attempts)
- Display timeout message
- Exit with code 4

## Testing Strategy

### Unit Testing

The deployment scripts are bash-based, so testing focuses on:

1. **Script syntax validation**: Use `bash -n` to check syntax
2. **Function isolation**: Test individual functions with mock inputs
3. **Environment validation**: Test with various missing/present env vars

### Property-Based Testing

Using `bats` (Bash Automated Testing System) for property-based testing:

```bash
# Test framework: bats-core
# Minimum iterations: 100 (via parameterized tests)

# Property tests will verify:
# - Service name validation
# - Error handling consistency
# - Configuration parameter presence
```

### Integration Testing

1. **Dry-run deployment**: Use `--dry-run` flag to validate commands without executing
2. **Local Docker build**: Verify Dockerfiles build successfully locally
3. **GCP integration**: Deploy to a test project and verify service health

### Test Files

- `scripts/tests/gcp-deploy-services.bats` - Property and unit tests
- `scripts/tests/dockerfile-validation.bats` - Dockerfile structure tests
