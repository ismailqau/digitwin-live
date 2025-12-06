# Requirements Document

## Introduction

This specification defines the requirements for a comprehensive GCP infrastructure management system for DigiTwin Live. The system must provide reliable setup, management, and deployment capabilities for all services using PostgreSQL with pgvector for vector storage, eliminating the need for separate vector database services.

## Glossary

- **GCP**: Google Cloud Platform
- **Cloud Run**: Google's serverless container platform
- **Cloud SQL**: Google's managed PostgreSQL database service
- **pgvector**: PostgreSQL extension for vector similarity search
- **Artifact Registry**: Google's container image registry
- **Cloud Storage**: Google's object storage service (GCS)
- **Secret Manager**: Google's secrets management service
- **Service Account**: GCP identity for applications
- **Setup Script**: Bash script for creating GCP resources (gcp-setup.sh)
- **Management Script**: Bash script for managing GCP resources (gcp-manage.sh)
- **Deployment Script**: Bash script for building and deploying services (gcp-deploy.sh)
- **Cleanup Script**: Bash script for deleting GCP resources (gcp-cleanup.sh)
- **Environment Configuration**: Settings specific to development or production environments
- **Container Image**: Docker image containing application code and dependencies
- **Cloud Build**: Google's CI/CD service for building containers

## Requirements

### Requirement 1: Infrastructure Setup

**User Story:** As a DevOps engineer, I want to set up all required GCP infrastructure from scratch, so that I can deploy the application to a clean GCP project.

#### Acceptance Criteria

1. WHEN the setup script is executed THEN the System SHALL verify gcloud CLI is installed and authenticated
2. WHEN the setup script is executed THEN the System SHALL enable all required GCP APIs (compute, sqladmin, storage, run, secretmanager, artifactregistry, cloudbuild)
3. WHEN the setup script is executed THEN the System SHALL create an Artifact Registry repository for container images
4. WHEN the setup script is executed THEN the System SHALL create Cloud Storage buckets for voice models, face models, documents, and uploads
5. WHEN the setup script is executed THEN the System SHALL configure bucket lifecycle policies for automatic cleanup of temporary files
6. WHEN the setup script is executed THEN the System SHALL create a Cloud SQL PostgreSQL 15 instance with pgvector support
7. WHEN the setup script is executed THEN the System SHALL create service accounts with appropriate IAM roles
8. WHEN the setup script is executed THEN the System SHALL create placeholder secrets in Secret Manager
9. WHEN the setup script is executed THEN the System SHALL provide clear instructions for next steps including pgvector extension installation

### Requirement 2: Database Configuration

**User Story:** As a developer, I want PostgreSQL configured with pgvector extension, so that I can store and query vector embeddings without a separate vector database.

#### Acceptance Criteria

1. WHEN creating a Cloud SQL instance THEN the System SHALL use PostgreSQL 15 or later (pgvector compatible)
2. WHEN creating a Cloud SQL instance THEN the System SHALL configure appropriate tier based on environment (db-f1-micro for dev, db-custom-1-3840 for prod)
3. WHEN creating a Cloud SQL instance THEN the System SHALL enable automatic backups with configurable schedule
4. WHEN creating a Cloud SQL instance THEN the System SHALL configure storage auto-increase
5. WHEN creating a Cloud SQL instance THEN the System SHALL provide connection details including Cloud SQL Proxy instructions
6. WHEN the database is created THEN the System SHALL provide instructions to enable pgvector extension via CREATE EXTENSION
7. WHEN connecting from Cloud Run THEN the System SHALL use Unix socket connection via Cloud SQL Proxy

### Requirement 3: Container Build and Registry

**User Story:** As a developer, I want to build and push container images to Artifact Registry, so that Cloud Run can deploy my services.

#### Acceptance Criteria

1. WHEN building a container image THEN the System SHALL use Cloud Build for consistent builds
2. WHEN building a container image THEN the System SHALL tag images with timestamp and latest tags
3. WHEN building a container image THEN the System SHALL use multi-stage Dockerfiles for optimized image size
4. WHEN building a container image THEN the System SHALL include all workspace dependencies correctly
5. WHEN building a container image THEN the System SHALL generate Prisma client in both build and production stages
6. WHEN pushing to Artifact Registry THEN the System SHALL authenticate using gcloud credentials
7. WHEN a build fails THEN the System SHALL provide clear error messages and stop deployment

### Requirement 4: Service Deployment

**User Story:** As a DevOps engineer, I want to deploy services to Cloud Run with proper configuration, so that they run reliably in production.

#### Acceptance Criteria

1. WHEN deploying a service THEN the System SHALL deploy to the specified GCP region
2. WHEN deploying a service THEN the System SHALL configure environment variables from .env files
3. WHEN deploying a service THEN the System SHALL mount secrets from Secret Manager
4. WHEN deploying a service THEN the System SHALL configure Cloud SQL connection via Unix socket
5. WHEN deploying a service THEN the System SHALL set appropriate resource limits (CPU, memory)
6. WHEN deploying a service THEN the System SHALL configure autoscaling (min 0, max 10 instances)
7. WHEN deploying a service THEN the System SHALL allow unauthenticated access for public endpoints
8. WHEN deploying a service THEN the System SHALL return the deployed service URL
9. WHEN deploying multiple services THEN the System SHALL update inter-service URLs for communication
10. WHEN a deployment fails THEN the System SHALL rollback automatically and report errors

### Requirement 5: Environment Management

**User Story:** As a developer, I want to manage different environments (development, production), so that I can test changes safely before production deployment.

#### Acceptance Criteria

