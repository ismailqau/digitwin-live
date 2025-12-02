# Implementation Plan

## � CRITeICAL STATUS UPDATE

**Last Updated:** December 1, 2024

### Current Implementation Status

**✅ COMPLETED (Phases 1-7):**

- Monorepo infrastructure and tooling
- GCP infrastructure with management scripts
- Database schema (PostgreSQL with pgvector)
- All backend services implemented:
  - ASR Service (Google Chirp integration)
  - RAG Service (vector search, document processing)
  - LLM Service (multi-provider support)
  - TTS Service (multi-provider voice cloning)
  - Face Processing Service (face detection, embeddings)
  - Lip-sync Service (video generation)
- WebSocket Server foundation
- API Gateway foundation
- Authentication and authorization
- Event-driven architecture (CQRS, Saga)
- Face model creation pipeline

**🚧 IN PROGRESS (Phase 9):**

- Conversation flow orchestration (partially implemented)
- End-to-end integration testing needed

**❌ NOT STARTED (Critical for MVP):**

- **Phase 3: Mobile App** - EMPTY, needs full implementation
  - Audio capture and streaming
  - Audio/video playback
  - WebSocket client
  - All UI screens
- **Phase 10-12:** Performance optimization, caching integration, monitoring

### Next Steps (Priority Order)

1. **CRITICAL:** Implement mobile app (Phase 13) - Without this, users cannot interact with the system
2. **HIGH:** Complete conversation flow orchestration (Phase 9.2)
3. **MEDIUM:** Integrate caching into services (Phase 10)
4. **MEDIUM:** Implement error handling and security (Phase 11)
5. **LOW:** Add monitoring and observability (Phase 12)

## 📋 Current Setup Status

### ✅ Completed Infrastructure

- **Monorepo**: Turborepo + pnpm workspaces configured
- **GCP Management**: Complete script-based management system
  - Scripts: `gcp-setup.sh`, `gcp-create-sql.sh`, `gcp-manage.sh`, `gcp-cleanup.sh`
  - Commands: `pnpm gcp:setup`, `pnpm gcp:status`, `pnpm gcp:cleanup-sql`, `pnpm gcp:stop-all`
- **Database**: PostgreSQL 17 with pgvector extension on Cloud SQL
- **Vector Database**: PostgreSQL with pgvector extension
- **Caching**: PostgreSQL-based caching architecture (NOT Redis)
- **Storage**: 4 GCS buckets configured (voice-models, face-models, documents, uploads)
- **Authentication**: JWT-based auth with RBAC implemented
- **Documentation**: Comprehensive docs in `/docs` with clean structure

### 📚 Key Documentation

- **[GCP Management](../docs/GCP-MANAGEMENT.md)** - Complete GCP resource management
- **[GCP Quick Reference](../docs/GCP-QUICK-REFERENCE.md)** - Command cheat sheet
- **[GCP Cleanup Guide](../docs/GCP-CLEANUP-GUIDE.md)** - Resource cleanup and cost optimization
- **[Vector Database](../docs/VECTOR-DATABASE.md)** - PostgreSQL with pgvector setup
- **[Caching Architecture](../docs/CACHING-ARCHITECTURE.md)** - PostgreSQL caching (NOT Redis)
- **[Database Architecture](../docs/DATABASE-ARCHITECTURE.md)** - Schema and repository pattern
- **[Getting Started](../docs/GETTING-STARTED.md)** - Quick setup guide

### 🎯 Implementation Guidelines

1. **Use PostgreSQL for caching** - NOT Redis or Memcached (see docs/CACHING-SUMMARY.md)
2. **Use GCP scripts** - All GCP operations via bash scripts (Terraform optional)
3. **Vector database** - Use PostgreSQL with pgvector extension for all vector operations
4. **Documentation** - Update docs/ with proper links, avoid redundancy
5. **Cost optimization** - Use `pnpm gcp:stop-all` to save ~$74/month when not in use

---

## Phase 1: Monorepo Setup and Infrastructure

- [x] 1. Design and initialize monorepo structure
  - Research and select monorepo tool (Turborepo recommended for TypeScript projects)
  - Design optimal directory structure for microservices, mobile app, shared libraries, and infrastructure
  - Create root package.json with workspace configuration (pnpm or yarn workspaces)
  - Set up shared TypeScript configuration with path aliases
  - Configure shared ESLint, Prettier, and code quality tools
  - Create shared utility packages (types, constants, validation schemas)
  - Set up monorepo build orchestration and caching
  - Configure dependency management and hoisting strategy
  - Create development scripts for running multiple services
  - Document monorepo structure and conventions
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 1.1 Create monorepo package structure
  - Create `apps/` directory for deployable applications (mobile-app, websocket-server, api-gateway)
  - Create `services/` directory for backend microservices (asr-service, rag-service, llm-service, tts-service, lipsync-service, face-processing-service)
  - Create `packages/` directory for shared libraries (shared-types, api-client, validation, config, logger, errors, utils, constants)
  - Create `infrastructure/` directory for Terraform and deployment configs
  - Create `docs/` directory for documentation
  - Create `scripts/` directory for automation scripts
  - Set up package.json for each workspace with proper dependencies
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 1.2 Configure monorepo tooling and workflows
  - Set up Turborepo for build orchestration
  - Configure task pipelines (build, test, lint, deploy)
  - Implement incremental builds and remote caching
  - Create shared build configurations (tsconfig.base.json, webpack.config.js)
  - Set up monorepo-aware CI/CD workflows
  - Configure affected package detection for optimized CI
  - Create development environment setup script (setup.sh)
  - Implement monorepo health checks
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 1.3 Create shared packages and libraries
  - Create `@clone/shared-types` package with TypeScript interfaces and types
  - Create `@clone/api-client` package for REST and WebSocket client
  - Create `@clone/validation` package with Zod schemas
  - Create `@clone/config` package for environment configuration
  - Create `@clone/logger` package for structured logging (Winston/Pino)
  - Create `@clone/errors` package for error handling
  - Create `@clone/utils` package for common utilities
  - Create `@clone/constants` package for shared constants
  - Set up package versioning and publishing strategy
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 2: Backend Infrastructure and Core Services

- [x] 2. Set up GCP infrastructure with Terraform
  - Create GCP project and configure basic services (Cloud Run, Cloud SQL, Cloud Storage)
  - Set up Terraform configuration for infrastructure as code
  - Implement Terraform workspaces for dev/staging/prod
  - Create Terraform state management with remote backend (GCS)
  - Configure CI/CD pipeline with GitHub Actions
  - Set up development, staging, and production environments
  - Implement infrastructure validation with terraform validate
  - _Requirements: 10, 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 2.1 Initialize backend WebSocket server with modern architecture
  - Create Node.js/TypeScript project in `apps/websocket-server`
  - Implement clean architecture with layers (controllers, services, repositories)
  - Set up dependency injection container (tsyringe)
  - Create domain models and DTOs with validation (class-validator)
  - Implement WebSocket connection handler with Socket.io
  - Create session management service with PostgreSQL
  - Implement connection pooling and load balancing configuration
  - Set up structured logging with Winston
  - _Requirements: 10_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 2.2 Set up REST API Gateway with OpenAPI documentation
  - Create Express API Gateway in `apps/api-gateway`
  - Implement OpenAPI 3.0 specification with swagger-jsdoc
  - Set up Swagger UI for interactive API documentation
  - Create API versioning strategy (v1, v2)
  - Implement request/response validation with OpenAPI schemas
  - Create API client SDK generation from OpenAPI spec
  - Document all REST endpoints with examples
  - Implement request validation and sanitization
  - Create rate limiting middleware per endpoint
  - Implement request/response logging with correlation IDs
  - fix any package WARN warnings
  - Create CORS configuration
  - _Requirements: 9, 10, 12, 16, 18_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 2.3 Set up authentication and authorization service
  - Integrate Firebase Auth or implement JWT-based authentication
  - Create user registration and login REST endpoints
  - Implement JWT token generation and validation
  - Create middleware for REST API authentication
  - Create middleware for WebSocket authentication
  - Implement refresh token mechanism
  - Create OAuth2 integration for social login (Google, Apple)
  - Document authentication flow in OpenAPI spec
  - Implement role-based access control (RBAC)
  - _Requirements: 10_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 2.4 Set up Cloud SQL database with repository pattern
  - Create PostgreSQL database instance on Cloud SQL
  - Design and implement database schema (users, sessions, documents, face_models, conversations)
  - Set up Prisma ORM for database access
  - Implement repository pattern for data access layer
  - Create database migration scripts with versioning
  - Implement database seeding for development
  - Create database connection pooling
  - Implement soft delete and audit trails
  - _Requirements: 9, 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 2.5 Implement event-driven architecture
  - Set up event bus using Google Cloud Pub/Sub
  - Create event publisher service
  - Implement event subscriber services
  - Create domain events (UserCreated, VoiceModelTrained, DocumentProcessed, FaceModelCreated)
  - Implement event sourcing for conversation history
  - Create event replay mechanism for debugging
  - Implement dead letter queue for failed events
  - _Requirements: 9, 11, 16, 18_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 2.6 Implement CQRS pattern for scalability
  - Separate read and write models
  - Create command handlers for write operations
  - Implement query handlers for read operations
  - Create read-optimized materialized views in PostgreSQL
  - Implement eventual consistency handling
  - Create command validation and authorization
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 2.7 Set up microservices communication
  - Create service-to-service authentication with JWT
  - Implement gRPC for internal service communication
  - Create Protocol Buffer definitions for services
  - Implement service discovery mechanism
  - Create inter-service error handling
  - Implement distributed transactions with Saga pattern
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 2.8 Setup guide on GCP to verify the deployment and cloud setup ensuring everything can be run through scripts.
  - ✅ Complete GCP management system implemented
  - ✅ Scripts: gcp-setup.sh, gcp-create-sql.sh, gcp-manage.sh, gcp-cleanup.sh
  - ✅ NPM commands: pnpm gcp:setup, pnpm gcp:status, pnpm gcp:cleanup-sql, pnpm gcp:stop-all
  - ✅ Documentation: docs/GCP-MANAGEMENT.md, docs/GCP-QUICK-REFERENCE.md, docs/GCP-CLEANUP-GUIDE.md
  - ✅ Verification: pnpm verify:vector-db, pnpm test:gcp
  - ✅ Cost optimization: Stop/start all resources, selective cleanup
  - _Note: All GCP operations can be performed through scripts_

