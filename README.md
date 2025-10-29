# Conversational Clone System

A real-time conversational AI system that enables natural voice conversations with personalized digital twins, featuring voice cloning, face animation, and knowledge-based responses.

## 🏗️ Monorepo Structure

This project uses a monorepo architecture managed by Turborepo and pnpm workspaces.

```
conversational-clone/
├── apps/                      # Deployable applications
│   ├── mobile-app/           # React Native mobile app (iOS/Android)
│   ├── websocket-server/     # WebSocket server for real-time communication
│   └── api-gateway/          # REST API gateway with OpenAPI docs
├── services/                  # Backend microservices
│   ├── asr-service/          # Automatic Speech Recognition (Google Chirp)
│   ├── rag-service/          # Retrieval-Augmented Generation pipeline
│   ├── llm-service/          # LLM service (Gemini, OpenAI, Groq)
│   ├── tts-service/          # Text-to-Speech with voice cloning
│   ├── lipsync-service/      # Lip-sync video generation
│   └── face-processing-service/  # Face detection and model creation
├── packages/                  # Shared libraries
│   ├── shared-types/         # TypeScript types and interfaces
│   ├── api-client/           # REST and WebSocket client library
│   ├── database/             # Database layer with Prisma ORM
│   ├── validation/           # Zod validation schemas
│   ├── config/               # Environment configuration
│   ├── logger/               # Structured logging (Winston)
│   ├── errors/               # Custom error classes
│   ├── utils/                # Common utilities
│   └── constants/            # Shared constants
├── infrastructure/            # Terraform and deployment configs
├── docs/                      # Documentation
└── scripts/                   # Automation scripts
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 15+
- **pnpm** 8+

### Installation

```bash
# 1. Clone and install
git clone <repository-url>
cd conversational-clone
pnpm install

# 2. Set up environment
cp .env.development .env
node scripts/generate-secrets.js
# Copy generated secrets to .env

# 3. Create database
createdb conversational_clone_dev

# 4. Validate and start
node scripts/validate-env.js
pnpm dev
```

**📖 Detailed Guide**: See [Getting Started](./docs/GETTING-STARTED.md)

## 📦 Monorepo Structure

This project uses **Turborepo** and **pnpm workspaces** for efficient monorepo management.

### Package Organization

- **`apps/`** - Deployable applications (mobile-app, api-gateway, websocket-server)
- **`services/`** - Backend microservices (asr, rag, llm, tts, lipsync, face-processing)
- **`packages/`** - Shared libraries (shared-types, logger, config, validation, etc.)

All internal packages use the `@clone/` scope (e.g., `@clone/shared-types`).

### Common Commands

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run specific package
pnpm --filter @clone/websocket-server dev

# Add dependency to package
pnpm --filter @clone/api-gateway add express
```

**📖 Detailed Guide**: See [Monorepo Development](./docs/MONOREPO-DEVELOPMENT.md)

## 🔨 Development

### Build all packages
```bash
pnpm build
```

### Run tests
```bash
pnpm test
```

### Lint code
```bash
pnpm lint
```

### Format code
```bash
pnpm format
```

### Type check
```bash
pnpm type-check
```

### Clean build artifacts
```bash
pnpm clean
```

## 🏛️ Architecture

The system follows a microservices architecture with the following key components:

1. **Mobile App**: React Native application for iOS and Android
2. **WebSocket Server**: Handles real-time bidirectional communication
3. **API Gateway**: REST API with OpenAPI documentation
4. **ASR Service**: Converts speech to text using Google Chirp
5. **RAG Service**: Retrieves relevant knowledge from vector database
6. **LLM Service**: Generates contextual responses using multiple LLM providers
7. **TTS Service**: Synthesizes speech in user's cloned voice
8. **Lip-sync Service**: Generates synchronized video frames
9. **Face Processing Service**: Creates face models from photos/videos

### Technology Stack

- **Frontend**: React Native, TypeScript
- **Backend**: Node.js, TypeScript, Express, Socket.io
- **AI Services**: Google Chirp, Gemini, OpenAI, Groq, XTTS-v2
- **Infrastructure**: Google Cloud Platform (Cloud Run, GKE, Cloud SQL)
- **Vector Database**: Pinecone
- **Caching**: PostgreSQL (indexed cache tables)
- **Build Tool**: Turborepo
- **Package Manager**: pnpm

## 📚 Documentation

### Getting Started
- **[Getting Started Guide](./docs/GETTING-STARTED.md)** - Quick setup guide
- **[Environment Setup](./docs/ENVIRONMENT-SETUP.md)** - Comprehensive configuration

### Configuration
- **[Environment Setup](./docs/ENVIRONMENT-SETUP.md)** - Comprehensive setup guide
- **[Quick Reference](./docs/ENV-QUICK-REFERENCE.md)** - Environment variables cheat sheet
- **[Caching Architecture](./docs/CACHING-ARCHITECTURE.md)** - PostgreSQL-based caching
- **[Database Architecture](./docs/DATABASE-ARCHITECTURE.md)** - Database schema and repository pattern

### Security & Authentication
- **[Authentication Flow](./apps/api-gateway/docs/authentication-flow.md)** - JWT & OAuth guide
- **[RBAC Guide](./apps/api-gateway/docs/RBAC-GUIDE.md)** - Role-based access control

### Development
- **[Scripts Documentation](./scripts/README.md)** - Utility scripts
- **[API Documentation](http://localhost:3000/api-docs)** - OpenAPI docs (when running)

### Architecture
- **[Design Document](./.kiro/specs/real-time-conversational-clone/design.md)** - Complete system design
- **[Event-Driven Architecture](./docs/EVENT-DRIVEN-ARCHITECTURE.md)** - Event bus and event sourcing
- **[CQRS Architecture](./docs/CQRS-ARCHITECTURE.md)** - Command Query Responsibility Segregation
- **[Database Architecture](./docs/DATABASE-ARCHITECTURE.md)** - Database schema and repository pattern
- **[Implementation Summary](./apps/api-gateway/docs/IMPLEMENTATION-SUMMARY.md)** - What's implemented

**📁 All Documentation**: See [docs/](./docs/README.md) | [Documentation Index](./docs/INDEX.md)

## 🧪 Testing

### Run all tests
```bash
pnpm test
```

### Run tests for a specific package
```bash
pnpm --filter @clone/websocket-server test
```

### Run tests in watch mode
```bash
pnpm --filter @clone/shared-types test --watch
```

## 🚢 Deployment

### Build for production
```bash
pnpm build
```

### Deploy to staging
```bash
./scripts/deploy.sh staging
```

### Deploy to production
```bash
./scripts/deploy.sh production
```

See [Deployment Guide](docs/deployment/guide.md) for detailed instructions.

## 🔧 Configuration

### Essential Environment Variables

```bash
# Authentication
JWT_SECRET=<generated-secret>
REFRESH_SECRET=<generated-secret>

# Database (includes caching)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Application
NODE_ENV=development
API_GATEWAY_PORT=3000
WEBSOCKET_PORT=3001

# Caching (PostgreSQL-based)
ENABLE_CACHING=true
```

**📖 Complete Reference**: See [Environment Variables Guide](./ENVIRONMENT-VARIABLES.md)

### Utility Scripts

```bash
node scripts/generate-secrets.js    # Generate secure secrets
node scripts/validate-env.js        # Validate configuration
```

**📖 Scripts Guide**: See [scripts/README.md](./scripts/README.md)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

[License information]

## 🆘 Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: [docs-url]
- Email: support@example.com
