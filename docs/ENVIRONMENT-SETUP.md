# Environment Configuration Guide

## Overview

This guide explains how to set up environment variables for the DigitWin Live platform across different environments.

## Quick Start

### 1. Choose Your Environment

```bash
# Development
cp .env.development .env

# Production
cp .env.production .env

# Testing
cp .env.test .env
```

### 2. Generate Secure Secrets

For production, generate strong secrets:

```bash
# Generate JWT secrets
openssl rand -base64 32

# Generate session secrets
openssl rand -hex 32

# Generate CSRF secrets
openssl rand -base64 24
```

### 3. Update Required Values

Edit `.env` and replace placeholder values with your actual credentials.

## Environment Files

### `.env.example`

Complete reference with all available environment variables and descriptions.

### `.env.development`

Pre-configured for local development with sensible defaults.

### `.env.production`

Production configuration template with security best practices.

### `.env.test`

Test environment configuration with mocked services.

## Required Variables

### Minimum Configuration for Development

```bash
# Application
NODE_ENV=development
API_GATEWAY_PORT=3000
WEBSOCKET_PORT=3001

# Authentication
JWT_SECRET=your-jwt-secret
REFRESH_SECRET=your-refresh-secret

# Database (includes caching via indexed tables)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/digitwinline_dev

# Caching (PostgreSQL-based)
ENABLE_CACHING=true
CACHE_TTL_SHORT=300
CACHE_TTL_MEDIUM=3600
CACHE_TTL_LONG=86400
```

### Additional Requirements for Production

```bash
# CORS
CORS_ORIGIN=https://app.digitwin-live.com

# Database with SSL
DATABASE_SSL=true
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id

# AI Services
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
GOOGLE_CHIRP_API_KEY=your-chirp-api-key

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

## Service-Specific Configuration

### Database Setup

#### PostgreSQL (Local Development)

```bash
# Install PostgreSQL
brew install postgresql  # macOS
sudo apt install postgresql  # Ubuntu

# Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Ubuntu

# Create database
createdb digitwinline_dev

# Set environment variables
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/digitwinline_dev
```

#### Cloud SQL (Production)

```bash
# Enable Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Create instance
gcloud sql instances create clone-db-prod \
  --database-version=POSTGRES_17 \
  --tier=db-perf-optimized-N-4 \
  --region=us-central1

# Create database
gcloud sql databases create digitwinline_prod \
  --instance=clone-db-prod

# Get connection name
gcloud sql instances describe clone-db-prod \
  --format="value(connectionName)"

# Set environment variables
CLOUD_SQL_CONNECTION_NAME=project:region:instance
CLOUD_SQL_CONNECTION_NAME=digitwinlive:us-central1:clone-db-prod
DATABASE_URL=postgresql://user:pass@/db?host=/cloudsql/project:region:instance
DATABASE_URL=postgresql://user:pass@/db?host=/cloudsql/digitwinlive:us-central1:clone-db-prod
```

### Caching Setup

The system uses PostgreSQL-based caching with indexed cache tables. No separate cache service is required.

#### Cache Configuration

```bash
# Enable caching
ENABLE_CACHING=true

# Configure cache TTL (Time To Live) in seconds
CACHE_TTL_SHORT=300      # 5 minutes - for frequently changing data
CACHE_TTL_MEDIUM=3600    # 1 hour - for moderately stable data
CACHE_TTL_LONG=86400     # 24 hours - for rarely changing data
```

#### Cache Tables

The following cache tables will be created automatically:

- `cache_embeddings` - Cached vector embeddings
- `cache_llm_responses` - Cached LLM responses
- `cache_vector_search` - Cached vector search results
- `cache_audio_chunks` - Cached audio chunks

All cache tables use PostgreSQL indexes for fast lookups and automatic TTL-based expiration.

#### Cache Performance

```sql
-- Example: Check cache hit rate
SELECT
  table_name,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_entries
FROM information_schema.tables
WHERE table_name LIKE 'cache_%'
GROUP BY table_name;
```

### OAuth Configuration

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/v1/auth/oauth/google/callback`
   - Production: `https://api.digitwin-live.com/api/v1/auth/oauth/google/callback`
4. Copy Client ID and Client Secret

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/oauth/google/callback
```

#### Apple OAuth

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
2. Create App ID and Services ID
3. Configure Sign in with Apple
4. Generate private key
5. Download and save the `.p8` file

```bash
APPLE_CLIENT_ID=com.yourcompany.digitwin-live
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY_PATH=./secrets/apple-private-key.p8
APPLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/oauth/apple/callback
```

### AI Services

#### Google Gemini

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Set environment variable

```bash
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

#### OpenAI

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create API key
3. Set environment variable

```bash
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview
```

#### Google Chirp (Speech-to-Text)

1. Enable Cloud Speech-to-Text API
2. Create service account
3. Download credentials JSON

