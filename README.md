# DigiTwin Live

Real-time conversational AI with voice cloning, face animation, and knowledge-based responses.

## Status

**⚠️ In Development** - Core infrastructure and deployment system complete. Services under active development.

### Completed

- ✅ GCP infrastructure setup and deployment scripts
- ✅ PostgreSQL with pgvector for vector storage
- ✅ Cloud Run deployment pipeline
- ✅ Database schema and migrations
- ✅ API Gateway foundation
- ✅ WebSocket server foundation

### In Progress

- 🔨 ASR, RAG, LLM, TTS service implementations
- 🔨 Face processing and lip-sync services
- 🔨 Mobile app development

## Tech Stack

- **Runtime**: Node.js 20, TypeScript
- **Database**: PostgreSQL 15+ with pgvector
- **Cloud**: GCP (Cloud Run, Cloud SQL, Cloud Storage)
- **Build**: Turborepo, pnpm workspaces
- **AI**: Google Chirp, Gemini, OpenAI, XTTS-v2

## Quick Start

### Prerequisites

- Node.js 20+, pnpm 8+
- PostgreSQL 15+ with pgvector
- Docker (for XTTS service)
- GCP account (for deployment)

### Local Development

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.development .env
node scripts/generate-secrets.js

# Set up database
createdb digitwinlive-db
psql digitwinlive-db -c "CREATE EXTENSION vector;"
pnpm db:migrate

# Start development
pnpm dev
```

### Deploy to GCP

```bash
# Set up infrastructure
./scripts/gcp-setup.sh

# Deploy services
./scripts/gcp-deploy.sh deploy --env=production
```

**📖 Full Guide**: [docs/GCP-DEPLOYMENT-GUIDE.md](./docs/GCP-DEPLOYMENT-GUIDE.md)

## Common Commands

```bash
# Development
pnpm install                              # Install dependencies
pnpm dev                                  # Start all services
pnpm build                                # Build all packages
pnpm test                                 # Run all tests
pnpm lint                                 # Lint code
pnpm type-check                           # Type check all packages

# Work with specific services
pnpm --filter @clone/api-gateway dev      # Run API Gateway
pnpm --filter @clone/asr-service test     # Test ASR service
pnpm --filter @clone/rag-service build    # Build RAG service

# Database
pnpm db:migrate                           # Run migrations
pnpm db:studio                            # Open Prisma Studio
pnpm db:seed                              # Seed database

# GCP Operations
pnpm gcp:setup                            # Set up GCP infrastructure
pnpm gcp:deploy                           # Deploy all services
pnpm gcp:status                           # Check service status
pnpm gcp:stop-all                         # Stop all services (save costs)
```

## Architecture

Microservices architecture deployed on GCP Cloud Run:

### Core Applications

- **API Gateway** (`apps/api-gateway`) - REST API with OpenAPI documentation, request validation, rate limiting
- **WebSocket Server** (`apps/websocket-server`) - Real-time bidirectional communication for audio streaming and conversation
- **Mobile App** (`apps/mobile-app`) - React Native app for iOS/Android with audio recording, playback, and video display

### Backend Services

- **ASR Service** (`services/asr-service`) - Automatic Speech Recognition using Google Chirp for real-time transcription
- **RAG Service** (`services/rag-service`) - Retrieval-Augmented Generation with pgvector for knowledge-based responses
- **LLM Service** (`services/llm-service`) - Multi-provider LLM integration (Gemini, OpenAI, Groq) with streaming support
- **TTS Service** (`services/tts-service`) - Text-to-Speech with voice cloning using XTTS-v2, Google Cloud TTS, OpenAI TTS
- **XTTS Service** (`services/xtts-service`) - Docker-based XTTS-v2 inference server for high-quality voice cloning
- **Face Processing Service** (`services/face-processing-service`) - Face detection, embedding generation, and model creation
- **Lip-sync Service** (`services/lipsync-service`) - Video generation with synchronized lip movements

### Shared Packages

- **@clone/shared-types** - TypeScript interfaces and types
- **@clone/database** - Prisma ORM with repository pattern
- **@clone/validation** - Zod schemas for input validation
- **@clone/logger** - Winston structured logging
- **@clone/errors** - Custom error classes and handling
- **@clone/config** - Environment configuration management
- **@clone/security** - Access control and audit logging

**Database**: PostgreSQL 15+ with pgvector (unified data + vector storage)  
**Caching**: PostgreSQL indexed cache tables (no Redis)

## Documentation

### Essential Guides

- [Services Overview](./docs/SERVICES-OVERVIEW.md) - All services and their purposes
- [GCP Deployment Guide](./docs/GCP-DEPLOYMENT-GUIDE.md) - Deploy to production
- [GCP Troubleshooting](./docs/GCP-TROUBLESHOOTING.md) - Common issues
- [Database Architecture](./docs/DATABASE-ARCHITECTURE.md) - Schema and patterns
- [Vector Database](./docs/VECTOR-DATABASE.md) - pgvector setup

### Development

- [Getting Started](./docs/GETTING-STARTED.md) - Local setup
- [Environment Setup](./docs/ENVIRONMENT-SETUP.md) - Configuration
- [Testing Guide](./docs/TESTING-GUIDE.md) - Testing practices
- [Code Quality Guide](./docs/CODE-QUALITY-GUIDE.md) - Standards

**📖 Full Documentation**: [docs/README.md](./docs/README.md)

## GCP Management

```bash
./scripts/gcp-setup.sh              # Set up infrastructure
./scripts/gcp-deploy.sh deploy      # Deploy services
./scripts/gcp-manage.sh status      # Check status
./scripts/gcp-manage.sh cost        # View costs
./scripts/gcp-cleanup.sh            # Clean up resources
```

## Project Structure

```
digitwinlive/
├── apps/           # Deployable applications (api-gateway, websocket-server, mobile-app)
├── services/       # Microservices (asr, rag, llm, tts, lipsync, face-processing)
├── packages/       # Shared libraries (@clone/* scope)
├── docs/           # Documentation
└── scripts/        # Automation scripts
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

[License information]
