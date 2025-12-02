---
inclusion: manual
---

# GCP Deployment Guidelines

## Infrastructure

This project deploys to Google Cloud Platform:

- **Cloud Run**: Containerized services
- **Cloud SQL**: PostgreSQL database
- **Cloud Storage**: File storage (voice models, face models, documents)
- **Cloud Pub/Sub**: Event bus
- **Cloud Monitoring**: Metrics and alerting

## Environment Variables

### Required for All Services

```bash
# GCP Configuration
GCP_PROJECT_ID=digitwinlive-prod
GCP_REGION=us-central1

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
JWT_SECRET=<generated-secret>
REFRESH_SECRET=<generated-secret>
```

### Service-Specific

```bash
# API Gateway
API_GATEWAY_PORT=3000

# WebSocket Server
WEBSOCKET_PORT=3001

# XTTS Service
XTTS_SERVICE_URL=http://localhost:8000
XTTS_GPU_ENABLED=true

# LLM Providers
GOOGLE_AI_API_KEY=<key>
OPENAI_API_KEY=<key>
GROQ_API_KEY=<key>
```

## Deployment Commands

```bash
# Deploy all services
pnpm gcp:deploy

# Deploy specific service
pnpm gcp:deploy:api-gateway
pnpm gcp:deploy:websocket
pnpm gcp:deploy:face

# Check service status
pnpm gcp:services:status

# View costs
pnpm gcp:cost
```

## Terraform

Infrastructure is managed with Terraform:

```bash
# Initialize
pnpm tf:init

# Plan changes
pnpm tf:plan

# Apply changes
pnpm tf:apply

# Validate configuration
pnpm tf:validate
```

## Database Migrations

```bash
# Apply migrations to production
pnpm db:migrate:deploy

# Generate Prisma client
pnpm db:generate
```

## Secrets Management

Generate secrets locally:

```bash
node scripts/generate-secrets.js
```

Store in GCP Secret Manager or environment variables.

## Health Checks

All services expose health endpoints:

- `/health` - Basic health check
- `/ready` - Readiness check (includes dependencies)

## Monitoring

- **Cloud Monitoring**: Metrics dashboard
- **Cloud Logging**: Centralized logs
- **Error Reporting**: Automatic error tracking

## Cleanup

```bash
# Cleanup all resources
pnpm gcp:cleanup

# Cleanup specific resources
pnpm gcp:cleanup-selective

# Cleanup SQL only
pnpm gcp:cleanup-sql
```

## Cost Management

```bash
# View current costs
pnpm gcp:cost

# Stop all services (save costs)
pnpm gcp:stop-all

# Start all services
pnpm gcp:start-all
```
