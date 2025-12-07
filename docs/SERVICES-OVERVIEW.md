# Services Overview

Complete reference for all DigiTwin Live services and their purposes.

---

## 🏗️ Architecture Overview

DigiTwin Live uses a microservices architecture with three main categories:

1. **Core Applications** - User-facing applications
2. **Backend Services** - AI/ML processing services
3. **Shared Packages** - Common libraries and utilities

---

## 📱 Core Applications

### API Gateway (`apps/api-gateway`)

**Purpose**: REST API with OpenAPI documentation

**Key Features**:

- OpenAPI 3.0 specification with Swagger UI
- Request validation and sanitization
- Rate limiting per endpoint
- JWT authentication middleware
- CORS configuration
- Correlation ID tracking
- API versioning (v1, v2)

**Port**: 3000

**Endpoints**:

- `/api/v1/auth/*` - Authentication
- `/api/v1/documents/*` - Knowledge base management
- `/api/v1/conversations/*` - Conversation history
- `/api/v1/voice-models/*` - Voice model management
- `/api/v1/face-models/*` - Face model management
- `/health` - Health check
- `/docs` - API documentation

**Tech Stack**: Express, TypeScript, Zod, Swagger

---

### WebSocket Server (`apps/websocket-server`)

**Purpose**: Real-time bidirectional communication

**Key Features**:

- Audio streaming (chunked, 100ms)
- Session management
- Connection pooling
- JWT authentication
- Event-driven architecture
- Automatic reconnection
- Message queuing

**Port**: 3001

**Events**:

- `audio_chunk` - Audio data from client
- `transcript` - ASR results to client
- `response_start` - LLM response begins
- `response_chunk` - LLM response streaming
- `response_end` - LLM response complete
- `audio_response` - TTS audio chunks
- `video_ready` - Lip-sync video URL
- `error` - Error notifications

**Tech Stack**: Socket.io, TypeScript, Redis (session store)

---

### Mobile App (`apps/mobile-app`)

**Purpose**: iOS/Android client application

**Key Features**:

- Audio recording and playback
- WebSocket client integration
- Video player for lip-sync
- Offline support
- Push notifications
- Deep linking
- Face capture for model creation
- Voice sample recording

**Platforms**: iOS 13+, Android 8+

**Tech Stack**: React Native, Expo, TypeScript

---

## 🤖 Backend Services

### ASR Service (`services/asr-service`)

**Purpose**: Automatic Speech Recognition

**Provider**: Google Cloud Speech-to-Text (Chirp model)

**Key Features**:

- Streaming transcription
- Automatic punctuation
- Interim results
- Multi-language support (100+ languages)
- Confidence scoring
- Custom vocabulary
- Speaker diarization (optional)
- Profanity filtering (optional)

**Input**: Audio chunks (16 kHz, mono, 16-bit PCM)

**Output**: Transcribed text with confidence scores

**Performance**: < 500ms latency

**Tech Stack**: Node.js, Google Cloud Speech-to-Text API

---

### RAG Service (`services/rag-service`)

**Purpose**: Retrieval-Augmented Generation

**Key Features**:

- Document processing (PDF, DOCX, TXT, HTML, MD)
- Text chunking (500-1000 tokens, 100 token overlap)
- Embedding generation (Google text-embedding-004)
- Vector search with pgvector (cosine similarity > 0.7)
- Context assembly
- Knowledge base management
- Source tracking
- Hybrid search (vector + keyword)

**Components**:

- `EmbeddingService` - Generate embeddings
- `VectorSearchService` - Search vector database
- `TextChunker` - Chunk documents
- `ContextAssembler` - Assemble context for LLM
- `RAGOrchestrator` - Coordinate pipeline

**Database**: PostgreSQL with pgvector extension

**Tech Stack**: Node.js, Vertex AI, pgvector, Bull (job queue)

---

### LLM Service (`services/llm-service`)

**Purpose**: Multi-provider LLM integration

**Providers**:

- Google Gemini (primary)
- OpenAI GPT-4
- Groq (fast inference)

**Key Features**:

- Streaming responses
- Context management (last 10 turns)
- Token counting
- Rate limiting
- Fallback handling
- Temperature control
- System prompts
- Function calling

**Input**: User query + RAG context + conversation history

**Output**: Streaming text response

**Performance**: First token < 1s, streaming 50-100 tokens/s

**Tech Stack**: Node.js, Gemini API, OpenAI API, Groq API

---

### TTS Service (`services/tts-service`)

**Purpose**: Text-to-Speech orchestration

**Providers**:

- XTTS-v2 (voice cloning, primary)
- Google Cloud TTS (fallback)
- OpenAI TTS (fallback)

**Key Features**:

- Multi-provider orchestration
- Voice cloning from 6-30 second samples
- Audio format conversion
- Caching (PostgreSQL)
- Batch processing
- Quality optimization
- Fallback handling

**Input**: Text + voice model ID

**Output**: Audio chunks (16 kHz, mono, 16-bit PCM)

**Performance**: < 2s for first chunk

**Tech Stack**: Node.js, gRPC (XTTS communication)

---

### XTTS Service (`services/xtts-service`)

**Purpose**: XTTS-v2 inference server

**Key Features**:

- Docker-based deployment
- GPU acceleration (CUDA)
- Voice cloning from samples
- Batch processing
- Health monitoring
- Model caching
- Queue management

**Requirements**:

- NVIDIA GPU (8GB+ VRAM)
- CUDA 11.8+
- Docker with GPU support

**Input**: Text + voice sample embeddings

**Output**: High-quality audio (24 kHz)

**Performance**: 1-3s per sentence (GPU), 5-10s (CPU)

**Tech Stack**: Python, PyTorch, XTTS-v2, FastAPI

---

