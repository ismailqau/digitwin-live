# Environment Variables Quick Reference

## Essential Variables

### Authentication (Required)

```bash
JWT_SECRET=<32+ character secret>
REFRESH_SECRET=<32+ character secret>
```

### Database (Required)

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### Application (Required)

```bash
NODE_ENV=development|staging|production|test
API_GATEWAY_PORT=3000
WEBSOCKET_PORT=3001
```

## By Feature

### OAuth Authentication

```bash
# Google
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/oauth/google/callback

# Apple
APPLE_CLIENT_ID=com.yourcompany.app
APPLE_TEAM_ID=<team-id>
APPLE_KEY_ID=<key-id>
APPLE_PRIVATE_KEY_PATH=./secrets/apple-key.p8
APPLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/oauth/apple/callback
```

### AI Services

```bash
# LLM
GEMINI_API_KEY=<key>
OPENAI_API_KEY=sk-<key>
GROQ_API_KEY=<key>

# Speech-to-Text
GOOGLE_CHIRP_API_KEY=<key>

# Text-to-Speech
OPENAI_TTS_MODEL=tts-1
GOOGLE_TTS_API_KEY=<key>
```

### Vector Database

```bash
# Option A: PostgreSQL with pgvector (uses same DATABASE_URL)
VECTOR_DIMENSIONS=768
VECTOR_INDEX_LISTS=100
WEAVIATE_ENABLED=false

# Option B: Weaviate (self-hosted)
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=  # Leave empty for anonymous access
WEAVIATE_ENABLED=true
```

### Caching & Rate Limiting

```bash
# PostgreSQL-based caching (no separate cache service)
ENABLE_CACHING=true
CACHE_TTL_SHORT=300
CACHE_TTL_MEDIUM=3600
CACHE_TTL_LONG=86400

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

### Cloud Storage (GCP)

```bash
GCP_PROJECT_ID=<project-id>
GCP_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./secrets/gcp-key.json
GCS_BUCKET_VOICE_MODELS=<bucket-name>
GCS_BUCKET_DOCUMENTS=<bucket-name>
```

### Monitoring

```bash
SENTRY_DSN=<dsn>
LOG_LEVEL=info|debug|warn|error
```

### Security

```bash
CORS_ORIGIN=*  # Development
CORS_ORIGIN=https://app.example.com  # Production
SESSION_SECRET=<secret>
CSRF_SECRET=<secret>
```

## By Environment

### Development Minimum

```bash
NODE_ENV=development
JWT_SECRET=dev-secret-change-me
REFRESH_SECRET=dev-refresh-secret-change-me
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_dev
API_GATEWAY_PORT=3000
WEBSOCKET_PORT=3001

# Vector Database (choose one)
WEAVIATE_ENABLED=true  # Use Weaviate (easier setup)
WEAVIATE_URL=http://localhost:8080
# OR
WEAVIATE_ENABLED=false  # Use PostgreSQL + pgvector
VECTOR_DIMENSIONS=768
```

### Production Minimum

```bash
NODE_ENV=production
JWT_SECRET=${SECRET_JWT_SECRET}
REFRESH_SECRET=${SECRET_REFRESH_SECRET}
DATABASE_URL=${SECRET_DATABASE_URL}
CORS_ORIGIN=https://app.example.com
SENTRY_DSN=${SECRET_SENTRY_DSN}
API_GATEWAY_PORT=8080
WEBSOCKET_PORT=8081
```

## Quick Setup

### 1. Copy template

```bash
cp .env.development .env
```

### 2. Generate secrets

```bash
node scripts/generate-secrets.js
```

### 3. Update .env with generated secrets

### 4. Validate

```bash
node scripts/validate-env.js
```

### 5. Start services

```bash
npm run dev
```

## Common Patterns

### Database URLs

```bash
# Local PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dbname

# Cloud SQL (GCP)
DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance

# With SSL
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
```

### Cache Configuration

```bash
# PostgreSQL-based caching (uses indexed cache tables)
ENABLE_CACHING=true

# Cache TTL settings (in seconds)
CACHE_TTL_SHORT=300      # 5 minutes
CACHE_TTL_MEDIUM=3600    # 1 hour
CACHE_TTL_LONG=86400     # 24 hours
```

### Feature Flags

```bash
FEATURE_OAUTH_GOOGLE=true
FEATURE_VOICE_CLONING=true
FEATURE_FACE_CLONING=true
FEATURE_VIDEO_GENERATION=true
```

## Troubleshooting

### "Missing required variable"

- Check .env file exists
- Verify variable name spelling
- Ensure no spaces around `=`

### "Invalid token"

- Regenerate JWT secrets
- Check secret length (min 32 chars)
- Verify no special characters causing issues

### "Database connection failed"

- Verify PostgreSQL is running
- Check DATABASE_URL format
- Test connection: `psql $DATABASE_URL`

### "Caching not working"

- Verify ENABLE_CACHING is set to true
- Check database connection (caching uses PostgreSQL)
- Verify cache tables exist in database

## Security Checklist

- [ ] JWT_SECRET is at least 32 characters
- [ ] REFRESH_SECRET is different from JWT_SECRET
- [ ] Production secrets are not in .env file
- [ ] .env is in .gitignore
- [ ] CORS_ORIGIN is not `*` in production
- [ ] API docs disabled in production
- [ ] Debug endpoints disabled in production
- [ ] Database uses SSL in production
- [ ] Secrets stored in secret manager

## Resources

- Full documentation: `docs/ENVIRONMENT-SETUP.md`
- Example file: `.env.example`
- Validation script: `scripts/validate-env.js`
- Secret generator: `scripts/generate-secrets.js`

## Quick Commands

```bash
# Generate secrets
npm run generate-secrets

# Validate environment
npm run validate-env

# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm test
```