1. WHEN loading environment configuration THEN the System SHALL support .env, .env.development, and .env.production files
2. WHEN deploying with --env flag THEN the System SHALL load the appropriate environment file
3. WHEN in development mode THEN the System SHALL use localhost URLs for services
4. WHEN in production mode THEN the System SHALL use Cloud Run URLs for services
5. WHEN in development mode THEN the System SHALL use relaxed security settings
6. WHEN in production mode THEN the System SHALL use strict security settings
7. WHEN environment variables contain ${SECRET\_\*} placeholders THEN the System SHALL skip loading them (handled by Secret Manager)
8. WHEN required environment variables are missing THEN the System SHALL fail with clear error messages

### Requirement 6: Infrastructure Status and Monitoring

**User Story:** As a DevOps engineer, I want to check the status of all GCP resources, so that I can verify infrastructure health.

#### Acceptance Criteria

1. WHEN checking status THEN the System SHALL list all enabled APIs
2. WHEN checking status THEN the System SHALL list all Cloud Storage buckets with sizes
3. WHEN checking status THEN the System SHALL show Cloud SQL instance state and connection details
4. WHEN checking status THEN the System SHALL list all Cloud Run services with URLs
5. WHEN checking status THEN the System SHALL show Secret Manager configuration
6. WHEN checking status THEN the System SHALL complete within 30 seconds
7. WHEN a resource is not found THEN the System SHALL clearly indicate it is missing

### Requirement 7: Resource Cleanup

**User Story:** As a DevOps engineer, I want to safely delete GCP resources, so that I can clean up test environments or decommission projects.

#### Acceptance Criteria

1. WHEN initiating cleanup THEN the System SHALL discover all existing resources
2. WHEN initiating cleanup THEN the System SHALL provide interactive menu for deletion mode selection
3. WHEN selecting full cleanup THEN the System SHALL require typing "DELETE ALL" for confirmation
4. WHEN selecting selective cleanup THEN the System SHALL allow choosing specific resource types
5. WHEN deleting Cloud SQL instances THEN the System SHALL show instance details and require explicit confirmation
6. WHEN deleting storage buckets THEN the System SHALL show bucket sizes and require explicit confirmation
7. WHEN deleting Cloud Run services THEN the System SHALL delete all services in the specified region
8. WHEN cleanup completes THEN the System SHALL provide a summary of deleted resources
9. WHEN cleanup encounters errors THEN the System SHALL continue with remaining resources and report failures

### Requirement 8: Cost Management

**User Story:** As a project manager, I want to understand infrastructure costs, so that I can budget appropriately.

#### Acceptance Criteria

1. WHEN requesting cost information THEN the System SHALL show estimated monthly costs for Cloud SQL
2. WHEN requesting cost information THEN the System SHALL show storage costs based on actual bucket sizes
3. WHEN requesting cost information THEN the System SHALL explain Cloud Run pay-per-use pricing
4. WHEN requesting cost information THEN the System SHALL provide total estimated monthly cost
5. WHEN requesting cost information THEN the System SHALL highlight cost savings from using pgvector instead of separate vector database
6. WHEN requesting cost information THEN the System SHALL provide links to GCP billing console

### Requirement 9: Local Development Support

**User Story:** As a developer, I want to run services locally with PostgreSQL and pgvector, so that I can develop without deploying to GCP.

#### Acceptance Criteria

1. WHEN running locally THEN the System SHALL use localhost URLs for all services
2. WHEN running locally THEN the System SHALL connect to local PostgreSQL on port 5432
3. WHEN running locally THEN the System SHALL support pgvector extension in local PostgreSQL
4. WHEN running locally THEN the System SHALL use development environment variables
5. WHEN running locally THEN the System SHALL not require GCP credentials for core functionality
6. WHEN running locally THEN the System SHALL provide clear instructions for local PostgreSQL setup with pgvector

### Requirement 10: Deployment Validation

**User Story:** As a DevOps engineer, I want to validate deployments after completion, so that I can ensure services are running correctly.

#### Acceptance Criteria

1. WHEN deployment completes THEN the System SHALL verify the service is accessible at its URL
2. WHEN deployment completes THEN the System SHALL display the service URL
3. WHEN deployment completes THEN the System SHALL update environment files with new URLs
4. WHEN checking service status THEN the System SHALL show current revision and deployment state
5. WHEN a service fails health checks THEN the System SHALL report the failure clearly

### Requirement 11: Secret Management

**User Story:** As a security engineer, I want secrets managed securely, so that sensitive credentials are never exposed in code or logs.

#### Acceptance Criteria

1. WHEN deploying to production THEN the System SHALL use GCP Secret Manager for all secrets
2. WHEN creating secrets THEN the System SHALL use placeholder values that must be updated manually
3. WHEN deploying services THEN the System SHALL mount secrets as environment variables
4. WHEN secrets are referenced in .env files THEN the System SHALL use ${SECRET\_\*} placeholder format
5. WHEN listing secrets THEN the System SHALL never display secret values
6. WHEN granting secret access THEN the System SHALL use appropriate IAM roles for service accounts

### Requirement 12: Rollback and Recovery

**User Story:** As a DevOps engineer, I want to rollback failed deployments, so that I can quickly restore service availability.

#### Acceptance Criteria

1. WHEN a deployment fails THEN the System SHALL automatically rollback to the previous revision
2. WHEN a deployment fails THEN the System SHALL preserve the previous container image
3. WHEN a deployment fails THEN the System SHALL provide clear error messages about the failure
4. WHEN manually rolling back THEN the System SHALL support deploying previous image tags
5. WHEN Cloud SQL fails THEN the System SHALL provide instructions for restoring from backups