```bash
GOOGLE_CHIRP_API_KEY=your-chirp-api-key
GOOGLE_APPLICATION_CREDENTIALS=./secrets/gcp-service-account.json
```

### Vector Database

#### PostgreSQL with pgvector (Recommended)

The application uses PostgreSQL with the pgvector extension for vector storage and similarity search. This provides:

- **Cost-effective**: No separate vector database service needed
- **Simplified infrastructure**: Single database for all data
- **ACID compliance**: Transactional consistency
- **High performance**: Sub-5ms vector similarity searches with proper indexing

**Setup:**

1. Install pgvector extension in your PostgreSQL database:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. The vector tables will be created automatically by the application migrations.

3. Configuration (uses existing DATABASE_URL):
```bash
VECTOR_DIMENSIONS=768  # Google text-embedding-004 dimension
VECTOR_INDEX_LISTS=100  # IVFFlat index parameter
```

#### Weaviate (Self-hosted)

```bash
# Run with Docker
docker run -d \
  -p 8080:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  semitechnologies/weaviate:latest

# Set environment variable
WEAVIATE_URL=http://localhost:8080
```

## Secret Management

### Development

Store secrets in `.env` file (gitignored).

### Production

Use a secret management service:

#### Google Cloud Secret Manager

```bash
# Create secrets
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:your-service@project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Access in application
gcloud secrets versions access latest --secret="jwt-secret"
```

#### Environment Variable Injection

```bash
# In Cloud Run
gcloud run deploy api-gateway \
  --set-env-vars="JWT_SECRET=$(gcloud secrets versions access latest --secret=jwt-secret)"

# In Kubernetes
kubectl create secret generic app-secrets \
  --from-literal=jwt-secret="your-jwt-secret"
```

## Environment Variable Validation

### Startup Validation

The application validates required environment variables on startup:

```typescript
// Example validation
const requiredEnvVars = ['JWT_SECRET', 'REFRESH_SECRET', 'DATABASE_URL'];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

### Runtime Validation

Use a validation library like `joi` or `zod`:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  API_GATEWAY_PORT: z.coerce.number().int().positive(),
});

const env = envSchema.parse(process.env);
```

## Docker Configuration

### Development with Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  api-gateway:
    build: ./apps/api-gateway
    env_file:
      - .env.development
    ports:
      - '3000:3000'
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: digitwinline_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    # Note: Caching uses PostgreSQL indexed tables, no separate cache service needed
```

### Production with Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  template:
    spec:
      containers:
        - name: api-gateway
          image: gcr.io/project/api-gateway:latest
          envFrom:
            - secretRef:
                name: app-secrets
            - configMapRef:
                name: app-config
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check if PostgreSQL is running
pg_isready

# Test connection
psql -h localhost -U postgres -d digitwinline_dev

# Verify DATABASE_URL format
echo $DATABASE_URL
```

#### 2. Caching Not Working

```bash
# Verify caching is enabled
echo $ENABLE_CACHING

# Check if cache tables exist
psql $DATABASE_URL -c "\dt cache_*"

# Check cache table structure
psql $DATABASE_URL -c "\d cache_embeddings"

# Clear cache if needed
psql $DATABASE_URL -c "DELETE FROM cache_embeddings WHERE expires_at < NOW()"
```

#### 3. JWT Token Invalid

```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Check secret length (should be at least 32 characters)
echo -n $JWT_SECRET | wc -c
```

#### 4. OAuth Redirect URI Mismatch

- Ensure redirect URI in OAuth provider matches exactly
- Check for trailing slashes
- Verify protocol (http vs https)
- Confirm port numbers match

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
NODE_ENV=development
```

### Health Checks

Test service health:

```bash
# API Gateway
curl http://localhost:3000/health

# WebSocket Server
curl http://localhost:3001/health
```

## Best Practices

### Security

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use strong secrets** - Minimum 32 characters
3. **Rotate secrets regularly** - Every 90 days
4. **Limit secret access** - Use IAM roles
5. **Encrypt secrets at rest** - Use secret managers

### Organization

1. **Use `.env.example`** - Document all variables
2. **Group related variables** - Use comments
3. **Validate on startup** - Fail fast
4. **Use defaults wisely** - Only for development
5. **Document changes** - Update this guide

### Performance

1. **Cache environment variables** - Don't read repeatedly
2. **Use connection pooling** - For databases
3. **Enable compression** - In production
4. **Configure timeouts** - For external services

## Migration Guide

### From v1.0 to v2.0

If upgrading from a previous version:

1. Backup current `.env` file
2. Review `.env.example` for new variables
3. Add new required variables
4. Update deprecated variable names
5. Test in development before production

## Support

For issues with environment configuration:

1. Check this documentation
2. Review `.env.example` for reference
3. Check application logs for validation errors
4. Contact DevOps team for production issues

## Additional Resources

- [12-Factor App - Config](https://12factor.net/config)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)
- [Docker Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
