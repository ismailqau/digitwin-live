# Getting Started

Quick guide to set up and run the Conversational Clone platform locally.

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 15+
- **Git**

## Quick Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd digitwin-live
npm install
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

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/digitwinline_dev
```

### 4. Validate Configuration

```bash
node scripts/validate-env.js
```

### 5. Start Development

```bash
# Start all services
npm run dev

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
npm run dev              # Start all services
npm run build            # Build for production
npm test                 # Run tests

# Utilities
node scripts/generate-secrets.js    # Generate secrets
node scripts/validate-env.js        # Validate config

# Database
createdb digitwinline_dev   # Create database
psql $DATABASE_URL                  # Connect to database
```

## Project Structure

```
digitwin-live/
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