## Phase 3: Audio Processing and ASR

### 📝 Implementation Notes

- Use WebSocket for real-time audio streaming (already configured)
- Cache audio chunks in PostgreSQL cache_audio_chunks table
- Store processed audio in GCS bucket: digitwin-live-uploads
- Audio format: 16 kHz, mono, 16-bit PCM (optimal for ASR and TTS)
- Chunk size: 100ms for low latency streaming
- VAD threshold: Configurable sensitivity for speech detection

### 🎯 Audio Pipeline Overview

```
Mobile App → WebSocket → Backend → ASR Service → Transcript
     ↓                                                ↓
  Record                                         RAG + LLM
     ↓                                                ↓
  Chunk                                          TTS Service
     ↓                                                ↓
  Stream                                        Audio Chunks
     ↓                                                ↓
  Cache ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← Playback
```

- [x] 3. Implement audio capture and streaming in mobile app
  - Implement audio recording in React Native using react-native-audio-recorder-player
  - Configure audio capture at 16 kHz, mono, 16-bit PCM format
  - Implement Voice Activity Detection (VAD) for speech detection
  - Create audio chunking logic (100ms chunks for low latency)
  - Implement audio streaming over WebSocket with sequence numbers
  - Create audio quality monitoring (volume, SNR, clipping detection)
  - Implement noise reduction/cancellation (optional, device-dependent)
  - Create audio format validation before streaming
  - Implement audio recording state management (idle, recording, paused)
  - Create audio buffer overflow handling
  - Implement microphone permission handling with user-friendly prompts
  - Create audio recording error recovery (device busy, permission denied)
  - _Requirements: 1_
  - _Note: This is for user speech input, NOT voice cloning (see Phase 6.2)_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 3.1 Implement audio playback in mobile app
  - Integrate audio player in React Native using react-native-audio-recorder-player
  - Implement audio chunk buffering for smooth playback (200-500ms buffer)
  - Create audio-video synchronization logic (< 50ms offset)
  - Handle audio playback interruptions (phone calls, notifications)
  - Implement audio session management for iOS (AVAudioSession)
  - Implement audio focus handling for Android (AudioManager)
  - Create audio playback queue management for streaming chunks
  - Implement audio playback state management (playing, paused, stopped, buffering)
  - Create audio volume control and mute functionality
  - Implement audio playback speed control (0.5x - 2x)
  - Create audio crossfade for smooth transitions
  - Implement audio ducking for background audio
  - Create audio playback error recovery (buffer underrun, decode errors)
  - Implement audio output device selection (speaker, headphones, Bluetooth)
  - _Requirements: 7_
  - _Note: This plays TTS-generated audio from Phase 6, NOT user recordings_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 3.2 Integrate Google Chirp ASR service
  - Set up Google Cloud Speech-to-Text API with Chirp model in `services/asr-service`
  - Implement streaming ASR service in backend
  - Configure automatic punctuation and interim results
  - Create ASR result handler that sends transcripts to client
  - Implement error handling and retry logic for ASR failures
  - Create ASR performance monitoring (latency, accuracy, cost)
  - Implement ASR language detection and multi-language support
  - Create ASR confidence scoring and low-confidence handling
  - Implement ASR profanity filtering (optional)
  - Create ASR custom vocabulary for domain-specific terms
  - Implement ASR speaker diarization (optional, for multi-speaker)
  - Create ASR result caching for repeated phrases
  - Implement ASR quota management and rate limiting
  - _Requirements: 2_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 3.3 Implement audio preprocessing and enhancement
  - Create audio normalization service (volume leveling)
  - Implement silence detection and trimming
  - Create audio quality assessment (SNR, clarity score)
  - Implement echo cancellation for better ASR accuracy
  - Create audio format conversion service (if needed)
  - Implement audio compression for efficient storage/transmission
  - Create audio metadata extraction (duration, sample rate, channels)
  - Implement audio validation (corrupt file detection)
  - _Requirements: 1, 2_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 3.4 Implement audio caching and storage strategy
  - Create cache_audio_chunks table in PostgreSQL
  - Implement audio chunk caching with TTL (CACHE_TTL_SHORT = 300s)
  - Create audio storage service for GCS bucket (digitwin-live-uploads)
  - Implement audio retrieval with signed URLs
  - Create audio cleanup job for expired cache entries
  - Implement audio deduplication (hash-based)
  - Create audio archive strategy for conversation history
  - Implement audio compression before storage (Opus codec)
  - _Requirements: 1, 7_
  - _Note: Follow PostgreSQL caching architecture (see docs/CACHING-ARCHITECTURE.md)_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 3.5 Write test for each major functionality in phase 3 and ensure that it runs on emulator. Fix anything that is not working or problematic.

## Phase 4: RAG Pipeline and Knowledge Base

### 📝 Implementation Notes

- Vector database: PostgreSQL with pgvector extension
- Cache embeddings in PostgreSQL `EmbeddingCache` table (already in schema)
- Cache vector search results in `VectorSearchCache` table (already in schema)
- Store documents in GCS bucket: digitwin-live-documents
- Use `KnowledgeDocument` and `DocumentChunk` models in Prisma schema (already defined)
- Embedding dimensions: 768 (Google text-embedding-004)
- Chunk size: 500-1000 tokens with 100 token overlap
- Similarity threshold: > 0.7 (cosine similarity)

### 🎯 RAG Pipeline Overview

```
Document Upload → Text Extraction → Chunking → Embedding → Vector DB
                                                    ↓
User Query → Embedding → Vector Search → Context Assembly → LLM
                              ↓
                         Cache Results
```

- [x] 4. Implement RAG pipeline foundation in `services/rag-service`
  - ✅ PostgreSQL with pgvector extension already set up in Cloud SQL
  - ✅ Prisma models: `KnowledgeDocument`, `DocumentChunk`, `EmbeddingCache`, `VectorSearchCache`
  - Integrate Google Vertex AI text-embedding-004 API for embeddings
  - Create `EmbeddingService` class for query and document embedding
  - Implement `VectorSearchService` with PostgreSQL pgvector
  - Create vector search with cosine similarity filtering (threshold > 0.7)
  - Implement `ContextAssembler` that combines search results with conversation history
  - Create cache service using existing `EmbeddingCache` and `VectorSearchCache` models
  - Implement cache TTL: CACHE_TTL_MEDIUM (3600s) for embeddings, CACHE_TTL_SHORT (300s) for searches
  - Create `RAGOrchestrator` to coordinate embedding, search, and context assembly
  - Implement user data isolation (filter by userId in all queries)
  - Create health check endpoint for RAG service
  - _Requirements: 3_
  - _Note: Vector database setup complete, see docs/VECTOR-DATABASE.md_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 4.1 Implement document processing service in `services/rag-service`
  - Create document upload endpoint in API Gateway (POST /api/v1/documents)
  - Implement multipart file upload with progress tracking
  - Integrate text extraction libraries:
    - PDF: pdf-parse or pdfjs-dist
    - DOCX: mammoth
    - TXT: native fs
    - HTML: cheerio or jsdom
    - Markdown: marked or remark
  - Create `TextChunker` class with configurable chunk size (500-1000 tokens) and overlap (100 tokens)
  - Implement batch embedding generation (batch size: 10-20 chunks)
  - Create vector upsert logic using `DocumentChunk` model
  - Update `KnowledgeDocument` status: pending → processing → completed/failed
  - Set up background job processing with Bull/BullMQ for async document processing
  - Create job queue: `document-processing-queue`
  - Implement job retry logic (3 retries with exponential backoff)
  - Store original documents in GCS bucket: digitwin-live-documents/{userId}/{documentId}
  - Create document processing status webhook/notification
  - Implement error handling and logging for each processing stage
  - _Requirements: 9_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 4.2 Implement knowledge base management API
  - Create REST API endpoints in API Gateway:
    - **Document Management:**
      - POST /api/v1/documents - Upload document (multipart/form-data)
      - POST /api/v1/documents/batch - Batch upload multiple documents
      - GET /api/v1/documents - List user's documents (paginated, filterable, sortable)
      - GET /api/v1/documents/:id - Get document details with metadata
      - GET /api/v1/documents/:id/content - Get full document content
      - GET /api/v1/documents/:id/chunks - Get document chunks (for debugging)
      - PUT /api/v1/documents/:id - Update document metadata (title, tags, sourceUrl)
      - PATCH /api/v1/documents/:id/status - Update document status
      - DELETE /api/v1/documents/:id - Delete document (soft delete)
      - POST /api/v1/documents/:id/reindex - Trigger re-indexing
      - POST /api/v1/documents/bulk-delete - Bulk delete documents
      - POST /api/v1/documents/bulk-reindex - Bulk reindex documents
    - **Document Search & Filtering:**
      - GET /api/v1/documents/search - Search documents by content, title, tags
      - Query params: q (query), status, fileType, dateFrom, dateTo, sortBy, order, page, limit
    - **Document Statistics:**
      - GET /api/v1/documents/stats - Get document statistics (count, storage, by type, by status)
      - GET /api/v1/documents/stats/usage - Get storage usage breakdown
    - **FAQ Management:**
      - POST /api/v1/faqs - Create FAQ
      - GET /api/v1/faqs - List FAQs (paginated)
      - GET /api/v1/faqs/:id - Get FAQ details
      - PUT /api/v1/faqs/:id - Update FAQ
      - DELETE /api/v1/faqs/:id - Delete FAQ
      - PUT /api/v1/faqs/reorder - Reorder FAQs (update priority)
    - **Knowledge Source Priority:**
      - GET /api/v1/knowledge/sources - Get knowledge sources with priorities
      - PUT /api/v1/knowledge/sources/priority - Update source priorities
      - GET /api/v1/knowledge/sources/preview - Preview search results with current priorities
    - **Document Processing Status:**
      - GET /api/v1/documents/:id/processing-status - Get real-time processing status
      - WebSocket event: document:processing:update - Real-time status updates
      - WebSocket event: document:processing:complete - Processing completion notification
      - WebSocket event: document:processing:failed - Processing failure notification
  - Implement user-specific data isolation (filter by userId in all queries)
  - Create document status tracking using existing status field (pending, processing, completed, failed)
  - Implement document re-indexing on updates:
    - Delete old chunks from vector database
    - Re-process document through chunking and embedding pipeline
    - Update vectorIds in KnowledgeDocument
    - Emit WebSocket events for status updates
  - Create knowledge source priority configuration:
    - Store in User.settings JSON: { knowledgeSources: { documents: 1, faqs: 2, conversations: 3 } }
    - Apply priority weighting in vector search results
  - Implement document search and filtering:
    - Full-text search in title and content
    - Filter by: status, fileType, tags, dateRange
    - Sort by: uploadedAt, processedAt, filename, sizeBytes, relevance
    - Pagination: page, limit (default: 20 per page)
  - Create document statistics endpoint:
    - Total documents count (by status)
    - Total storage used (bytes, MB, GB)
    - Documents by type (PDF, DOCX, TXT, etc.)
    - Processing success rate
    - Most referenced documents (from conversation turns)
    - Average processing time
  - Implement bulk document operations:
    - Bulk delete with transaction support
    - Bulk reindex with job queue
    - Return job IDs for tracking
  - Create document content preview:
    - Return first 500-1000 characters
    - Highlight search matches
    - Include chunk boundaries
  - Implement document validation:
    - File size limits (max 50MB per file)
    - File type validation (whitelist: PDF, DOCX, TXT, HTML, MD)
    - Content validation (not empty, readable)
    - Duplicate detection (by content hash)
  - Add OpenAPI documentation for all endpoints:
    - Request/response schemas
    - Example requests and responses
    - Error codes and messages
    - Authentication requirements
  - Create request validation using Zod schemas:
    - DocumentUploadSchema
    - DocumentUpdateSchema
    - DocumentSearchSchema
    - FAQCreateSchema
    - FAQUpdateSchema
  - Implement rate limiting for upload endpoints:
    - Upload: 10 requests per minute per user
    - Batch upload: 2 requests per minute per user
    - Search: 30 requests per minute per user
  - Create response caching for statistics:
    - Cache stats for 5 minutes (CACHE_TTL_SHORT)
    - Invalidate on document changes
  - Implement error handling:
    - 400: Invalid request (validation errors)
    - 404: Document not found
    - 409: Duplicate document
    - 413: File too large
    - 415: Unsupported file type
    - 429: Rate limit exceeded
    - 500: Processing error
  - _Requirements: 9_
  - _Note: These endpoints support the UI from Phase 13.5_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 4.3 Implement RAG query optimization
  - Create query preprocessing (normalize, remove stop words, expand acronyms)
  - Implement hybrid search (vector + keyword) for better recall
  - Create result re-ranking based on recency, source priority, and relevance
  - Implement query expansion using synonyms and related terms
  - Create conversation context integration (use last 3-5 turns for context)
  - Implement result deduplication (remove similar chunks)
  - Create relevance scoring with configurable threshold
  - Implement fallback to general knowledge when no relevant docs found
  - Create query analytics (track popular queries, low-confidence results)
  - _Requirements: 3_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 4.4 Implement RAG response metadata and tracking
  - Enhance RAG response to include source metadata:
    - Document IDs and titles of retrieved chunks
    - Relevance scores for each source
    - Source types (document, FAQ, conversation history)
    - Chunk indices and content snippets
  - Store retrieved sources in ConversationTurn.retrievedChunks (already in schema)
  - Create API endpoint: GET /api/v1/conversations/:sessionId/turns/:turnId/sources
  - Return structured source information:
    - documentId, documentTitle, chunkIndex, relevanceScore, contentSnippet
  - Implement source tracking in WebSocket messages:
    - Add sources field to response_start message
    - Include source metadata in response_end message
  - Create analytics for knowledge base usage:
    - Track most referenced documents
    - Track FAQ hit rate
    - Track queries with no relevant sources
    - Store in document metadata for statistics
  - Implement source highlighting in conversation history:
    - Mark turns that used knowledge base
    - Show source count badge
    - Link to source documents
  - _Requirements: 3, 9, 14_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 4.5 Write tests for RAG pipeline
  - Create unit tests for EmbeddingService (mock Vertex AI API)
  - Write unit tests for VectorSearchService (PostgreSQL pgvector)
  - Create unit tests for TextChunker (various chunk sizes and overlaps)
  - Write unit tests for ContextAssembler
  - Create integration tests for document processing pipeline
  - Write integration tests for RAG query flow
  - Create tests for cache hit/miss scenarios
  - Write tests for user data isolation
  - Create performance tests for vector search (1K, 10K, 100K vectors)
  - Write tests for error handling and retry logic
  - Write tests for source metadata tracking
  - Create tests for FAQ priority handling
  - _Requirements: 3, 9_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 5: LLM Integration and Response Generation

