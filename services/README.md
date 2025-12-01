# Services

This directory contains all the backend microservices for the DigitWin Live platform.

## 🏗️ Service Architecture

Each service is designed to be:

- **Independent** - Can be developed, tested, and deployed separately
- **Scalable** - Horizontally scalable based on demand
- **Resilient** - Fault-tolerant with proper error handling
- **Observable** - Comprehensive logging and monitoring

## 📦 Available Services

### Core Services

| Service                                                   | Description                                           | Technology          | Port | Status            |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------- | ---- | ----------------- |
| **[asr-service](./asr-service/)**                         | Automatic Speech Recognition using Google Chirp       | Node.js, TypeScript | 3002 | ✅ Active         |
| **[rag-service](./rag-service/)**                         | Retrieval-Augmented Generation pipeline               | Node.js, TypeScript | 3003 | ✅ Active         |
| **[llm-service](./llm-service/)**                         | Multi-provider LLM integration (Gemini, OpenAI, Groq) | Node.js, TypeScript | 3004 | ✅ Active         |
| **[tts-service](./tts-service/)**                         | Text-to-Speech with voice cloning support             | Node.js, TypeScript | 3005 | ✅ Active         |
| **[lipsync-service](./lipsync-service/)**                 | Lip-sync video generation                             | Python, FastAPI     | 3006 | 🚧 In Development |
| **[face-processing-service](./face-processing-service/)** | Face detection and model creation                     | Python, FastAPI     | 3007 | 🚧 In Development |

### Supporting Services

| Service                             | Description                        | Technology              | Port | Status    |
| ----------------------------------- | ---------------------------------- | ----------------------- | ---- | --------- |
| **[xtts-service](./xtts-service/)** | Self-hosted XTTS-v2 Docker service | Python, FastAPI, Docker | 8000 | ✅ Active |

## 🚀 Quick Start

### Start All Services

```bash
# From project root
pnpm dev

# Or start specific services
pnpm --filter @clone/asr-service dev
pnpm --filter @clone/tts-service dev
```

### Start XTTS Service

```bash
# Navigate to XTTS service
cd services/xtts-service

# Run universal setup (detects platform automatically)
./setup.sh

# Test the service
./test.sh
```

## 🔧 Service Configuration

### Environment Variables

Each service requires specific environment variables. See individual service READMEs for details.

#### Common Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Logging
LOG_LEVEL=info
NODE_ENV=development

# Service Discovery
SERVICE_REGISTRY_URL=http://localhost:8500
```

#### Service-Specific Variables

```bash
# ASR Service
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# LLM Service
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
GROQ_API_KEY=gsk_...

# TTS Service
XTTS_SERVICE_URL=http://localhost:8000
ELEVENLABS_API_KEY=...

# RAG Service (uses PostgreSQL with pgvector)
VECTOR_DIMENSIONS=768
```

## 📊 Service Dependencies

```mermaid
graph TD
    A[Mobile App] --> B[WebSocket Server]
    A --> C[API Gateway]

    B --> D[ASR Service]
    B --> E[RAG Service]
    B --> F[LLM Service]
    B --> G[TTS Service]
    B --> H[Lipsync Service]

    D --> I[Google Chirp API]
    E --> J[Vector Database]
    F --> K[LLM Providers]
    G --> L[XTTS Service]
    G --> M[TTS Providers]
    H --> N[Face Processing Service]

    L --> O[XTTS-v2 Model]
    J --> P[(PostgreSQL + pgvector)]
