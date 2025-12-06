# DigiTwin Live

A real-time conversational AI system that enables natural voice conversations with personalized digital twins, featuring voice cloning, face animation, and knowledge-based responses.

## 🏗️ Monorepo Structure

This project uses a monorepo architecture managed by Turborepo and pnpm workspaces.

```
digitwinlive/
├── apps/                      # Deployable applications
│   ├── mobile-app/           # React Native mobile app (iOS/Android)
│   ├── websocket-server/     # WebSocket server for real-time communication
│   └── api-gateway/          # REST API gateway with OpenAPI docs
├── services/                  # Backend microservices
│   ├── asr-service/          # Automatic Speech Recognition (Google Chirp)
│   ├── rag-service/          # Retrieval-Augmented Generation pipeline
│   ├── llm-service/          # LLM service (Gemini, OpenAI, Groq)
│   ├── tts-service/          # Text-to-Speech with voice cloning
│   ├── xtts-service/         # XTTS-v2 Docker service for voice synthesis
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

### Automated Setup (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd digitwinlive

# Run complete setup
./scripts/setup-all.sh
```

**📖 Complete Guide**: See [docs/SETUP.md](./docs/SETUP.md) for detailed instructions.

### Manual Setup

**Prerequisites:**

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **pnpm** 8+ ([Install](https://pnpm.io/installation))
- **PostgreSQL** 15+ with pgvector extension
- **Windows users**: WSL or Git Bash recommended for shell scripts ([Setup Guide](./docs/CROSS-PLATFORM.md))

**Installation:**

```bash
# 1. Clone and install
git clone <repository-url>
cd digitwinlive

pnpm install

# 2. Verify directory structure (optional)
./scripts/verify-directory-structure.sh

# 3. Set up environment
cp .env.development .env
node scripts/generate-secrets.js
# Copy generated secrets to .env

# 4. Set up database
createdb digitwinlive-db
pnpm db:migrate
pnpm db:generate

# 5. Set up vector database
# PostgreSQL with pgvector extension
# See docs/VECTOR-DATABASE.md for pgvector installation

# 6. Set up XTTS service (for voice cloning)
cd services/xtts-service
./setup.sh  # Automatically detects platform and sets up Docker container
cd ../..

# 7. Validate and start
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

### Fix all issues (recommended)

```bash
# Auto-fix ESLint, Prettier, and package.json sorting
pnpm fix
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
8. **XTTS Service**: Self-hosted XTTS-v2 Docker service for voice synthesis
9. **Lip-sync Service**: Generates synchronized video frames
10. **Face Processing Service**: Creates face models from photos/videos

### Technology Stack

- **Frontend**: React Native, TypeScript
- **Backend**: Node.js, TypeScript, Express, Socket.io
- **AI Services**: Google Chirp, Gemini, OpenAI, Groq, XTTS-v2
- **Infrastructure**: Google Cloud Platform (Cloud Run, Cloud SQL)
- **Vector Database**: PostgreSQL with pgvector extension
- **Caching**: PostgreSQL (indexed cache tables)
- **Build Tool**: Turborepo
- **Package Manager**: pnpm

## 📚 Documentation

### 🚀 Getting Started

- **[Getting Started Guide](./docs/GETTING-STARTED.md)** - 5-step quick setup
- **[Tool Installation](./docs/TOOL-INSTALLATION.md)** - Install Node.js, PostgreSQL, etc.
- **[Environment Setup](./docs/ENVIRONMENT-SETUP.md)** - Complete configuration guide
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Known Issues](./docs/KNOWN-ISSUES.md)** - Deprecated dependencies and workarounds

### ☁️ GCP & Infrastructure

- **[GCP Deployment Guide](./docs/GCP-DEPLOYMENT-GUIDE.md)** - Complete deployment walkthrough with pgvector setup
- **[GCP Troubleshooting](./docs/GCP-TROUBLESHOOTING.md)** - Common issues and solutions
- **[GCP Rollback Procedures](./docs/GCP-ROLLBACK-PROCEDURES.md)** - Emergency rollback and recovery
- **[GCP Management](./docs/GCP-MANAGEMENT.md)** - Complete GCP resource management
- **[GCP Quick Reference](./docs/GCP-QUICK-REFERENCE.md)** - Command cheat sheet
- **[GCP Cleanup Guide](./docs/GCP-CLEANUP-GUIDE.md)** - Delete and manage resources
- **[GCP Infrastructure](./docs/GCP-INFRASTRUCTURE.md)** - Infrastructure architecture
- **[Monitoring & Alerting](./docs/MONITORING.md)** - Minimal monitoring setup with email & Discord alerts
- **[Terraform Backend](./infrastructure/terraform/BACKEND.md)** - Terraform state management

### 🗄️ Database & Storage

- **[Vector Database](./docs/VECTOR-DATABASE.md)** - PostgreSQL + pgvector setup
- **[Database Architecture](./docs/DATABASE-ARCHITECTURE.md)** - Schema and repository pattern
- **[Caching Architecture](./docs/CACHING-ARCHITECTURE.md)** - PostgreSQL-based caching
- **[Performance Optimization](./docs/PERFORMANCE-OPTIMIZATION.md)** - Caching, API optimization, background jobs, and network optimization
- **[Document Processing](./docs/DOCUMENT-PROCESSING.md)** - Document upload, extraction, and embedding
- **[Knowledge Base API](./docs/KNOWLEDGE-BASE-API.md)** - REST API for documents, FAQs, and knowledge sources
- **[RAG Query Optimization](./docs/RAG-QUERY-OPTIMIZATION.md)** - Query preprocessing, hybrid search, and analytics
- **[RAG Source Tracking](./docs/RAG-SOURCE-TRACKING.md)** - Source metadata, analytics, and conversation tracking

### 🔐 Security & Authentication

- **[Security & Access Controls](./docs/SECURITY-ACCESS-CONTROLS.md)** - User data isolation, audit logging, and data retention
- **[Authentication Flow](./apps/api-gateway/docs/authentication-flow.md)** - JWT & OAuth
- **[RBAC Guide](./apps/api-gateway/docs/RBAC-GUIDE.md)** - Role-based access control
- **[Rate Limiting](./docs/RATE-LIMITING.md)** - Usage controls and subscription tiers
- **[API Validation & Content Safety](./docs/API-VALIDATION-CONTENT-SAFETY.md)** - Input sanitization, content filtering, and file validation

### 🏗️ Architecture

- **[Design Document](./.kiro/specs/real-time-conversational-clone/design.md)** - System design
- **[Conversation Flow Orchestration](./docs/CONVERSATION-FLOW-ORCHESTRATION.md)** - End-to-end pipeline coordination (Audio → ASR → RAG → LLM → TTS → Lip-sync)
- **[Conversation State Management](./docs/CONVERSATION-STATE-MANAGEMENT.md)** - State machine, session management, and WebSocket events
- **[Interruption Handling](./docs/INTERRUPTION-HANDLING.md)** - Natural conversation interruptions with VAD-based detection
- **[Error Handling](./docs/ERROR-HANDLING.md)** - Centralized error handling, error codes, and user-friendly messages
- **[Event-Driven Architecture](./docs/EVENT-DRIVEN-ARCHITECTURE.md)** - Event bus
- **[CQRS Architecture](./docs/CQRS-ARCHITECTURE.md)** - Command Query separation
- **[Microservices Communication](./docs/microservices-communication.md)** - gRPC & service discovery

### 🛠️ Development

- **[Monorepo Development](./docs/MONOREPO-DEVELOPMENT.md)** - Turborepo & pnpm guide
- **[Code Quality Guide](./docs/CODE-QUALITY-GUIDE.md)** - Linting, testing, and best practices
- **[Testing Guide](./docs/TESTING-GUIDE.md)** - Comprehensive testing guide
- **[Scripts Documentation](./scripts/README.md)** - Utility scripts
- **[API Documentation](http://localhost:3000/docs)** - OpenAPI docs (when running)

### 🎤 Audio & Speech Processing

- **[Audio Processing](./docs/AUDIO-PROCESSING.md)** - Audio capture, streaming, and ASR integration
- **[Audio Preprocessing](./docs/AUDIO-PREPROCESSING.md)** - Audio enhancement and quality optimization
- **[Audio Caching & Storage](./docs/AUDIO-CACHING-STORAGE.md)** - Audio chunk caching and GCS archival
- **[ASR Service](./docs/ASR-SERVICE.md)** - Google Chirp speech-to-text integration
- **[Voice Sample Recording](./docs/VOICE-SAMPLE-RECORDING.md)** - Voice sample recording, validation, and voice model training
- **[Voice Model Training](./docs/VOICE-MODEL-TRAINING.md)** - Complete voice model training pipeline with BullMQ, cost estimation, and multi-provider support
- **[Voice Model Management](./docs/VOICE-MODEL-MANAGEMENT.md)** - CRUD operations, analytics, backup/restore, and lifecycle management
- **[XTTS Service](./docs/XTTS-SERVICE.md)** - Self-hosted XTTS-v2 Docker service setup and configuration
- **[Multi-Provider TTS](./docs/TTS-MULTI-PROVIDER.md)** - Text-to-Speech with XTTS-v2, OpenAI, Google Cloud, and ElevenLabs
- **[TTS Optimization & Caching](./docs/TTS-OPTIMIZATION-CACHING.md)** - TTS result caching, deduplication, pregeneration, streaming optimization, and cost optimization

### 🤖 AI & Language Models

- **[LLM Service Guide](./docs/LLM-SERVICE-GUIDE.md)** - Multi-provider LLM integration (Gemini, OpenAI, Groq)

### 👤 Face Processing

- **[Face Processing](./docs/FACE-PROCESSING.md)** - Face detection, embedding, and identity management

**📖 Complete Documentation**: [docs/README.md](./docs/README.md)

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

### Quick Deployment to GCP

Deploy to Google Cloud Platform using Cloud Run and Cloud SQL:

```bash
# 1. Set up GCP infrastructure
./scripts/gcp-setup.sh

# 2. Enable pgvector extension in Cloud SQL
# (See deployment guide for detailed instructions)

# 3. Run database migrations
pnpm db:migrate:deploy

# 4. Deploy all services
./scripts/gcp-deploy.sh deploy --env=production
```

**📖 Complete Guide**: See [GCP Deployment Guide](./docs/GCP-DEPLOYMENT-GUIDE.md) for:

- Step-by-step setup instructions
- PostgreSQL with pgvector configuration
- Troubleshooting common issues
- Rollback procedures
- Cost optimization tips

### Infrastructure Management

```bash
# Check status of all resources
./scripts/gcp-manage.sh status

# View estimated costs
./scripts/gcp-manage.sh cost

# Stop resources to save costs
./scripts/gcp-manage.sh stop sql-instance

# Clean up resources
./scripts/gcp-cleanup.sh
```

**📖 Management Guide**: See [GCP Management](./docs/GCP-MANAGEMENT.md)

## 🔧 Configuration

### Essential Environment Variables

```bash
# Authentication
JWT_SECRET=<generated-secret>
REFRESH_SECRET=<generated-secret>

# Database (includes caching and vector storage)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Vector Database (choose one)
# Option A: PostgreSQL with pgvector (uses DATABASE_URL above)
VECTOR_DIMENSIONS=768
VECTOR_INDEX_LISTS=100

# Application
NODE_ENV=development
API_GATEWAY_PORT=3000
WEBSOCKET_PORT=3001

# XTTS Service (Voice Synthesis)
XTTS_SERVICE_URL=http://localhost:8000
XTTS_GPU_ENABLED=true

# Caching (PostgreSQL-based)
ENABLE_CACHING=true
```

**📖 Complete Reference**: See [docs/ENVIRONMENT-SETUP.md](./docs/ENVIRONMENT-SETUP.md)

### Utility Scripts

```bash
node scripts/generate-secrets.js    # Generate secure secrets
node scripts/validate-env.js        # Validate configuration
```

**📖 Scripts Guide**: See [scripts/README.md](./scripts/README.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Setting up your development environment
- Code standards and style guidelines
- Testing requirements
- Pull request process
- Commit message conventions

**Quick Start for Contributors:**

```bash
# Fork and clone the repository
git clone https://github.com/your-username/digitwinlive.git
cd digitwinlive

# Install dependencies and setup
pnpm install
./scripts/setup-all.sh

# Create a feature branch
git checkout -b feature/your-feature

# Make changes, test, and commit
pnpm validate
git commit -m "feat(scope): your changes"

# Push and create PR
git push origin feature/your-feature
```

**📖 Full Guide**: See [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📄 License

[License information]

## 🆘 Support

For issues and questions:

- **Documentation**: [docs/](./docs/) - Complete documentation
- **GitHub Issues**: [repository-url]/issues - Bug reports and feature requests
- **Contributing**: [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute
- **Email**: support@example.com