### 📝 Implementation Notes

- Cache LLM responses in PostgreSQL cache_llm_responses table
- Use cache_key = hash(prompt + context) for deduplication
- Implement TTL-based cache expiration (CACHE_TTL_MEDIUM = 3600s)
- Track costs per provider in database for optimization

- [x] 5. Implement LLM service with multi-provider support
  - Create LLM service abstraction layer in `services/llm-service`
  - Implement Gemini Flash adapter using Vertex AI
  - Implement OpenAI GPT-4 adapter
  - Implement Groq Llama adapter
  - Create streaming token handler for all providers
  - Implement provider fallback logic with circuit breaker pattern
  - Create cost tracking per provider
  - _Requirements: 4, 17_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 5.1 Implement prompt engineering and context management
  - Create prompt template for clone personality and knowledge
  - Implement conversation history management (last 5 exchanges)
  - Create context window optimization (< 8K tokens)
  - Implement response streaming and sentence buffering for TTS
  - Create prompt versioning and A/B testing
  - _Requirements: 4, 14_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 6: Voice Cloning and TTS

### 📝 Implementation Notes

- Store voice models in GCS bucket: digitwin-live-voice-models
- Cache active voice models in memory for fast access
- Use GKE with GPU nodes (T4) - can be stopped with `pnpm gcp:stop-all`
- Track voice model metadata in PostgreSQL voice_models table
- Voice sample requirements: 1-5 minutes of clean audio, 16 kHz, mono
- Training time: 10-30 minutes depending on sample quality and length

### 🎯 Voice Cloning Pipeline

```
Voice Samples → Preprocessing → Training → Voice Model → TTS
      ↓              ↓             ↓           ↓          ↓
   Upload        Validate      XTTS-v2     Storage    Synthesis
      ↓              ↓             ↓           ↓          ↓
   GCS Bucket    Quality       GPU Node    Cache      Audio Chunks
```

- [x] 6. Implement voice cloning and TTS service
  - Set up GKE cluster with GPU nodes (T4) for TTS workloads
  - Integrate XTTS-v2 model for voice cloning in `services/tts-service`
  - Implement voice model training pipeline from audio samples
  - Create TTS streaming service that generates audio chunks (100ms chunks)
  - Implement voice model storage and retrieval from Cloud Storage
  - Create voice model caching for active users (in-memory + PostgreSQL)
  - Implement voice model versioning and updates
  - Create voice model quality scoring (similarity, naturalness, clarity)
  - Implement voice model A/B testing for quality comparison
  - Create voice model fallback (use previous version if new fails)
  - Implement TTS latency optimization (< 500ms first chunk)
  - Create TTS cost tracking per synthesis request
  - Implement TTS queue management for concurrent requests
  - Create TTS error handling and retry logic
  - _Requirements: 5, 16_
  - _Note: Voice cloning is separate from user speech recording (Phase 3)_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 6.1 Implement multi-provider TTS support
  - Integrate Google Cloud TTS with custom voice API
  - Integrate OpenAI TTS API with voice options (alloy, echo, fable, onyx, nova, shimmer)
  - Integrate ElevenLabs API for high-quality voice cloning (optional)
  - Create TTS provider abstraction layer with unified interface
  - Implement provider selection based on user preference and cost
  - Create voice quality validation and similarity scoring
  - Implement provider fallback on failure (XTTS-v2 → OpenAI → Google)
  - Create provider cost comparison and optimization
  - Implement provider-specific voice model mapping
  - Create provider performance monitoring (latency, quality, cost)
  - Implement provider quota management
  - _Requirements: 5, 16_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 6.2 Implement voice sample recording and upload
  - Create voice recording UI in mobile app with guided prompts
  - Implement audio quality validation (SNR > 20 dB, no clipping, no background noise)
  - Create voice sample upload endpoint with chunked upload support
  - Implement progress tracking for voice model training
  - Create voice model preview and testing functionality
  - Implement voice sample requirements validation (duration, format, quality)
  - Create voice sample preprocessing (noise reduction, normalization)
  - Implement multiple voice sample collection (3-10 samples recommended)
  - Create voice sample review and re-record functionality
  - Implement voice sample storage in GCS bucket (digitwin-live-voice-models/samples/)
  - Create voice sample metadata tracking (duration, quality score, language)
  - Implement voice sample deletion and privacy controls
  - _Requirements: 16_
  - _Note: This is for creating voice models, NOT conversation audio (Phase 3)_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 6.3 Implement voice model training pipeline
  - Create training job queue with Bull/BullMQ
  - Implement XTTS-v2 fine-tuning on user voice samples
  - Create training progress tracking and status updates
  - Implement training validation and quality checks
  - Create training failure handling and retry logic
  - Implement training cost estimation and tracking
  - Create training job cancellation functionality
  - Implement training result notification (push, email)
  - Create training logs and debugging information
  - Implement training optimization (batch processing, GPU utilization)
  - _Requirements: 16_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 6.4 Implement voice model management
  - Create voice model CRUD operations (create, read, update, delete)
  - Implement voice model activation/deactivation
  - Create voice model comparison and selection UI
  - Implement voice model sharing (optional, for teams)
  - Create voice model export functionality
  - Implement voice model backup and restore
  - Create voice model analytics (usage, quality, cost)
  - Implement voice model expiration and cleanup
  - _Requirements: 16_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 6.5 Implement TTS optimization and caching
  - Cache TTS results in PostgreSQL cache_tts_responses table
  - Implement TTS result deduplication (same text + voice = cached audio)
  - Create TTS pregeneration for common phrases
  - Implement TTS streaming optimization (chunk-based generation)
  - Create TTS quality vs latency trade-off configuration
  - Implement TTS audio post-processing (normalization, enhancement)
  - Create TTS cost optimization (cache hits, provider selection)
  - _Requirements: 5_
  - _Note: Follow PostgreSQL caching architecture (see docs/CACHING-ARCHITECTURE.md)_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 6.6: Testing and Validation of Implemented Features

