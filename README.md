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

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Google Cloud Platform account
- API keys for AI services (Google, OpenAI, Groq)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd conversational-clone
```

2. Run the setup script:
```bash
chmod +x scripts/*.sh
./scripts/setup.sh
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Start development servers:
```bash
pnpm dev
```

## 📦 Package Management

This monorepo uses pnpm workspaces for dependency management.

### Install dependencies
```bash
pnpm install
```

### Add a dependency to a specific package
```bash
pnpm --filter @clone/websocket-server add express
```

### Add a dev dependency
```bash
pnpm --filter @clone/shared-types add -D jest
```

### Run commands in specific packages
```bash
pnpm --filter @clone/websocket-server dev
pnpm --filter @clone/mobile-app build
```

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
- **Caching**: Redis
- **Build Tool**: Turborepo
- **Package Manager**: pnpm

## 📚 Documentation

- [Architecture Overview](docs/architecture/overview.md)
- [API Reference](docs/api/reference.md)
- [Getting Started Guide](docs/guides/getting-started.md)
- [Deployment Guide](docs/deployment/guide.md)

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

### Environment Variables

Key environment variables (see `.env.example` for complete list):

- `GCP_PROJECT_ID`: Google Cloud Platform project ID
- `GCP_REGION`: GCP region (default: us-central1)
- `JWT_SECRET`: Secret for JWT token signing
- `REDIS_URL`: Redis connection URL
- `DATABASE_URL`: PostgreSQL connection URL
- `GOOGLE_CLOUD_API_KEY`: Google Cloud API key
- `OPENAI_API_KEY`: OpenAI API key
- `GROQ_API_KEY`: Groq API key
- `PINECONE_API_KEY`: Pinecone API key

### Turborepo Configuration

Turborepo is configured in `turbo.json` with the following pipelines:

- `build`: Builds all packages with dependency ordering
- `test`: Runs tests after building
- `lint`: Lints code
- `type-check`: Type checks TypeScript
- `dev`: Starts development servers

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