```

## 🔍 Service Details

### ASR Service

- **Purpose**: Convert speech to text
- **Provider**: Google Chirp (Whisper alternative)
- **Features**: Real-time streaming, multiple languages
- **Documentation**: [ASR Service README](./asr-service/README.md)

### RAG Service

- **Purpose**: Retrieve relevant knowledge for LLM context
- **Features**: Vector search, hybrid search, source tracking
- **Database**: PostgreSQL with pgvector
- **Documentation**: [RAG Service README](./rag-service/README.md)

### LLM Service

- **Purpose**: Generate contextual responses
- **Providers**: Gemini, OpenAI, Groq
- **Features**: Multi-provider fallback, cost optimization
- **Documentation**: [LLM Service README](./llm-service/README.md)

### TTS Service

- **Purpose**: Synthesize speech with voice cloning
- **Providers**: XTTS-v2, OpenAI TTS, Google Cloud TTS, ElevenLabs
- **Features**: Voice cloning, multi-provider support, caching
- **Documentation**: [TTS Service README](./tts-service/README.md)

### XTTS Service

- **Purpose**: Self-hosted voice synthesis
- **Technology**: XTTS-v2 model in Docker
- **Features**: Cross-platform, GPU acceleration, voice cloning
- **Documentation**: [XTTS Service README](./xtts-service/README.md)

### Lipsync Service (In Development)

- **Purpose**: Generate lip-sync video frames
- **Technology**: Python, computer vision
- **Features**: Real-time lip-sync, face animation
- **Status**: 🚧 In Development

### Face Processing Service (In Development)

- **Purpose**: Face detection and model creation
- **Technology**: Python, machine learning
- **Features**: Face detection, 3D model generation
- **Status**: 🚧 In Development

## 🧪 Testing

### Test All Services

```bash
# Run all service tests
pnpm test

# Test specific service
pnpm --filter @clone/tts-service test
```

### Test XTTS Service

```bash
cd services/xtts-service
./test.sh
```

### Integration Testing

```bash
# Run integration tests across services
pnpm test:integration
```

## 📈 Monitoring & Observability

### Health Checks

Each service exposes a health check endpoint:

```bash
# Check service health
curl http://localhost:3002/health  # ASR Service
curl http://localhost:3003/health  # RAG Service
curl http://localhost:3004/health  # LLM Service
curl http://localhost:3005/health  # TTS Service
curl http://localhost:8000/health  # XTTS Service
```

### Metrics

Services expose Prometheus metrics at `/metrics` endpoint.

### Logging

All services use structured logging with Winston:

- **Development**: Console output with colors
- **Production**: JSON format for log aggregation

## 🚢 Deployment

### Development

```bash
# Start all services in development mode
pnpm dev
```

### Production

```bash
# Build all services
pnpm build

# Deploy to GCP Cloud Run
./scripts/deploy.sh production
```

### Docker Deployment

```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d
```

## 🔧 Development Guidelines

### Adding a New Service

1. **Create service directory**

   ```bash
   mkdir services/new-service
   cd services/new-service
   ```

2. **Initialize package.json**

   ```bash
   npm init -y
   # Update package.json with @clone/new-service name
   ```

3. **Add to workspace**

   ```json
   // In root package.json
   "workspaces": [
     "services/new-service"
   ]
   ```

4. **Follow service patterns**
   - Use TypeScript
   - Include health check endpoint
   - Add comprehensive logging
   - Include tests
   - Document API endpoints

5. **Update documentation**
   - Add to this README
   - Create service-specific README
   - Update architecture diagrams

### Service Communication

Services communicate via:

- **HTTP/REST** - For synchronous operations
- **WebSocket** - For real-time communication
- **Event Bus** - For asynchronous events
- **gRPC** - For high-performance internal communication

### Error Handling

All services should:

- Use structured error responses
- Implement proper HTTP status codes
- Log errors with context
- Provide meaningful error messages
- Implement circuit breakers for external dependencies

## 📚 Related Documentation

- **[Architecture Overview](../docs/DESIGN-DOCUMENT.md)** - System architecture
- **[API Gateway](../apps/api-gateway/README.md)** - REST API documentation
- **[WebSocket Server](../apps/websocket-server/README.md)** - Real-time communication
- **[Database Architecture](../docs/DATABASE-ARCHITECTURE.md)** - Data layer design
- **[Deployment Guide](../infrastructure/README.md)** - Infrastructure setup

## 🤝 Contributing

When contributing to services:

1. **Follow coding standards** - ESLint, Prettier, TypeScript
2. **Write tests** - Unit tests and integration tests
3. **Document APIs** - OpenAPI/Swagger documentation
4. **Update README** - Keep service documentation current
5. **Add monitoring** - Health checks and metrics

## 📄 License

All services are part of the DigitWin Live platform and follow the same licensing terms.