### 📝 Testing Notes

- Test all implemented services: ASR, RAG, LLM, TTS, Voice Cloning
- Validate end-to-end flows with real data
- Collect manual feedback on quality and performance
- Fix critical issues before proceeding to face cloning

- [x] 6.6 Test and validate implemented features (Phases 1-6)
  - **ASR Service Testing:**
    - Test audio streaming with various audio qualities and formats
    - Validate transcription accuracy with different accents and speech patterns
    - Test interim and final transcript delivery
    - Verify error handling for poor audio quality
    - Test multi-language support and language detection
    - Measure and validate ASR latency (target: < 300ms)
  - **RAG Pipeline Testing:**
    - Test document upload and processing (PDF, DOCX, TXT, HTML, Markdown)
    - Validate text extraction and chunking quality
    - Test embedding generation and vector storage
    - Verify vector search accuracy and relevance scoring
    - Test knowledge retrieval with various query types
    - Validate user data isolation
    - Measure and validate RAG latency (target: < 200ms)
  - **LLM Service Testing:**
    - Test response generation with different providers (Gemini, OpenAI, Groq)
    - Validate streaming token delivery
    - Test context assembly with conversation history
    - Verify provider fallback logic
    - Test response quality and relevance
    - Validate cost tracking per provider
    - Measure and validate LLM latency (target: < 1000ms first token)
  - **TTS Service Testing:**
    - Test voice model training with sample audio
    - Validate voice quality and similarity scoring
    - Test audio synthesis with different providers (XTTS-v2, Google, OpenAI)
    - Verify streaming audio chunk delivery
    - Test voice model caching and preloading
    - Validate audio quality (sample rate, format, clarity)
    - Measure and validate TTS latency (target: < 500ms first chunk)
  - **Voice Cloning Testing:**
    - Test voice sample recording and upload
    - Validate voice sample quality assessment
    - Test voice model training pipeline
    - Verify voice model activation and management
    - Test voice preview and comparison
    - Validate voice similarity (target: > 85%)
  - **Integration Testing:**
    - Test WebSocket connection and message routing
    - Validate authentication and session management
    - Test end-to-end flow: audio → ASR → RAG → LLM → TTS → audio
    - Verify error propagation and recovery
    - Test interruption handling
    - Validate conversation state management
  - **Performance Testing:**
    - Measure end-to-end latency (target: < 2000ms)
    - Test with concurrent users (10, 50, 100)
    - Validate resource utilization (CPU, memory, GPU)
    - Test caching effectiveness (hit rates, latency reduction)
    - Measure cost per conversation
  - **Manual Testing and Feedback:**
    - Conduct manual conversation tests with real users
    - Collect feedback on transcription accuracy
    - Gather feedback on response quality and relevance
    - Evaluate voice quality and naturalness
    - Assess overall user experience
    - Document issues and improvement suggestions
    - Prioritize fixes based on severity and impact
  - **Bug Fixes and Improvements:**
    - Fix critical bugs identified during testing
    - Implement high-priority improvements
    - Optimize performance bottlenecks
    - Enhance error handling and recovery
    - Improve user feedback and error messages
  - **Documentation:**
    - Document test results and findings
    - Create testing guide for future reference
    - Update API documentation with test examples
    - Document known issues and workarounds
  - _Requirements: 1, 2, 3, 4, 5, 16_
  - _Note: This checkpoint ensures quality before proceeding to face cloning_

## Phase 7: Face Cloning and Model Creation

### 📝 Implementation Notes

- Store face models in GCS bucket: digitwin-live-face-models
- Store face model metadata in PostgreSQL face_models table (already exists)
- Use GKE with GPU nodes (T4/V100) for face processing workloads
- Cache active face models in GPU workers for fast access
- Support multiple face animation models: Wav2Lip, TPSM, SadTalker, Audio2Head
- Face model quality threshold: minimum 70/100 score before activation
- Processing time target: < 30 minutes for face model creation

### 🎯 Face Model Creation Pipeline

```
Photos/Video → Upload → Detection → Landmarks → Embeddings → Templates → Model
     ↓           ↓         ↓          ↓          ↓           ↓         ↓
  Mobile App   GCS     MediaPipe   468 Points  FaceNet   Expressions Storage
     ↓           ↓         ↓          ↓          ↓           ↓         ↓
  Progress    Validation Quality    Identity   Neutral    Quality   Preview
```

- [x] 7. Implement face detection and validation service
  - Integrate MediaPipe for face detection and 468 facial landmark extraction in `services/face-processing-service`
  - Implement face quality validation (lighting quality, angle detection, resolution check)
  - Create face detection confidence scoring (reject faces < 80% confidence)
  - Implement multi-face detection with primary face selection
  - Create face crop and alignment preprocessing
  - Implement face quality metrics (blur detection, lighting analysis, pose estimation)
  - Create face validation API endpoints with detailed feedback
  - Implement batch processing for multiple photos/video frames
  - _Requirements: 18.2, 18.5, 18.7_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 7.1 Implement face embedding and identity generation
  - Integrate FaceNet or ArcFace for face embedding generation
  - Create identity embedding from multiple face samples
  - Implement embedding quality validation and consistency checks
  - Create face similarity scoring for identity verification
  - Implement embedding storage and retrieval optimization
  - Create face identity clustering for robust representation
  - Implement embedding versioning for model updates
  - Create face recognition validation against uploaded samples
  - _Requirements: 18.3_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 7.2 Implement expression template extraction
  - Create neutral expression detection and selection logic
  - Implement talking expression extraction from video sequences
  - Generate blendshape templates for facial animation (52 Action Units)
  - Create expression keypoint configuration storage
  - Implement expression interpolation for smooth transitions
  - Create expression quality scoring and validation
  - Implement custom expression template creation
  - Create expression template optimization for lip-sync models
  - _Requirements: 18.3, 18.4_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 7.3 Implement face model storage and management
  - Implement face model CRUD operations using existing FaceModel schema
  - Create face model artifact storage in GCS (digitwin-live-face-models bucket)
  - Implement face model versioning and update management
  - Create face model quality scoring system (0-100 scale)
  - Implement face model activation/deactivation logic
  - Create face model backup and restore functionality
  - Implement face model sharing (optional, for teams)
  - Create face model analytics and usage tracking
  - Implement face model expiration and cleanup policies
  - _Requirements: 18.5_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 7.4 Implement face model preview and testing
  - Create face model preview generation with sample audio
  - Implement test video generation using multiple lip-sync models
  - Create face model comparison functionality (A/B testing)
  - Implement face model quality assessment UI
  - Create face model recommendation system for improvements
  - Implement face model validation workflow
  - Create face model approval/rejection system
  - Implement face model re-training triggers
  - _Requirements: 18.6, 18.7_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 7.5 Implement GPU worker infrastructure for face processing
  - Set up GKE GPU node pools (T4 for development, V100 for production)
  - Create GPU worker queue management with BullMQ
  - Implement face processing job scheduling and prioritization
  - Create GPU resource monitoring and auto-scaling
  - Implement face model caching in GPU memory
  - Create GPU worker health monitoring and failover
  - Implement cost optimization (preemptible instances, auto-shutdown)
  - Create GPU utilization analytics and reporting
  - _Requirements: 18.3_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 7.6 Test face processing service locally and on GCP
  - **Local Testing:**
    - Create `scripts/test-face-processing-local.sh` script for local testing
    - Test all face detection endpoints with sample images
    - Test face embedding generation and identity creation
    - Test expression template extraction
    - Test face model storage CRUD operations
    - Test face model preview generation
    - Verify all 121 unit tests pass locally
    - Test API endpoints with curl/httpie commands
    - Create sample test images in `test-data/face-samples/`
  - **GCP Testing:**
    - Create `scripts/test-face-processing-gcp.sh` script for GCP deployment testing
    - Deploy face-processing-service to Cloud Run
    - Test service health endpoint on GCP
    - Test face detection with GCS-stored images
    - Test face model storage with GCS bucket (digitwin-live-face-models)
    - Test GPU worker queue integration (if GPU nodes available)
    - Verify PostgreSQL cache operations on Cloud SQL
    - Test service-to-service authentication
    - Create load test script for concurrent face processing requests
    - Verify auto-scaling behavior under load
  - **Integration Testing:**
    - Create `scripts/test-face-processing-integration.sh` for end-to-end testing
    - Test complete flow: upload image → detect face → generate embedding → create identity
    - Test face model creation from multiple samples
    - Test face model activation and retrieval
    - Verify event publishing (FaceModelCreated, FaceModelActivated)
    - Test error handling and retry logic
  - **Documentation:**
    - Update docs/FACE-PROCESSING.md with testing instructions
    - Add troubleshooting section for common issues
    - Document GCP deployment steps
    - Create test data README with sample image requirements
  - _Requirements: 5, 18_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 8: Lip-sync Video Generation

### 📝 Implementation Notes

- Use GKE GPU workers (same as face processing) for lip-sync generation
- Support multiple models: TPSM (fast), Wav2Lip (quality), SadTalker (head motion), Audio2Head (advanced)
- Target: < 500ms latency for first video frame, 15-20 FPS streaming
- Cache active face models in GPU workers for fast access
- Implement adaptive quality based on network conditions

### 🎯 Lip-sync Generation Pipeline

```
Audio Chunks → Feature Extraction → Model Selection → Frame Generation → Encoding → Streaming
     ↓              ↓                    ↓               ↓              ↓          ↓
  TTS Output    Mel-spectrogram      TPSM/Wav2Lip    Video Frames    H.264    WebSocket
     ↓              ↓                    ↓               ↓              ↓          ↓
  100ms chunks   MFCC Features      Face Model      15-20 FPS      Chunks    Mobile App
```