### Face Processing Service (`services/face-processing-service`)

**Purpose**: Face detection and model creation

**Key Features**:

- Face detection (MediaPipe, MTCNN)
- Face embedding generation (FaceNet, ArcFace)
- Face model creation (3-10 photos)
- Multi-face handling
- Quality assessment
- GCS storage integration
- Duplicate detection

**Input**: Images (JPEG, PNG)

**Output**: Face embeddings + metadata

**Performance**: < 1s per image

**Tech Stack**: Python, MediaPipe, TensorFlow, FastAPI

---

### Lip-sync Service (`services/lipsync-service`)

**Purpose**: Video generation with lip synchronization

**Models**:

- Wav2Lip (primary)
- SadTalker (alternative)

**Key Features**:

- Lip movement synchronization
- Audio-video alignment (< 50ms offset)
- Frame interpolation
- Quality optimization
- Batch processing
- GPU acceleration

**Input**: Face model + audio

**Output**: MP4 video with synchronized lips

**Performance**: 5-15s per 10s video (GPU)

**Tech Stack**: Python, PyTorch, Wav2Lip, FFmpeg

---

## 📦 Shared Packages

### @clone/shared-types

**Purpose**: TypeScript interfaces and types

**Exports**:

- User, Session, Document types
- API request/response types
- WebSocket message types
- Configuration types
- Enum definitions

---

### @clone/database

**Purpose**: Prisma ORM with repository pattern

**Features**:

- Prisma client
- Repository pattern implementations
- Migration management
- Seeding utilities
- Connection pooling

**Models**: User, ConversationSession, ConversationTurn, KnowledgeDocument, DocumentChunk, VoiceModel, FaceModel, AuditLog

---

### @clone/validation

**Purpose**: Zod validation schemas

**Schemas**:

- User input validation
- Document upload validation
- Audio chunk validation
- API request validation
- Configuration validation

---

### @clone/logger

**Purpose**: Winston structured logging

**Features**:

- Structured JSON logging
- Correlation ID tracking
- Log levels (error, warn, info, debug)
- File and console transports
- Log rotation

---

### @clone/errors

**Purpose**: Custom error classes

**Error Types**:

- `AppError` - Base error class
- `NotFoundError` - 404 errors
- `ValidationError` - 400 errors
- `UnauthorizedError` - 401 errors
- `RateLimitError` - 429 errors

---

### @clone/config

**Purpose**: Environment configuration management

**Features**:

- Environment variable loading
- Type-safe configuration
- Validation
- Default values
- Multi-environment support

---

### @clone/security

**Purpose**: Access control and audit logging

**Features**:

- Resource ownership verification
- Audit logging
- RBAC (Role-Based Access Control)
- Rate limiting
- Content safety checks

---

### @clone/api-client

**Purpose**: REST and WebSocket client libraries

**Features**:

- Type-safe API client
- WebSocket client with reconnection
- Request/response interceptors
- Error handling
- Retry logic

---

### @clone/utils

**Purpose**: Common utility functions

**Utilities**:

- String manipulation
- Date formatting
- File operations
- Crypto utilities
- Validation helpers

---

### @clone/constants

**Purpose**: Shared constants and enums

**Constants**:

- API endpoints
- Error codes
- Cache TTLs
- Rate limits
- File size limits

---

## 🔄 Service Communication

### Internal Communication (gRPC)

Services communicate internally using gRPC for performance:

- ASR → WebSocket Server
- RAG → LLM Service
- TTS → XTTS Service
- Face Processing → Lip-sync Service

### External Communication (REST/WebSocket)

Client applications use REST and WebSocket:

- Mobile App → API Gateway (REST)
- Mobile App → WebSocket Server (WebSocket)

### Event Bus (Pub/Sub)

Asynchronous events use Google Cloud Pub/Sub:

- `document.processed` - Document processing complete
- `voice.model.trained` - Voice model ready
- `face.model.created` - Face model ready
- `conversation.ended` - Conversation complete

---

## 🏃 Running Services

### Start All Services

```bash
pnpm dev
```

### Start Specific Service

```bash
pnpm --filter @clone/asr-service dev
pnpm --filter @clone/rag-service dev
pnpm --filter @clone/llm-service dev
```

### Build Service

```bash
pnpm --filter @clone/tts-service build
```

### Test Service

```bash
pnpm --filter @clone/face-processing-service test
```

---

## 📊 Service Dependencies

```
Mobile App
  ↓
API Gateway ← → WebSocket Server
  ↓                    ↓
  ├─ ASR Service ──────┘
  ├─ RAG Service
  ├─ LLM Service
  ├─ TTS Service → XTTS Service
  ├─ Face Processing Service
  └─ Lip-sync Service
```

---

## 🔍 Service Health Checks

All services expose health check endpoints:

```bash
# API Gateway
curl http://localhost:3000/health

# WebSocket Server
curl http://localhost:3001/health

# Individual Services
curl http://localhost:PORT/health
```

**Response**:

```json
{
  "status": "healthy",
  "service": "asr-service",
  "timestamp": "2024-12-06T10:00:00.000Z",
  "uptime": 3600
}
```

---

## 📈 Monitoring

Each service includes:

- Health check endpoints
- Structured logging
- Error tracking
- Performance metrics
- Resource usage monitoring

See [GCP Deployment Guide](./GCP-DEPLOYMENT-GUIDE.md) for production monitoring setup.

---

## 🔗 Related Documentation

- [Architecture Overview](../.kiro/specs/real-time-conversational-clone/design.md)
- [Conversation Flow Orchestration](./CONVERSATION-FLOW-ORCHESTRATION.md)
- [Database Architecture](./DATABASE-ARCHITECTURE.md)
- [GCP Deployment Guide](./GCP-DEPLOYMENT-GUIDE.md)
