# Requirements Document

## Introduction

The Cloud Run Deployment System enables automated deployment of the DigitWin Live services (API Gateway, WebSocket Server, and Face Processing Service) to Google Cloud Run. The system provides a simple, script-based deployment workflow that integrates with the existing GCP management infrastructure, allowing developers to deploy services individually or all at once using a single command.

## Glossary

- **Cloud Run**: Google Cloud's fully managed serverless platform for containerized applications
- **Artifact Registry**: Google Cloud's container image storage service (replaces Container Registry)
- **API Gateway**: The REST API service handling HTTP requests (apps/api-gateway)
- **WebSocket Server**: The persistent connection handler for real-time communication (apps/websocket-server)
- **Face Processing Service**: The service handling face model creation and processing (services/face-processing-service)
- **gcp-deploy-services.sh**: The deployment script that builds and deploys services to Cloud Run
- **gcp-manage.sh**: The existing GCP management script that orchestrates deployment commands
- **Service Account**: GCP identity used by Cloud Run services to access other GCP resources
- **Cloud SQL Proxy**: Sidecar that enables secure connections to Cloud SQL from Cloud Run

## Requirements

### Requirement 1: Deployment Script Creation

**User Story:** As a developer, I want a deployment script that builds and deploys services to Cloud Run, so that I can deploy my application with a single command.

#### Acceptance Criteria

1. WHEN the deployment script is executed without arguments, THE script SHALL deploy all three services (api-gateway, websocket-server, face-processing-service) sequentially
2. WHEN the deployment script is executed with a service name argument, THE script SHALL deploy only the specified service
3. WHEN deploying a service, THE script SHALL build the Docker image using Cloud Build and push to Artifact Registry
4. WHEN deploying a service, THE script SHALL deploy the container to Cloud Run with appropriate configuration
5. IF a deployment fails, THEN THE script SHALL display a clear error message and SHALL exit with non-zero status code

### Requirement 2: Docker Configuration

**User Story:** As a developer, I want Dockerfiles for each service, so that they can be containerized and deployed to Cloud Run.

#### Acceptance Criteria

1. THE api-gateway service SHALL have a Dockerfile that builds a production-ready container image
2. THE websocket-server service SHALL have a Dockerfile that builds a production-ready container image
3. WHEN building Docker images, THE Dockerfile SHALL use multi-stage builds to minimize image size
4. THE Docker images SHALL include only production dependencies and compiled code
5. THE Docker images SHALL expose the correct port (8080) for Cloud Run compatibility

### Requirement 3: Cloud Run Service Configuration

**User Story:** As a developer, I want Cloud Run services configured with appropriate resources and settings, so that they perform well in production.

#### Acceptance Criteria

1. WHEN deploying to Cloud Run, THE script SHALL configure services with minimum 0 and maximum 10 instances for auto-scaling
2. WHEN deploying to Cloud Run, THE script SHALL configure services with 512Mi memory and 1 CPU
3. WHEN deploying to Cloud Run, THE script SHALL set request timeout to 300 seconds for long-running operations
4. WHEN deploying to Cloud Run, THE script SHALL configure services to allow unauthenticated access for public endpoints
5. WHEN deploying to Cloud Run, THE script SHALL inject environment variables from the deployment configuration

### Requirement 4: Database Connectivity

**User Story:** As a developer, I want Cloud Run services to connect securely to Cloud SQL, so that the application can access the database.

#### Acceptance Criteria

1. WHEN deploying services that require database access, THE script SHALL configure Cloud SQL connection using the Cloud SQL Proxy
2. THE script SHALL use the existing Cloud SQL instance connection name from environment configuration
3. WHEN database connection fails, THE service SHALL log the error and SHALL return appropriate error response

### Requirement 5: Environment Variable Management

**User Story:** As a developer, I want environment variables properly configured for Cloud Run services, so that the application runs correctly in production.

#### Acceptance Criteria

1. WHEN deploying services, THE script SHALL set NODE_ENV to production
2. WHEN deploying services, THE script SHALL configure database connection variables using Cloud SQL connection format
3. WHEN deploying services, THE script SHALL configure GCS bucket names from environment variables
4. WHEN deploying services, THE script SHALL configure JWT secrets using Secret Manager references
5. IF required environment variables are missing, THEN THE script SHALL display an error and SHALL exit before deployment

### Requirement 6: Deployment Status and Verification

**User Story:** As a developer, I want to verify deployment status and service health, so that I can confirm successful deployments.

#### Acceptance Criteria

1. WHEN deployment completes, THE script SHALL display the service URL for each deployed service
2. THE script SHALL provide a status command that shows all deployed Cloud Run services and their URLs
3. WHEN checking status, THE script SHALL display service revision, status, and last deployment time
4. THE script SHALL provide a delete command to remove deployed services from Cloud Run

### Requirement 7: Integration with Existing Scripts

**User Story:** As a developer, I want the deployment script to integrate with existing GCP management scripts, so that I have a consistent workflow.

#### Acceptance Criteria

1. THE gcp-manage.sh script SHALL call gcp-deploy-services.sh when the deploy command is used
2. THE deployment script SHALL use the same environment loading mechanism as gcp-setup.sh
3. THE deployment script SHALL follow the same logging and color conventions as other GCP scripts
4. THE package.json SHALL include npm scripts for deployment commands (gcp:deploy, gcp:deploy:api-gateway, etc.)