- [x] 8. Implement multi-model lip-sync service
  - Integrate TPSM (Thin-Plate Spline Motion) for fast real-time lip-sync in `services/lipsync-service`
  - Integrate Wav2Lip for high-quality lip-sync generation
  - Integrate SadTalker for head motion and natural lip-sync
  - Integrate Audio2Head for advanced facial animation (optional)
  - Create model selection logic based on quality/latency requirements
  - Implement model performance benchmarking and auto-selection
  - Create fallback hierarchy: TPSM → Wav2Lip → SadTalker → Static Image
  - Implement model switching during conversation based on performance
  - _Requirements: 6, 18.4_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 8.1 Implement audio feature extraction and processing
  - Implement mel-spectrogram extraction from audio chunks
  - Create MFCC (Mel-Frequency Cepstral Coefficients) feature extraction
  - Implement audio preprocessing (normalization, windowing)
  - Create audio-visual alignment optimization
  - Implement phoneme detection for improved lip-sync accuracy
  - Create audio feature caching for repeated content
  - Implement real-time audio feature streaming
  - Create audio quality assessment for lip-sync optimization
  - _Requirements: 6_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 8.2 Implement face model integration and caching
  - Implement face model loading from GCS storage
  - Create face model caching in GPU worker memory
  - Implement face model preprocessing for lip-sync models
  - Create face model compatibility validation for each lip-sync model
  - Implement face model optimization (compression, format conversion)
  - Create face model preloading for active users
  - Implement face model hot-swapping during conversations
  - Create face model performance monitoring
  - _Requirements: 6, 18_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 8.3 Implement video frame generation and optimization
  - Create video frame generation synchronized with audio chunks
  - Implement frame rate control (adaptive 15-20 FPS based on performance)
  - Create video frame buffering for smooth playback
  - Implement frame interpolation for smoother animation
  - Create video quality optimization (resolution, compression)
  - Implement frame dropping for performance optimization
  - Create video frame caching for repeated expressions
  - Implement video generation performance monitoring
  - _Requirements: 6, 7_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 8.4 Implement video streaming and synchronization
  - Create video frame streaming over WebSocket with chunked transfer
  - Implement H.264 encoding for video chunks with hardware acceleration
  - Create audio-video synchronization logic (< 50ms offset target)
  - Implement adaptive bitrate streaming based on network conditions
  - Create video buffering management on client side
  - Implement frame skipping for network congestion handling
  - Create video streaming performance analytics
  - Implement video streaming error recovery and reconnection
  - _Requirements: 6, 7_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 9: Conversation Flow and State Management

### 📝 Implementation Notes

- Use WebSocket for bidirectional real-time communication (already configured)
- Store conversation sessions in PostgreSQL `ConversationSession` table (already in schema)
- Store conversation turns in `ConversationTurn` table with full context (already in schema)
- Track state transitions in session metadata for debugging
- Maintain conversation history: last 5 turns for context (as per Requirement 14)
- Session timeout: 2 hours of inactivity (as per Requirement 14)

### 🎯 State Machine Overview

```
idle → listening → processing → speaking → idle
  ↓        ↓           ↓           ↓
  └────────┴───────────┴───────────┴──→ interrupted → listening
```

