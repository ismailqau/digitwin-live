# Getting Started

Quick guide to set up and run the DigitWin Live platform locally.

## Prerequisites

Before starting, ensure you have these tools installed:

- **Node.js** 18+ (v20 recommended)
- **pnpm** 8+
- **PostgreSQL** 15+ (with pgvector extension) OR **Docker** (for Weaviate)
- **Git**

**📖 Need help installing?** See the [Tool Installation Guide](./TOOL-INSTALLATION.md) for detailed instructions for your platform.

## Quick Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd digitwinlive
pnpm install
```

### 2. Configure Environment

```bash
# Copy development environment template
cp .env.development .env

# Generate secure secrets
node scripts/generate-secrets.js

# Update .env with generated secrets
# Copy JWT_SECRET and REFRESH_SECRET values
```

### 3. Set Up Database

```bash
# Create database
createdb digitwinline_dev

# Run database migrations
pnpm db:migrate
pnpm db:generate

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://username@localhost:5432/digitwinline_dev
```

### 4. Set Up Vector Database

Choose one of the following options:

**Option A: PostgreSQL with pgvector (Recommended)**

```bash
# Install pgvector extension (see VECTOR-DATABASE-SETUP.md for details)
# Then enable in your database:
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Configure in .env:
VECTOR_DIMENSIONS=768
VECTOR_INDEX_LISTS=100
WEAVIATE_ENABLED=false
```

**Option B: Weaviate (Free Alternative)**

```bash
# Start Weaviate with Docker
docker run -d --name weaviate -p 8080:8080 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  semitechnologies/weaviate:latest

# Configure in .env:
WEAVIATE_URL=http://localhost:8080
WEAVIATE_ENABLED=true
```

**📖 Detailed Setup**: See [Vector Database Guide](./VECTOR-DATABASE.md)

### 5. Validate Configuration

```bash
node scripts/validate-env.js
```

### 6. Start Development

```bash
# Build all packages first
pnpm build

# Start all services
pnpm dev

# API Gateway: http://localhost:3000
# WebSocket Server: http://localhost:3001
# API Docs: http://localhost:3000/api-docs
```

## Test the API

```bash
# Register a user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Check health
curl http://localhost:3000/health
```

## Next Steps

- **[Environment Setup](./ENVIRONMENT-SETUP.md)** - Detailed configuration
- **[Vector Database](./VECTOR-DATABASE.md)** - Complete vector database guide
- **[Authentication Guide](../apps/api-gateway/docs/authentication-flow.md)** - Learn about auth
- **[API Documentation](http://localhost:3000/api-docs)** - Explore the API

## Troubleshooting

### Database Connection Failed

```bash
# Check if PostgreSQL is running
pg_isready

# Test connection
psql $DATABASE_URL
```

### Port Already in Use

```bash
# Change ports in .env
API_GATEWAY_PORT=3002
WEBSOCKET_PORT=3003
```

### Missing Environment Variables

```bash
# Validate configuration
node scripts/validate-env.js

# Check .env.example for required variables
cat .env.example
```

## Common Commands

```bash
# Development
pnpm dev                 # Start all services
pnpm build               # Build for production
pnpm test                # Run tests

# Code Quality
pnpm fix                 # Auto-fix ESLint, Prettier, and package.json sorting
pnpm lint                # Check linting
pnpm format              # Format code

# Utilities
node scripts/generate-secrets.js    # Generate secrets
node scripts/validate-env.js        # Validate config

# Database
createdb digitwinline_dev   # Create database
psql $DATABASE_URL                  # Connect to database
```

## Project Structure

```
digitwinlive/
├── apps/
│   ├── api-gateway/         # REST API
│   └── websocket-server/    # WebSocket server
├── packages/
│   ├── config/              # Shared configuration
│   ├── logger/              # Logging utilities
│   └── shared-types/        # TypeScript types
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
└── .env                     # Your configuration
```

## Need Help?

- Check [Documentation](./README.md)
- Review [Environment Setup](./ENVIRONMENT-SETUP.md)
- See [Troubleshooting Guide](./ENVIRONMENT-SETUP.md#troubleshooting)