- [x] 9. Implement conversation state management
  - Create conversation state machine with states: `idle`, `listening`, `processing`, `speaking`, `interrupted`
  - Implement state transition logic in WebSocket server:
    - `idle` → `listening`: User starts speaking (VAD detects speech)
    - `listening` → `processing`: User stops speaking (VAD silence detected)
    - `processing` → `speaking`: First audio chunk ready from TTS
    - `speaking` → `idle`: Response playback complete
    - `any state` → `interrupted`: User speaks during clone response
    - `interrupted` → `listening`: Interruption acknowledged, ready for new input
  - Create state validation to prevent invalid transitions
  - Implement state persistence in `ConversationSession.metadata` JSONB field
  - Create WebSocket message types for state management:
    - `state:changed` - Notify client of state transitions
    - `state:error` - Invalid state transition attempted
  - Implement conversation session tracking:
    - Create session on first WebSocket connection with JWT userId
    - Store session in PostgreSQL with `sessionId`, `userId`, `status`, `startedAt`, `lastActivityAt`
    - Update `lastActivityAt` on each user interaction
    - Set session status: `active`, `paused`, `completed`, `expired`
  - Implement session timeout handling:
    - Check `lastActivityAt` every 5 minutes
    - Mark sessions as `expired` after 2 hours of inactivity
    - Send `session:expired` WebSocket message to client
    - Clean up expired sessions after 24 hours
  - Create conversation history storage:
    - Store each turn in `ConversationTurn` table with `sessionId`, `turnIndex`, `userMessage`, `assistantMessage`, `retrievedChunks`, `metadata`
    - Include timestamps: `userMessageAt`, `assistantMessageAt`
    - Store latency metrics in `metadata`: `asrLatency`, `ragLatency`, `llmLatency`, `ttsLatency`, `totalLatency`
    - Store cost metrics in `metadata`: `asrCost`, `llmCost`, `ttsCost`, `totalCost`
  - Implement conversation history retrieval:
    - Fetch last 5 turns for context window (as per Requirement 14)
    - Order by `turnIndex DESC`
    - Include in RAG context assembly
  - Create conversation metrics tracking:
    - Track per-turn latency: ASR (< 300ms), RAG (< 200ms), LLM (< 1000ms), TTS (< 500ms)
    - Track end-to-end latency (target: < 2000ms)
    - Track cost per turn and cumulative session cost
    - Track quality metrics: ASR confidence, RAG relevance scores, voice similarity
    - Store metrics in `ConversationTurn.metadata` for analytics
  - Implement conversation session API endpoints:
    - GET /api/v1/conversations - List user's conversation sessions (paginated)
    - GET /api/v1/conversations/:sessionId - Get session details with turns
    - GET /api/v1/conversations/:sessionId/turns - Get conversation turns (paginated)
    - DELETE /api/v1/conversations/:sessionId - Delete conversation session
    - GET /api/v1/conversations/stats - Get conversation statistics (total sessions, avg duration, avg cost)
  - Create state management UI in mobile app:
    - Display current state with visual indicators (listening, thinking, speaking)
    - Show conversation history in scrollable list
    - Display latency and quality metrics (optional, debug mode)
  - _Requirements: 8, 14_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 9.1 Implement interruption handling
  - Create VAD-based interruption detection in mobile app:
    - Continue monitoring microphone during clone response playback
    - Detect speech onset using VAD (same as initial speech detection)
    - Set interruption threshold: 200ms of continuous speech
  - Implement immediate response cancellation:
    - Send `conversation:interrupt` WebSocket message to backend
    - Include current `sessionId` and `turnIndex` in message
    - Stop audio playback immediately (< 50ms)
    - Stop video playback and clear video buffer
    - Clear audio/video response queues
  - Create backend interruption handling:
    - Cancel ongoing LLM streaming request
    - Cancel ongoing TTS generation jobs
    - Cancel ongoing lip-sync generation jobs
    - Clear response buffers and queues
    - Transition state: `speaking` → `interrupted` → `listening`
    - Log interruption event in `ConversationTurn.metadata`: `interrupted: true`, `interruptedAt: timestamp`
  - Implement graceful transition to new query:
    - Acknowledge interruption with `conversation:interrupted` WebSocket message
    - Transition to `listening` state within 200ms (as per Requirement 8)
    - Begin processing new user utterance as fresh query
    - Increment `turnIndex` for new conversation turn
  - Create interruption analytics:
    - Track interruption frequency per session
    - Track interruption timing (early, mid, late in response)
    - Store in session metadata for quality analysis
  - Implement interruption recovery:
    - Handle partial responses gracefully (don't store incomplete turns)
    - Ensure clean state for next turn
    - Prevent resource leaks from cancelled operations
  - _Requirements: 8_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 9.2 Implement end-to-end conversation flow orchestration
  - Create conversation orchestrator service in WebSocket server:
    - Coordinate all pipeline stages: Audio → ASR → RAG → LLM → TTS → Lip-sync → Playback
    - Implement async message routing between services
    - Track conversation turn lifecycle from start to completion
  - Wire audio capture to ASR service:
    - Receive `audio:chunk` WebSocket messages from mobile app
    - Forward audio chunks to ASR service with `sessionId` and `sequenceNumber`
    - Handle `audio:end` message to signal utterance completion
    - Receive `asr:interim` and `asr:final` results from ASR service
    - Send `transcript:interim` and `transcript:final` to mobile app
  - Wire ASR to RAG pipeline:
    - Trigger RAG query on `asr:final` transcript
    - Pass `sessionId` to retrieve conversation history (last 5 turns)
    - Receive top 3-5 relevant chunks with similarity scores
    - Assemble context: retrieved chunks + conversation history
  - Wire RAG to LLM service:
    - Send assembled context + user query to LLM service
    - Include user personality traits and system prompt
    - Receive streaming tokens from LLM
    - Buffer tokens into complete sentences for TTS
  - Wire LLM to TTS service:
    - Send complete sentences to TTS service as they're buffered
    - Include `userId` to load correct voice model
    - Receive streaming audio chunks from TTS
    - Forward audio chunks to lip-sync service
  - Wire TTS to Lip-sync service:
    - Send audio chunks + face model reference to lip-sync service
    - Receive synchronized video frames
    - Maintain audio-video sync (< 50ms offset as per Requirement 6)
  - Wire Lip-sync to mobile app:
    - Stream audio chunks via WebSocket: `audio:chunk` messages
    - Stream video frames via WebSocket: `video:frame` messages
    - Include sequence numbers for proper ordering
    - Send `response:complete` when all chunks delivered
  - Implement latency tracking for each stage:
    - Record timestamps at each pipeline transition
    - Calculate stage latencies: `asrLatency`, `ragLatency`, `llmLatency`, `ttsLatency`, `lipsyncLatency`
    - Calculate total latency: `userSpeechEnd` → `firstAudioChunk`
    - Store in `ConversationTurn.metadata`
    - Send `metrics:latency` WebSocket message to client (optional, debug mode)
  - Implement error propagation and recovery:
    - Catch errors at each pipeline stage
    - Propagate errors to orchestrator with context
    - Send `error:asr`, `error:rag`, `error:llm`, `error:tts`, `error:lipsync` to mobile app
    - Implement retry logic with exponential backoff (max 3 retries)
    - Fallback strategies:
      - ASR failure: Prompt user to repeat
      - RAG failure: Proceed without context (general knowledge)
      - LLM failure: Try fallback provider (Gemini → OpenAI → Groq)
      - TTS failure: Use fallback voice or text-only response
      - Lip-sync failure: Audio-only mode
    - Log all errors with full context for debugging
  - Create end-to-end integration tests:
    - Test happy path: complete conversation turn with all services
    - Test ASR service failure and recovery
    - Test RAG service failure and fallback
    - Test LLM service failure and provider fallback
    - Test TTS service failure and fallback
    - Test lip-sync service failure and audio-only mode
    - Test interruption during each pipeline stage
    - Test concurrent conversation turns (race conditions)
    - Test WebSocket disconnection and reconnection
    - Test session timeout and cleanup
  - Implement conversation flow monitoring:
    - Track success rate per pipeline stage
    - Track average latency per stage
    - Track error rates and types
    - Alert when latency exceeds thresholds (as per Requirement 11)
    - Alert when error rate exceeds 5%
  - Create conversation flow visualization (optional, debug mode):
    - Display pipeline stages in mobile app
    - Show current stage and progress
    - Display latency for each completed stage
    - Highlight errors and retries
  - _Requirements: 1, 2, 3, 4, 5, 6, 7, 8, 14_
  - _Note: This task integrates all previous phases into a cohesive conversation experience_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 10: Performance Optimization and Caching

### 📝 Implementation Notes

- **IMPORTANT**: Use PostgreSQL for ALL caching, NOT Redis or Memcached
- Cache tables already implemented in Prisma schema: EmbeddingCache, VectorSearchCache, LLMResponseCache, AudioChunkCache
- Environment variables: ENABLE_CACHING, CACHE_TTL_SHORT, CACHE_TTL_MEDIUM, CACHE_TTL_LONG
- Implement automatic cleanup: `DELETE FROM cache_* WHERE expires_at < NOW()`
- Use JSONB for cache_value to store complex objects
- Create indexes on cache_key and expires_at for performance

- [x] 10. Implement caching and performance optimization
  - ✅ PostgreSQL cache tables already implemented in Prisma schema (EmbeddingCache, VectorSearchCache, LLMResponseCache, AudioChunkCache)
  - ✅ Cache table pattern: cache\_<type> with cache_key, cache_value (JSONB), expires_at
  - ✅ Environment variables: ENABLE_CACHING, CACHE_TTL_SHORT, CACHE_TTL_MEDIUM, CACHE_TTL_LONG
  - Implement cache service with get/set/delete/cleanup methods in shared package
  - Integrate caching into RAG service (vector search results, embeddings)
  - Integrate caching into LLM service (response caching for FAQs)
  - Integrate caching into TTS service (audio chunk caching)
  - Implement multi-level caching strategy (L1: memory, L2: PostgreSQL cache tables, L3: GCS)
  - Create cache invalidation strategies (TTL with timestamp columns, event-based triggers)
  - Create voice model preloading for active users
  - Implement face model caching in GPU workers
  - Create connection pooling for databases and APIs
  - Create cache warming strategies for frequently accessed data
  - Implement automatic cache cleanup job (DELETE FROM cache\_\* WHERE expires_at < NOW())
  - _Requirements: 11_
  - _Note: Use PostgreSQL for caching, NOT Redis or Memcached (see docs/CACHING-SUMMARY.md)_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 10.1 Implement API response optimization
  - Create response compression (gzip, brotli) middleware in API Gateway
  - Implement pagination for list endpoints (documents, conversations, FAQs)
  - Create field filtering for partial responses (GraphQL-style field selection)
  - Implement ETags for conditional requests
  - Create response streaming for large payloads
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 10.2 Implement background job processing
  - ✅ TrainingJob model already exists in Prisma schema
  - Set up job queue with Bull/BullMQ in shared package
  - Create job processors for document processing (RAG service)
  - Implement job processors for voice model training (TTS service)
  - Create job processors for face model creation (Face Processing service)
  - Implement job retry logic with exponential backoff
  - Create job monitoring and failure handling
  - Implement job priority and scheduling
  - Create job status API endpoints
  - _Requirements: 9, 16, 18_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 10.3 Implement adaptive quality and network optimization
  - Create network quality detection in mobile app
  - Implement adaptive video quality based on bandwidth
  - Create audio-only fallback mode for poor connections
  - Implement WebSocket compression
  - Create reconnection logic with exponential backoff
  - _Requirements: 10, 15_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 10.4 Test caching and performance optimization implementation
  - **Cache Service Tests:**
    - Test EmbeddingCacheService (get, set, delete, cleanup)
    - Test VectorSearchCacheService with user isolation
    - Test LLMResponseCacheService with hit count tracking
    - Test AudioChunkCacheService with LRU eviction
    - Test CacheManager cleanup and statistics
    - Verify cache TTL expiration (short, medium, long)
    - Test cache hit/miss scenarios
    - Verify PostgreSQL cache table operations
  - **API Response Optimization Tests:**
    - Test compression middleware (gzip/brotli) with various payload sizes
    - Test pagination middleware (page, limit, offset, sorting)
    - Test ETag middleware (If-None-Match, 304 responses)
    - Test field filtering middleware (partial responses, nested fields)
    - Verify compression threshold (1KB minimum)
    - Test pagination validation (invalid page/limit)
    - Test ETag generation and matching
    - Verify field filtering with invalid fields
  - **Background Job Processing Tests:**
    - Test QueueManager job creation and queuing
    - Test job worker processing with success/failure
    - Test job retry logic with exponential backoff
    - Test job progress updates
    - Test job cancellation
    - Test queue statistics (waiting, active, completed, failed)
    - Test job priority ordering
    - Verify Redis connection and queue operations
  - **Network Optimization Tests:**
    - Test NetworkQualityMonitor metrics tracking
    - Test network quality detection (excellent, good, fair, poor)
    - Test adaptive quality settings recommendations
    - Test ReconnectionManager exponential backoff
    - Test reconnection scheduling and cancellation
    - Test WebSocket compression configuration
    - Verify bandwidth estimation
    - Test latency calculation from ping/pong
  - **Integration Tests:**
    - Test cache service integration with RAG service
    - Test cache service integration with LLM service
    - Test cache service integration with TTS service
    - Test API Gateway with all optimization middleware
    - Test WebSocket server with network monitoring
    - Test job queue with actual job processors
    - Verify end-to-end caching flow
    - Test cache invalidation on data updates
  - **Performance Tests:**
    - Benchmark cache hit vs miss latency
    - Measure compression ratio and performance impact
    - Test pagination performance with large datasets
    - Measure job queue throughput
    - Test network quality detection accuracy
    - Benchmark reconnection timing
    - Verify cache cleanup performance
  - _Requirements: 11_
  - _Note: Run tests with `pnpm test` and verify all pass before proceeding_

## Phase 11: Error Handling and Security

### 📝 Implementation Notes

- ✅ Data encryption at rest already configured (Cloud Storage, Cloud SQL)
- ✅ TLS configuration already in place for all connections
- ✅ Audit logging model already exists in Prisma schema
- ✅ RateLimit model already exists in Prisma schema
- Focus on requirements 10, 11, 12, 13 - all are essential for production

### 🎯 Implementation Order (Prioritized)

1. **Task 11** - Health checks (foundational for monitoring)
2. **Task 11.1** - Error handling (critical for user experience)
3. **Task 11.2** - Rate limiting (important for cost control)
4. **Task 11.3** - Content safety (required for production safety)
5. **Task 11.4** - Security audit (final validation)
   - [x] 11. Implement health checks and monitoring

- Create health check endpoints for all services:
  - GET /health - Basic liveness check
  - GET /health/ready - Readiness check (dependencies available)
- Implement component health status tracking
- Create liveness and readiness probes for Cloud Run deployment
- Implement dependency health checks:
  - Database connectivity
  - External API availability (ASR, LLM, TTS)
  - Storage bucket access
- Return health status: { status: 'healthy' | 'degraded' | 'unhealthy', components: {...} }
- _Requirements: 11_
- Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 11.1 Implement error handling and recovery
  - Create centralized error handler middleware in API Gateway and WebSocket Server
  - Implement error categorization (client 4xx, server 5xx, external service errors)
  - Create custom error classes with error codes in @clone/errors package
  - Implement user-friendly error messages for common scenarios:
    - ASR failure: "Could not understand audio. Please try again."
    - Knowledge base empty: "Please upload documents to your knowledge base first."
    - GPU unavailable: "Processing queue is full. Estimated wait: X minutes."
    - Service timeout: "Request took too long. Please try again."
  - Create error serialization for API responses (consistent format)
  - Implement WebSocket error messages (sent within 1000ms of failure)
  - Create retry option for ASR failures in mobile app
  - Implement fallback strategies for service failures (already in Phase 9.2)
  - _Requirements: 13_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 11.2 Implement rate limiting and usage controls
  - ✅ RateLimit model already exists in Prisma schema
  - Create rate limiting service using PostgreSQL rate_limits table
  - Implement per-user rate limits based on subscription tier:
    - Free tier: 60 minutes conversation per day, 100 API requests per hour
    - Pro tier: unlimited conversation, 1000 API requests per hour
  - Create rate limit enforcement middleware for API Gateway
  - Implement graceful degradation when rate limit exceeded:
    - Return 429 status with Retry-After header
    - Display user-friendly message with upgrade option
  - Use PostgreSQL for rate limiting storage (sliding window algorithm)
  - Track usage per user for billing and analytics
  - _Requirements: 12_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 11.3 Implement API validation and content safety
  - Create request validation using Zod schemas in @clone/validation package
  - Implement input sanitization to prevent injection attacks (XSS, SQL injection)
  - Implement file upload validation:
    - Size limits: max 50MB per file
    - Type validation: PDF, DOCX, TXT, HTML, Markdown only
    - Content validation: scan for malicious content
  - Implement content safety filtering:
    - Filter inappropriate content in user input before processing
    - Filter LLM responses before synthesis
    - Reject queries with inappropriate content (send policy message)
    - Log flagged content for review (maintain user privacy)
  - Create validation error formatting for API responses
  - _Requirements: 12, 13_
  - _Note: Content filtering can use simple keyword lists initially, Perspective API optional_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 11.4 Implement security and access controls
  - ✅ Data encryption at rest already configured
  - ✅ TLS configuration already in place
  - Implement user data isolation:
    - Ensure all queries filter by userId
    - Validate user owns resources before access
    - Prevent cross-user data leakage
  - Implement audit logging for sensitive operations:
    - User authentication events
    - Document uploads/deletions
    - Voice/face model creation
    - Rate limit violations
    - Content policy violations
  - Create data retention policies:
    - Conversation history: 30 days (configurable per user)
    - Cached data: TTL-based expiration
    - Audit logs: 90 days
  - Implement cleanup jobs for expired data
  - _Requirements: 10, 12_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 12: Monitoring and Observability

- [ ] 12. Implement monitoring and observability
  - Set up Cloud Monitoring for GCP services
  - Implement custom metrics collection (latency, throughput, quality)
  - Create distributed tracing with Cloud Trace
  - Implement structured logging with Cloud Logging
  - Create alerting rules for critical issues
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 12.1 Create monitoring dashboards
  - Create operations dashboard (Grafana or Cloud Console)
  - Implement real-time conversation monitoring
  - Create performance metrics visualization
  - Implement cost tracking dashboard
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 12.2 Implement cost optimization
  - Create cost tracking per conversation
  - Implement provider cost comparison
  - Set up preemptible/spot GPU instances
  - Create cost alerting on threshold exceeded
  - Implement usage analytics for cost optimization
  - _Requirements: 11, 17_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 12.3 Implement latency and quality alerting
  - Create alerting rules for 95th percentile latency > 2500ms (Requirement 11.3)
  - Implement voice similarity score monitoring and alerts for scores < 80% (Requirement 11.4)
  - Create ASR accuracy monitoring and alerts for accuracy < 95% (Requirement 2.4)
  - Implement RAG relevance score monitoring
  - Create GPU utilization alerts for resource exhaustion
  - Implement cost threshold alerts per conversation
  - Create error rate alerts (> 5% error rate)
  - Implement WebSocket connection health alerts
  - _Requirements: 11.3, 11.4, 2.4, 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 13: React Native Mobile App - Complete UI/UX Implementation (CRITICAL - NOT STARTED)

### 📝 Implementation Notes

- **CRITICAL**: Mobile app is currently empty and needs full implementation
- This is the user-facing component that ties everything together
- Without this, users cannot interact with the system
- Priority: HIGH - Required for MVP
- Integrates audio capture, playback, WebSocket communication, and all UI screens

- [ ] 13. Set up React Native project structure and navigation
  - Initialize React Native project with TypeScript in `apps/mobile-app`
  - Configure React Navigation with stack and tab navigators
  - Set up navigation structure (Auth, Main, Onboarding stacks)
  - Configure platform-specific settings for iOS and Android
  - Set up state management (Redux Toolkit or Zustand)
  - Configure environment variables for dev/staging/prod
  - _Requirements: 1, 7_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.1 Implement authentication screens
  - Create splash screen with app branding
  - Implement login screen with email/password and social auth
  - Create registration screen with form validation
  - Implement forgot password screen
  - Create email verification screen
  - Add biometric authentication (Face ID/Touch ID) support
  - Implement secure token storage using react-native-keychain
  - _Requirements: 10_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.2 Implement onboarding flow screens
  - Create welcome screen with feature highlights
  - Implement permissions request screens (microphone, camera, storage)
  - Create personality setup screen for clone configuration
  - Implement onboarding progress indicator
  - Create skip/complete onboarding logic
  - Add animated transitions between onboarding steps
  - _Requirements: 16, 18_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.3 Implement voice model creation UI
  - Create voice recording screen with waveform visualization
  - Implement recording controls (start, stop, pause, replay)
  - Create recording timer and progress indicator
  - Implement audio quality indicator (volume, clarity)
  - Create voice sample review and re-record functionality
  - Implement upload progress screen with cancellation
  - Create voice model training status screen
  - Implement voice preview and comparison screen
  - _Requirements: 16_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.4 Implement face model creation UI
  - Create photo capture screen with camera preview
  - Implement face detection overlay with alignment guides
  - Create multi-photo capture flow (3-10 photos)
  - Implement video recording mode for face capture
  - Create photo/video review gallery with delete option
  - Implement face quality validation feedback
  - Create upload progress screen with preview thumbnails
  - Implement face model processing status screen
  - Create face model preview with test video generation
  - _Requirements: 18_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.5 Implement knowledge base management UI
  - Create knowledge base home screen with document list (card/list view toggle)
  - Display document cards with: title, type icon, upload date, processing status, chunk count
  - Implement document upload screen with file picker integration (react-native-document-picker)
  - Support file types: PDF, DOCX, TXT, HTML, Markdown
  - Create drag-and-drop upload area (if supported by platform)
  - Implement multi-file upload with queue management
  - Create upload progress indicators with cancel functionality
  - Display document processing status with real-time updates (pending, processing, completed, failed)
  - Implement document detail view with metadata (title, filename, size, dates, content preview, chunks, tags)
  - Create document search functionality (by title, content, tags)
  - Implement filters (status, file type, date range) and sorting (upload date, name, size, relevance)
  - Create document actions (edit metadata, view, reindex, delete)
  - Implement FAQ management UI (create, edit, delete, reorder by priority)
  - Create knowledge source priority configuration UI
  - Implement document statistics dashboard (count, storage, by type, by status)
  - _Requirements: 9_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.6 Implement main conversation screen
  - Create full-screen video player for clone's face
  - Implement video player controls (quality, fullscreen)
  - Create floating audio waveform visualization during user speech
  - Implement real-time transcript display with auto-scroll
  - Create conversation state indicators (idle, listening, processing, speaking)
  - Implement microphone button with press-to-talk and continuous listening modes
  - Create interruption button for stopping clone response
  - Implement audio/video quality indicators
  - Create network status indicator
  - Implement conversation controls (mute, speaker, video on/off, end, settings)
  - Add haptic feedback for state transitions
  - Create knowledge source indicator:
    - Show badge when response uses knowledge base
    - Display "Using 2 documents" or "Using FAQ" indicator
    - Tap to see which documents/FAQs were referenced
  - Implement knowledge source drawer:
    - Slide-up drawer showing referenced documents
    - Document titles with relevance scores
    - Tap document to view full content
    - Quick link to knowledge base management
  - _Requirements: 1, 6, 7, 8, 9, 14_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.6.1 Implement conversation history UI
  - Create conversation history list screen with card/list view toggle
  - Implement conversation card with:
    - Date and time
    - Duration
    - Auto-generated summary (first user query or AI-generated)
    - Turn count
    - Knowledge sources used badge (if any)
    - Cost indicator (optional)
  - Create conversation detail view with full transcript:
    - User messages (left-aligned)
    - AI responses (right-aligned)
    - Timestamps for each turn
    - Knowledge source indicators on AI responses
    - Tap to expand and see source documents
  - Implement knowledge source expansion:
    - Show list of documents/FAQs used in that turn
    - Display relevance scores
    - Link to document detail view
    - Highlight relevant text snippets
  - Implement search functionality in conversation history:
    - Search by content (user queries or AI responses)
    - Filter by date range
    - Filter by conversations that used knowledge base
    - Filter by specific documents referenced
  - Create conversation export functionality:
    - Export as PDF with formatting
    - Export as plain text
    - Include source citations in export
    - Option to include/exclude source metadata
  - Implement conversation delete with confirmation
  - Add pull-to-refresh for history updates
  - Create conversation statistics:
    - Total conversations count
    - Total duration
    - Average conversation length
    - Knowledge base usage rate
  - Implement empty state with helpful CTA
  - Add loading skeletons for better UX
  - _Requirements: 9, 14_
  - _Note: Integrates with RAG source tracking from Phase 4.4_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.7 Implement settings and profile screens
  - Create user profile screen with avatar and account information
  - Implement profile editing functionality
  - Implement personality configuration UI (traits, speaking style)
  - Create AI provider selection (LLM, TTS, ASR)
  - Create voice model management screen with model list
  - Implement voice model switching, deletion, and comparison
  - Create face model management screen with preview
  - Implement face model switching and deletion
  - Implement conversation settings (interruption sensitivity, auto-save)
  - Create privacy settings (data retention, consent management, history)
  - Implement notification preferences
  - Create app settings (theme, language, quality preferences)
  - Create subscription and usage screen with analytics
  - Implement about screen with version and legal info
  - _Requirements: 9, 10, 16, 17, 18_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.8 Implement error handling and offline support
  - Create error boundary components for graceful error handling
  - Implement offline detection and queue management
  - Create retry logic for failed operations
  - Implement error message display with recovery actions
  - Create connection status monitoring
  - Implement graceful degradation (audio-only mode, cached responses)
  - _Requirements: 10, 13, 15_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.9 Implement analytics and feedback
  - Create conversation quality feedback UI (rating, comments)
  - Implement usage analytics tracking (conversation duration, features used)
  - Create bug report functionality
  - Implement feature request submission
  - Create in-app help and tutorials
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.10 Implement core mobile services (audio, video, WebSocket, network)
  - **Audio Services:**
    - Create audio recording service using react-native-audio-recorder-player
    - Implement audio playback service with queue management
    - Create audio buffer management for streaming
    - Implement Voice Activity Detection (VAD) using react-native-voice
    - Create audio visualization component with real-time waveform
    - Implement audio quality monitoring and feedback
    - Create audio session management for iOS (AVAudioSession)
    - Implement audio focus handling for Android (AudioManager)
  - **Video Services:**
    - Create video player component using react-native-video
    - Implement video frame rendering and buffering
    - Create audio-video synchronization logic
    - Implement adaptive video quality based on network
    - Create video loading and error states
    - Implement fullscreen video mode
    - Create video performance optimization (frame dropping)
  - **WebSocket Services:**
    - Create WebSocket connection manager with Socket.io
    - Implement connection state management (connecting, connected, disconnected)
    - Create message queue for offline scenarios
    - Implement automatic reconnection with exponential backoff
    - Create message handlers for all server message types
    - Implement heartbeat/ping-pong for connection health
    - Create WebSocket error handling and recovery
  - **Network Services:**
    - Create network status monitoring using @react-native-community/netinfo
    - Implement offline mode detection and UI
    - Create network quality detection (bandwidth, latency)
    - Implement adaptive quality settings based on network
    - Create connection quality indicator in UI
    - Implement graceful degradation (audio-only mode)
  - _Requirements: 1, 6, 7, 10, 15_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.11 Implement UI components and platform features
  - **Component Library:**
    - Create reusable button components (primary, secondary, icon)
    - Implement input components (text, password, search)
    - Create card components for lists and content
    - Implement modal and bottom sheet components
    - Create loading indicators (spinner, skeleton, progress)
    - Implement toast/snackbar for notifications
    - Create animated components (fade, slide, scale)
    - Implement theme system (colors, typography, spacing)
    - Create dark mode support
  - **Platform-Specific Features:**
    - Configure iOS-specific settings (Info.plist permissions)
    - Implement iOS-specific UI adaptations (safe area, notch)
    - Configure Android-specific settings (AndroidManifest.xml permissions)
    - Implement Android-specific UI adaptations (navigation bar, status bar)
    - Create platform-specific audio/video handling
    - Implement iOS background audio support
    - Create Android foreground service for conversations
  - **Accessibility:**
    - Add accessibility labels to all interactive elements
    - Implement screen reader support (VoiceOver, TalkBack)
    - Create high contrast mode support
    - Implement font scaling support
    - Add keyboard navigation support
    - Create focus management for navigation
    - Implement haptic feedback for important actions
  - _Requirements: 1, 6, 7, 13_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.12 Implement app performance and monitoring
  - **Performance Optimization:**
    - Optimize React Native bundle size
    - Implement code splitting and lazy loading
    - Create image optimization and caching
    - Implement list virtualization for long lists
    - Optimize re-renders with React.memo and useMemo
    - Create memory leak detection and prevention
    - Implement app startup time optimization
  - **Analytics and Monitoring:**
    - Integrate Firebase Analytics or similar
    - Implement event tracking for user actions
    - Create screen view tracking
    - Integrate crash reporting (Sentry, Crashlytics)
    - Implement performance monitoring
    - Create user feedback collection mechanism
  - **Notifications and Deep Linking:**
    - Configure deep linking for app navigation
    - Implement push notification setup (FCM for Android, APNs for iOS)
    - Create notification handlers for conversation updates
    - Implement notification permissions request
    - Create notification action handlers
    - Implement badge count management
  - _Requirements: 10, 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 14: Testing and Quality Assurance

- [ ] 14. Implement comprehensive unit tests
  - Write unit tests for all service classes (ASR, RAG, LLM, TTS, Lip-sync)
  - Create unit tests for utility functions and helpers
  - Implement unit tests for state management logic
  - Write unit tests for data models and validation
  - Create unit tests for caching logic
  - Implement unit tests for error handling
  - Target: 80%+ code coverage for core business logic
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 14.1 Implement integration tests
  - Create end-to-end conversation flow tests
  - Implement WebSocket communication tests
  - Write RAG pipeline integration tests
  - Create multi-provider integration tests (Gemini, OpenAI, Chirp)
  - Implement voice model training integration tests
  - Write face model creation integration tests
  - Create database integration tests
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 14.2 Implement performance and load tests
  - Create latency measurement tests for each component
  - Implement load tests for concurrent conversations (10, 100, 1000 users)
  - Write throughput tests (messages/sec, searches/sec, frames/sec)
  - Create resource utilization tests (CPU, memory, GPU, network)
  - Implement spike tests (0 → 500 → 0 users)
  - Write soak tests (100 users for 2 hours)
  - Create performance regression tests
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 14.3 Implement quality tests
  - Create voice quality tests (MOS, similarity measurement)
  - Implement conversation quality tests (accuracy, relevance)
  - Write video quality tests (lip-sync accuracy, frame rate, sync offset)
  - Create A/B testing framework for providers
  - Implement user feedback collection
  - _Requirements: 5, 6, 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 14.4 Implement security tests
  - Create authentication bypass tests
  - Implement unauthorized access tests
  - Write SQL injection tests
  - Create XSS vulnerability tests
  - Implement rate limiting enforcement tests
  - Write DDoS resilience tests
  - Create data encryption verification tests
  - Use OWASP ZAP and Burp Suite for penetration testing
  - _Requirements: 10, 12_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 14.5 Implement user acceptance tests
  - Create test scenarios for first-time user onboarding
  - Implement voice model training and selection tests
  - Write document upload and knowledge base tests
  - Create natural conversation with interruptions tests
  - Implement network disconnection and recovery tests
  - Write error handling and user feedback tests
  - Create multi-device usage tests
  - Target: 90%+ task completion rate, 4.5/5.0+ satisfaction
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 15: Deployment and Launch

- [ ] 15. Finalize deployment configuration
  - Review and optimize Terraform configurations
  - Implement blue-green deployment strategy
  - Create rollback procedures
  - Set up monitoring dashboards (Grafana, Cloud Console)
  - Configure alerting rules (PagerDuty, Slack, Email)
  - Implement cost tracking and optimization
  - Create disaster recovery procedures
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 15.1 Implement CI/CD pipeline
  - Create GitHub Actions workflows for automated testing
  - Implement automated build and push to GCR
  - Set up automated deployment to staging
  - Create manual approval for production deployment
  - Implement automated rollback on failure
  - Create deployment notifications
  - _Requirements: 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 15.2 Conduct beta testing
  - Recruit beta testers (target: 50-100 users)
  - Create beta testing feedback forms
  - Implement bug tracking and prioritization
  - Conduct user interviews and surveys
  - Analyze usage patterns and metrics
  - Iterate on feedback and fix critical issues
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 15.3 Prepare for production launch
  - Create user documentation and help center
  - Implement onboarding tutorials and tooltips
  - Set up customer support channels
  - Create marketing materials and landing page
  - Implement analytics and tracking (Google Analytics, Mixpanel)
  - Set up payment processing (Stripe)
  - Create terms of service and privacy policy
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 15.3.1 Prepare mobile app store submissions
  - Create iOS App Store listing (screenshots, description, keywords, app preview video)
  - Create Google Play Store listing (screenshots, description, keywords, feature graphic)
  - Prepare app store assets (app icon in all required sizes, feature graphics, promo video)
  - Set up TestFlight for iOS beta testing distribution
  - Set up Google Play Beta for Android beta testing distribution
  - Implement app store optimization (ASO) strategy (keyword research, competitive analysis)
  - Create app store review guidelines compliance checklist (iOS App Review Guidelines, Google Play Policies)
  - Prepare app store submission documentation (privacy policy URL, support URL, marketing URL)
  - Configure in-app purchase products (if applicable)
  - Set up app store analytics and tracking
  - _Requirements: All mobile requirements (1, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18)_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 15.4 Launch and monitor
  - Deploy to production with phased rollout
  - Monitor system health and performance
  - Track user adoption and engagement metrics
  - Respond to user feedback and issues
  - Implement hotfixes as needed
  - Create post-launch report and retrospective
  - _Requirements: All_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 16: Documentation and Launch Preparation

- [ ] 16. Create comprehensive API documentation
  - Generate OpenAPI 3.0 specification for all REST endpoints
  - Document WebSocket message protocol with JSON schemas
  - Create API reference documentation with request/response examples
  - Write authentication and authorization guide
  - Document rate limiting and error codes
  - Create API versioning and deprecation policy
  - _Requirements: All_

- [ ] 16.1 Create developer integration guides
  - Write quickstart guide for API integration
  - Create step-by-step tutorials for common use cases
  - Document webhook integration for events
  - Write best practices guide for API usage
  - Create troubleshooting guide with common issues
  - Document API client SDKs (JavaScript, Python, Go)
  - _Requirements: All_

- [ ] 16.2 Create interactive API documentation
  - Set up Swagger UI for REST API exploration
  - Create Postman collection with example requests
  - Implement API playground for testing
  - Create WebSocket testing tool
  - Document code examples in multiple languages
  - Create video tutorials for API usage
  - _Requirements: All_

- [ ] 16.3 Document system architecture
  - Create architecture diagrams (C4 model)
  - Document data flow diagrams
  - Create sequence diagrams for key flows
  - Document deployment architecture
  - Create infrastructure diagrams
  - Document security architecture
  - _Requirements: All_

- [ ] 16.4 Create operational documentation
  - Write deployment runbook
  - Create incident response procedures
  - Document monitoring and alerting setup
  - Write disaster recovery procedures
  - Create scaling guidelines
  - Document backup and restore procedures
  - _Requirements: 11_

- [ ] 16.5 Implement documentation validation
  - Create OpenAPI spec validation script
  - Implement documentation linting (markdownlint)
  - Create broken link checker for documentation
  - Implement code example validation
  - Create API documentation coverage checker
  - Write documentation build and deploy pipeline
  - Implement documentation versioning
  - _Requirements: All_

- [ ] 16.6 Create documentation quality checks
  - Implement spell checker for documentation
  - Create grammar checker integration
  - Write documentation style guide
  - Implement documentation review checklist
  - Create documentation completeness validator
  - Write documentation accessibility checker
  - _Requirements: All_

- [ ] 16.7 Set up documentation site
  - Create documentation website with Docusaurus or similar
  - Implement documentation search functionality
  - Create documentation navigation structure
  - Implement code syntax highlighting
  - Create interactive code examples
  - Implement documentation feedback mechanism
  - Create documentation analytics
  - _Requirements: All_

- [ ] 16.8 Create validation and pre-deployment scripts
  - Write environment configuration validator
  - Create database migration validator
  - Implement API endpoint health checker
  - Create dependency version checker
  - Write security vulnerability scanner
  - Implement configuration drift detector
  - Create pre-deployment checklist automation
  - _Requirements: 11_

- [ ] 16.9 Implement post-deployment validation
  - Create smoke test suite for production
  - Write API endpoint availability checker
  - Implement critical path validation
  - Create performance baseline validator
  - Write data integrity checker
  - Implement monitoring alert validator
  - Create rollback readiness checker
  - _Requirements: 11_

- [ ] 16.10 Create quality assurance automation
  - Implement code quality checks (ESLint, Prettier)
  - Create code complexity analyzer
  - Write dependency security scanner
  - Implement license compliance checker
  - Create code duplication detector
  - Write technical debt tracker
  - Implement code review automation
  - _Requirements: All_

- [ ] 16.11 Set up continuous documentation
  - Create automated API documentation generation
  - Implement changelog generation from commits
  - Create release notes automation
  - Write architecture diagram generation
  - Implement code-to-documentation sync
  - Create documentation update notifications
  - _Requirements: All_

- [ ] 17. Conduct user acceptance testing
  - Recruit beta testers (target 20-50 users)
  - Create user testing scenarios and scripts
  - Implement feedback collection mechanism
  - Conduct usability testing sessions
  - Analyze feedback and prioritize improvements
  - _Requirements: All_

- [ ] 18. Prepare for production launch
  - Complete security audit and compliance review
  - Create user documentation and help guides
  - Set up customer support channels
  - Configure production monitoring and alerting
  - Create incident response procedures
  - Perform final load testing and optimization
  - Create launch checklist and go-live plan
  - _Requirements: All_
