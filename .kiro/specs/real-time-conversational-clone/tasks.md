# Implementation Plan

## � CRITeICAL STATUS UPDATE

**Last Updated:** December 2, 2024

### Current Implementation Status

**✅ COMPLETED (Phases 1-7, 11, 12):**

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
- **Phase 11:** Health checks, error handling, rate limiting, security
- **Phase 12:** Minimal essential monitoring (3 alerts, GCP Console dashboards, cost optimization)

**🚧 IN PROGRESS (Phase 9):**

- Conversation flow orchestration (partially implemented)
- End-to-end integration testing needed

**❌ NOT STARTED (Critical for MVP):**

- **Phase 13: Mobile App** - Partially implemented, needs full UI implementation
  - ✅ Basic audio services (AudioManager, AudioPlaybackManager, VoiceSampleManager)
  - ✅ Basic hooks (useAudioRecording, useConversation, useVoiceSampleUpload)
  - ✅ Basic components (ConversationScreen, VoiceModelPreview, VoiceSampleRecording)
  - ❌ Navigation structure (React Navigation)
  - ❌ State management (Redux/Zustand)
  - ❌ Authentication screens (login, register, forgot password)
  - ❌ Onboarding flow (7 screens)
  - ❌ Face model creation UI (8 sub-tasks)
  - ❌ Knowledge base management UI
  - ❌ Settings and profile screens
  - ❌ WebSocket client integration
  - ❌ Video player for lip-sync
  - ❌ Error handling and offline support
  - ❌ Push notifications and deep linking
  - ❌ Platform-specific configurations
- **Phase 10:** Performance optimization, caching integration

### Next Steps (Priority Order)

1. **CRITICAL:** Implement mobile app (Phase 13) - Without this, users cannot interact with the system
2. **HIGH:** Complete conversation flow orchestration (Phase 9.2)
3. **MEDIUM:** Integrate caching into services (Phase 10)

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
  - Implement WebSocket connection handler with `ws` (Native WebSocket)
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
  - Implement audio recording in React Native using `expo-audio`
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
  - Integrate audio player in React Native using `expo-audio`
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

- [x] 11.3 Implement API validation and content safety
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

- [x] 11.4 Implement security and access controls
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

- [x] 12. Implement monitoring and observability
  - ✅ Set up Cloud Monitoring for GCP services (minimal essential alerts only)
  - ✅ 3 critical alert policies: high error rate (>5%), high latency (P95 >3s), database failures
  - ✅ Email notification channel configured
  - ✅ Monitoring API enabled in gcp-manage.sh
  - ✅ Monitoring status check added to gcp-manage.sh
  - ✅ Removed non-essential alerts (CPU/Memory - Cloud Run auto-scales)
  - ✅ Removed custom dashboard (use GCP Console built-in dashboards instead)
  - ⚠️ Custom metrics collection - DEFERRED (use GCP Console for detailed metrics)
  - ⚠️ Distributed tracing - DEFERRED (add when needed at scale)
  - ⚠️ Structured logging - DEFERRED (Cloud Run provides basic logging)
  - _Requirements: 11_
  - _Note: Monitoring kept minimal per project philosophy - only essential alerts_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 12.1 Create monitoring dashboards
  - ✅ Use GCP Console built-in dashboards (no custom dashboards needed)
  - ✅ Cloud Run dashboard: https://console.cloud.google.com/run
  - ✅ Cloud SQL dashboard: https://console.cloud.google.com/sql
  - ✅ Monitoring overview: https://console.cloud.google.com/monitoring
  - ✅ Status check via `pnpm gcp:status` shows monitoring status
  - ⚠️ Real-time conversation monitoring - DEFERRED (use GCP Console logs)
  - ⚠️ Custom performance visualization - DEFERRED (use GCP Console metrics)
  - ⚠️ Custom cost dashboard - DEFERRED (use GCP Console billing)
  - _Requirements: 11_
  - _Note: No additional infrastructure needed - use GCP Console built-in tools_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 12.2 Implement cost optimization
  - ✅ Cost estimation via `pnpm gcp:cost` command (already in gcp-manage.sh)
  - ✅ Resource stop/start via `pnpm gcp:stop-all` to save ~$74/month
  - ✅ Cost tracking available in GCP Console billing dashboard
  - ✅ Documentation: docs/GCP-CLEANUP-GUIDE.md for cost optimization
  - ⚠️ Per-conversation cost tracking - DEFERRED (add when needed at scale)
  - ⚠️ Provider cost comparison - DEFERRED (manual comparison sufficient for MVP)
  - ⚠️ Preemptible/spot GPU instances - DEFERRED (no GPU instances yet)
  - ⚠️ Custom cost alerting - DEFERRED (use GCP Console budget alerts)
  - ⚠️ Usage analytics - DEFERRED (use GCP Console analytics)
  - _Requirements: 11, 17_
  - _Note: Cost management via existing gcp-manage.sh commands - no new infrastructure_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 12.3 Implement latency and quality alerting
  - ✅ High latency alert (P95 > 3s) already configured in Terraform
  - ✅ High error rate alert (> 5%) already configured in Terraform
  - ✅ Database failure alert already configured in Terraform
  - ✅ Alerts visible via `pnpm gcp:status` command
  - ⚠️ Voice similarity score alerts - DEFERRED (add when quality metrics are collected)
  - ⚠️ ASR accuracy alerts - DEFERRED (add when accuracy metrics are collected)
  - ⚠️ RAG relevance score alerts - DEFERRED (add when relevance metrics are collected)
  - ⚠️ GPU utilization alerts - DEFERRED (no GPU instances yet)
  - ⚠️ Per-conversation cost alerts - DEFERRED (add when needed at scale)
  - ⚠️ WebSocket health alerts - DEFERRED (covered by error rate alert)
  - _Requirements: 11.3, 11.4, 2.4, 11_
  - _Note: Essential alerts already in place - quality/performance alerts deferred until metrics collection is implemented_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

## Phase 13: React Native Mobile App - Complete UI/UX Implementation (CRITICAL)

### 📝 Implementation Notes

- **CRITICAL**: Mobile app has basic services but needs full UI implementation
- This is the user-facing component that ties everything together
- Without this, users cannot interact with the system
- Priority: HIGH - Required for MVP
- Integrates audio capture, playback, WebSocket communication, and all UI screens

### 🎯 Current Mobile App Status

**✅ Already Implemented (in `apps/mobile-app/src/`):**

- `services/AudioManager.ts` - Audio recording service
- `services/AudioPlaybackManager.ts` - Audio playback service
- `services/ConversationManager.ts` - Conversation state management
- `services/VoiceSampleManager.ts` - Voice sample recording/upload
- `hooks/useAudioRecording.ts` - Audio recording hook
- `hooks/useConversation.ts` - Conversation hook
- `hooks/useVoiceSampleUpload.ts` - Voice sample upload hook
- `components/ConversationScreen.tsx` - Basic conversation screen
- `components/VoiceModelPreview.tsx` - Voice model preview
- `components/VoiceSampleRecording.tsx` - Voice sample recording UI
- Basic tests for audio services

**❌ NOT Implemented (Required for MVP):**

- Navigation structure (React Navigation)
- State management (Redux/Zustand)
- Authentication screens (login, register, forgot password)
- Onboarding flow
- Face model creation UI
- Knowledge base management UI
- Settings and profile screens
- WebSocket client integration
- Video player for lip-sync
- Error handling and offline support
- Platform-specific configurations
- Push notifications
- Deep linking

### 📱 App Architecture Overview

```
apps/mobile-app/
├── src/
│   ├── navigation/           # React Navigation setup
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── MainNavigator.tsx
│   │   └── OnboardingNavigator.tsx
│   ├── screens/              # Screen components
│   │   ├── auth/             # Login, Register, ForgotPassword
│   │   ├── onboarding/       # Welcome, Permissions, Setup
│   │   ├── conversation/     # Main conversation, History
│   │   ├── voice/            # Voice recording, Preview
│   │   ├── face/             # Face capture, Preview
│   │   ├── knowledge/        # Documents, FAQs
│   │   └── settings/         # Profile, Settings, About
│   ├── components/           # Reusable UI components (existing + new)
│   ├── services/             # Business logic services (existing + new)
│   ├── hooks/                # Custom React hooks (existing + new)
│   ├── store/                # State management (Redux/Zustand)
│   ├── api/                  # API client integration
│   ├── utils/                # Utility functions
│   ├── constants/            # App constants
│   ├── theme/                # Theme configuration
│   └── types/                # TypeScript types (existing + new)
├── ios/                      # iOS native code
├── android/                  # Android native code
└── __tests__/                # Test files
```

- [ ] 13. Set up React Native project structure and navigation
  - **13.0.1 Install and configure React Navigation:**
    - Install @react-navigation/native, @react-navigation/stack, @react-navigation/bottom-tabs
    - Install required dependencies: react-native-screens, react-native-safe-area-context, react-native-gesture-handler
    - Create `src/navigation/` directory structure
  - **13.0.2 Create navigation structure:**
    - Create `RootNavigator.tsx` with conditional auth/main rendering
    - Create `AuthNavigator.tsx` (Stack: Splash → Login → Register → ForgotPassword → EmailVerification)
    - Create `OnboardingNavigator.tsx` (Stack: Welcome → Permissions → PersonalitySetup → VoiceSetup → FaceSetup → Complete)
    - Create `MainNavigator.tsx` (Tab: Conversation, History, Knowledge, Settings)
    - Create navigation types in `src/types/navigation.ts`
  - **13.0.3 Set up state management:**
    - Install Zustand (lightweight) or Redux Toolkit
    - Create store structure: `src/store/index.ts`
    - Create slices: auth, user, conversation, settings, ui
    - Implement persistence with AsyncStorage
  - **13.0.4 Configure environment variables:**
    - Install react-native-config
    - Create `.env.development`, `.env.staging`, `.env.production`
    - Configure API_URL, WEBSOCKET_URL, environment-specific settings
  - **13.0.5 Configure platform-specific settings:**
    - Update `ios/Info.plist` with required permissions (microphone, camera, photo library)
    - Update `android/app/src/main/AndroidManifest.xml` with permissions
    - Configure app icons and splash screen
  - _Requirements: 1, 7_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 13.1 Implement authentication screens
  - **13.1.1 Create splash screen:**
    - Create `src/screens/auth/SplashScreen.tsx`
    - Implement app logo animation (fade in, scale)
    - Add loading indicator while checking auth state
    - Auto-navigate to Login or Main based on stored token
    - Handle token refresh on app launch
  - **13.1.2 Create login screen:**
    - Create `src/screens/auth/LoginScreen.tsx`
    - Implement email/password form with validation (Zod schemas from @clone/validation)
    - Add "Remember me" checkbox with secure storage
    - Implement social auth buttons (Google, Apple Sign-In)
    - Add "Forgot Password" link navigation
    - Add "Create Account" link navigation
    - Show loading state during authentication
    - Handle and display authentication errors
    - Implement keyboard-aware scroll view
  - **13.1.3 Create registration screen:**
    - Create `src/screens/auth/RegisterScreen.tsx`
    - Implement multi-step registration form (email → password → name → confirm)
    - Add form validation with real-time feedback
    - Implement password strength indicator
    - Add terms of service and privacy policy checkboxes
    - Show loading state during registration
    - Handle and display registration errors
    - Navigate to email verification on success
  - **13.1.4 Create forgot password screen:**
    - Create `src/screens/auth/ForgotPasswordScreen.tsx`
    - Implement email input with validation
    - Add "Send Reset Link" button
    - Show success message with instructions
    - Add "Back to Login" navigation
    - Handle rate limiting errors
  - **13.1.5 Create email verification screen:**
    - Create `src/screens/auth/EmailVerificationScreen.tsx`
    - Display verification instructions
    - Add "Resend Email" button with cooldown timer
    - Implement deep link handling for verification callback
    - Auto-navigate to onboarding on verification success
  - **13.1.6 Implement biometric authentication:**
    - Install react-native-biometrics
    - Create biometric prompt for Face ID/Touch ID
    - Store biometric preference in settings
    - Add biometric login option on login screen
    - Handle biometric fallback to password
  - **13.1.7 Implement secure token storage:**
    - Install react-native-keychain
    - Create `src/services/SecureStorage.ts` for token management
    - Store JWT access token and refresh token securely
    - Implement token refresh logic in API client
    - Clear tokens on logout
  - **13.1.8 Implement WebSocket client integration and ensure compatibility:**
    - Create `src/services/WebSocketClient.ts` for WebSocket connection management
    - Install socket.io-client for React Native
    - Configure WebSocket connection to backend server at port 3001
    - Implement JWT authentication in WebSocket handshake (pass token in auth header)
    - Create connection state management (connecting, connected, disconnected, reconnecting, error)
    - Implement automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
    - Create event listeners for server messages:
      - `connect` - Connection established
      - `disconnect` - Connection lost
      - `error` - Connection error
      - `authenticated` - Authentication successful
      - `auth_error` - Authentication failed
    - Implement heartbeat/ping-pong mechanism for connection health monitoring
    - Create message queue for offline scenarios (store messages when disconnected)
    - Implement message retry logic for failed sends
    - Add connection quality monitoring (latency tracking via ping/pong)
    - Create WebSocket service hooks for React components:
      - `useWebSocket()` - Access WebSocket connection
      - `useWebSocketEvent(eventName, handler)` - Subscribe to events
      - `useConnectionStatus()` - Monitor connection state
    - Verify WebSocket server compatibility:
      - Test connection handshake with JWT token
      - Verify message format compatibility (JSON structure)
      - Test bidirectional communication (send/receive)
      - Verify event names match server implementation
      - Test reconnection behavior
      - Verify error handling and error message format
    - Implement WebSocket error handling:
      - Handle connection timeout (30s)
      - Handle authentication failures (redirect to login)
      - Handle server errors (display user-friendly message)
      - Handle network errors (show offline indicator)
    - Create WebSocket connection UI indicators:
      - Show connecting spinner during handshake
      - Display connected status (green indicator)
      - Show reconnecting status with retry count
      - Display disconnected status (red indicator)
      - Show error messages with retry button
    - Integrate with existing authentication flow:
      - Connect WebSocket after successful login
      - Disconnect WebSocket on logout
      - Reconnect with new token after refresh
    - Create WebSocket service tests:
      - Test connection establishment
      - Test authentication flow
      - Test reconnection logic
      - Test message sending and receiving
      - Test error handling
      - Mock WebSocket server for testing
  - _Requirements: 10, 15_
  - _Note: WebSocket server runs on port 3001 (apps/websocket-server), ensure mobile app connects to correct endpoint_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 13.2 Implement onboarding flow screens
  - **13.2.1 Create welcome screen:**
    - ✅ Created `src/screens/onboarding/WelcomeScreen.tsx`
    - ✅ Implemented animated feature carousel (4 slides: Voice, Face, Knowledge, Chat)
    - ✅ Added app logo and branding
    - ✅ Created "Get Started" button → navigate to PersonalitySetup
    - ✅ Added "Skip" option for returning users
    - ✅ Implemented animated page indicator dots
  - **13.2.2 Create personality setup screen:**
    - ✅ Created `src/screens/onboarding/PersonalitySetupScreen.tsx`
    - ✅ Implemented personality trait selection (8 traits with multi-select chips)
    - ✅ Added speaking style selection (4 styles: formal, casual, friendly, professional)
    - ✅ Created text input for custom personality description
    - ✅ Added preview of how clone will respond
    - ✅ Implemented "Skip for now" option
    - ✅ Save personality to AsyncStorage (API integration pending backend)
  - **13.2.3 Create voice setup prompt screen:**
    - ✅ Created `src/screens/onboarding/VoiceSetupPromptScreen.tsx`
    - ✅ Explain voice cloning feature and benefits
    - ✅ Show estimated time (5-10 minutes recording)
    - ✅ Add "Set Up Voice Now" button → navigate to voice recording (requests microphone permission just-in-time)
    - ✅ Add "Set Up Later" button → skip to face setup
    - ✅ Display voice quality tips (4 tips with icons)
  - **13.2.4 Create face setup prompt screen:**
    - ✅ Created `src/screens/onboarding/FaceSetupPromptScreen.tsx`
    - ✅ Explain face cloning feature and benefits
    - ✅ Show photo/video requirements (4 requirements)
    - ✅ Add "Set Up Face Now" button → navigate to face capture (requests camera permission just-in-time)
    - ✅ Add "Set Up Later" button → complete onboarding
    - ✅ Display face capture tips (4 tips)
  - **13.2.5 Create onboarding complete screen:**
    - ✅ Created `src/screens/onboarding/OnboardingCompleteScreen.tsx`
    - ✅ Show success animation (animated checkmark with scale/fade)
    - ✅ Display setup summary (personality, voice, face status)
    - ✅ Add "Start Conversation" button → navigate to main app
    - ✅ Show tips for first conversation (4 tips)
    - ✅ Display next steps and background processing info
  - **13.2.6 Implement onboarding progress and navigation:**
    - ✅ Created `OnboardingProgressIndicator` component showing current step
    - ✅ Implemented animated transitions (slide_from_right, fade, slide_from_bottom)
    - ✅ Store onboarding progress in AsyncStorage via OnboardingService
    - ✅ Handle back navigation with confirmation dialog
    - ✅ Mark onboarding complete in authStore and AsyncStorage
    - ✅ Integrated progress indicator in all 5 onboarding screens
    - ✅ Removed upfront permissions screen - permissions requested just-in-time
  - _Requirements: 16, 18_
  - _Documentation: See docs/MOBILE-APP-ONBOARDING.md_
  - _Note: Permissions are now requested just-in-time when user actually needs the feature, following UX best practices_

- [x] 13.3 Implement voice model creation UI
  - **13.3.1 Enhance voice recording screen:**
    - Enhance existing `src/components/VoiceSampleRecording.tsx`
    - Create `src/screens/voice/VoiceRecordingScreen.tsx` wrapper
    - Add guided recording prompts (sentences to read aloud)
    - Implement real-time waveform visualization using `expo-audio` analysis
    - Add recording timer with target duration (5 minutes minimum)
    - Show recording progress bar (current/target duration)
    - Implement pause/resume functionality
    - Add volume level indicator (too quiet/good/too loud)
    - Show audio quality feedback in real-time (SNR, clarity)
  - **13.3.2 Implement recording controls:**
    - Create large, accessible record button with animation
    - Add pause button (appears during recording)
    - Add stop button with confirmation dialog
    - Implement replay functionality for recorded audio
    - Add "Start Over" button to discard and re-record
    - Show recording tips and best practices
  - **13.3.3 Create voice sample review screen:**
    - Create `src/screens/voice/VoiceSampleReviewScreen.tsx`
    - Display list of recorded samples with duration
    - Add playback controls for each sample
    - Show quality score for each sample
    - Implement delete individual sample functionality
    - Add "Record More" button if below minimum
    - Show total recording duration and quality summary
    - Add "Continue to Upload" button when ready
  - **13.3.4 Implement upload progress screen:**
    - Create `src/screens/voice/VoiceUploadScreen.tsx`
    - Show upload progress bar with percentage
    - Display estimated time remaining
    - Add cancel upload button with confirmation
    - Handle upload errors with retry option
    - Show upload success animation
    - Auto-navigate to training status on success
  - **13.3.5 Create voice model training status screen:**
    - Create `src/screens/voice/VoiceTrainingStatusScreen.tsx`
    - Show training progress (queued → processing → training → complete)
    - Display estimated completion time
    - Implement real-time status updates via WebSocket
    - Add push notification when training completes
    - Handle training failures with error message and retry option
    - Show training tips while waiting
  - **13.3.6 Implement voice preview and comparison screen:**
    - Enhance existing `src/components/VoiceModelPreview.tsx`
    - Create `src/screens/voice/VoicePreviewScreen.tsx` wrapper
    - Add text input for custom preview text
    - Implement "Generate Preview" button
    - Show side-by-side comparison: original vs cloned voice
    - Add quality rating input (1-5 stars)
    - Implement "Activate Model" button
    - Add "Re-train" option if quality is poor
    - Show voice similarity score
  - _Requirements: 16_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [x] 13.4 Implement face model creation UI
  - **13.4.1 Create photo capture screen:**
    - Create `src/screens/face/FaceCaptureScreen.tsx`
    - Install `react-native-vision-camera` (high performance)
    - Implement camera preview with front camera default
    - Add face detection overlay using react-native-vision-camera
    - Create alignment guide (oval outline for face positioning)
    - Show real-time face detection feedback (face detected/not detected)
    - Add capture button with animation
    - Implement flash toggle for low-light conditions
    - Add camera flip button (front/back)
  - **13.4.2 Implement guided photo capture flow:**
    - Create multi-step capture flow (3-10 photos required)
    - Guide user through different angles: frontal, slight left, slight right
    - Show progress indicator (3/10 photos captured)
    - Validate each photo for face quality before accepting
    - Display quality feedback: lighting, angle, clarity, face size
    - Auto-capture when face is properly aligned (optional)
    - Add manual capture button as fallback
  - **13.4.3 Implement video recording mode:**
    - Create `src/screens/face/FaceVideoRecordScreen.tsx`
    - Add video recording option (30-60 seconds)
    - Guide user to slowly turn head left and right
    - Show recording progress with timer
    - Implement pause/resume for video recording
    - Validate video for face visibility throughout
    - Extract key frames from video for processing
  - **13.4.4 Create photo/video review gallery:**
    - Create `src/screens/face/FaceReviewScreen.tsx`
    - Display captured photos in grid layout
    - Show quality score badge on each photo
    - Implement tap to view full-size photo
    - Add delete button for individual photos
    - Show video thumbnail with play button
    - Display total capture summary
    - Add "Capture More" button if below minimum
    - Add "Continue to Upload" button when ready
  - **13.4.5 Implement face quality validation:**
    - Create `src/services/FaceQualityValidator.ts`
    - Validate face detection confidence (> 80%)
    - Check lighting quality (not too dark/bright)
    - Validate face angle (frontal ± 30°)
    - Check image resolution (minimum 256x256)
    - Detect blur and reject blurry images
    - Show specific feedback for each quality issue
    - Provide tips for improving capture quality
  - **13.4.6 Create upload progress screen:**
    - Create `src/screens/face/FaceUploadScreen.tsx`
    - Show upload progress with thumbnail previews
    - Display individual photo upload status
    - Show overall progress percentage
    - Add cancel upload button with confirmation
    - Handle upload errors with retry option
    - Auto-navigate to processing status on success
  - **13.4.7 Implement face model processing status screen:**
    - Create `src/screens/face/FaceProcessingStatusScreen.tsx`
    - Show processing stages: uploading → detecting → embedding → training → complete
    - Display estimated completion time (< 30 minutes)
    - Implement real-time status updates via WebSocket
    - Add push notification when processing completes
    - Handle processing failures with specific error messages
    - Show processing tips while waiting
  - **13.4.8 Create face model preview screen:**
    - Create `src/screens/face/FacePreviewScreen.tsx`
    - Generate test video with sample audio
    - Show video player with face model animation
    - Display quality score (0-100)
    - Add "Activate Model" button
    - Implement "Re-capture" option if quality is poor
    - Show comparison: original photo vs animated face
    - Add quality rating input (1-5 stars)
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
  - **13.6.1 Create conversation screen layout:**
    - Enhance existing `src/components/ConversationScreen.tsx`
    - Create `src/screens/conversation/ConversationScreen.tsx` wrapper
    - Implement full-screen layout with video area (top 60%)
    - Add transcript area (bottom 30%)
    - Create floating controls overlay
    - Implement safe area handling for notch/home indicator
  - **13.6.2 Implement video player for clone's face:**
    - Install `expo-av` (Video component)
    - Create `src/components/CloneVideoPlayer.tsx`
    - Implement video frame rendering from WebSocket stream
    - Add video buffering with loading indicator
    - Create placeholder image when video not available
    - Implement video quality selection (auto, low, medium, high)
    - Add fullscreen toggle button
    - Handle video errors gracefully
  - **13.6.3 Create audio waveform visualization:**
    - Create `src/components/AudioWaveform.tsx`
    - Implement real-time waveform during user speech
    - Add animated bars visualization
    - Show volume level indicator
    - Position as floating overlay on video
    - Animate appearance/disappearance with state changes
  - **13.6.4 Implement real-time transcript display:**
    - Create `src/components/TranscriptDisplay.tsx`
    - Show user speech transcript (interim and final)
    - Display clone response text as it streams
    - Implement auto-scroll to latest message
    - Add message timestamps
    - Differentiate user vs clone messages (colors, alignment)
    - Show typing indicator during processing
  - **13.6.5 Create conversation state indicators:**
    - Create `src/components/ConversationStateIndicator.tsx`
    - Implement visual states: idle (gray), listening (green pulse), processing (yellow spin), speaking (blue wave)
    - Add text label for current state
    - Position at top of screen
    - Animate transitions between states
    - Add haptic feedback on state changes
  - **13.6.6 Implement microphone controls:**
    - Create `src/components/MicrophoneButton.tsx`
    - Implement large, accessible mic button
    - Add press-to-talk mode (hold to speak)
    - Add continuous listening mode (tap to toggle)
    - Show recording indicator animation
    - Implement mute/unmute toggle
    - Add visual feedback for audio level
  - **13.6.7 Create interruption handling:**
    - Create `src/components/InterruptButton.tsx`
    - Show interrupt button during clone speaking
    - Implement tap to interrupt with confirmation
    - Send interruption signal via WebSocket
    - Stop audio/video playback immediately
    - Transition to listening state
    - Add haptic feedback on interrupt
  - **13.6.8 Implement conversation controls:**
    - Create `src/components/ConversationControls.tsx`
    - Add mute/unmute microphone button
    - Add speaker on/off button
    - Add video on/off toggle
    - Add end conversation button with confirmation
    - Add settings gear button → open settings modal
    - Position as floating bar at bottom
  - **13.6.9 Create network and quality indicators:**
    - Create `src/components/ConnectionIndicator.tsx`
    - Show connection status (connected, connecting, disconnected)
    - Display network quality (excellent, good, poor)
    - Show audio/video quality metrics
    - Add latency indicator
    - Position at top-right corner
  - **13.6.10 Implement knowledge source indicator:**
    - Create `src/components/KnowledgeSourceBadge.tsx`
    - Show badge when response uses knowledge base
    - Display count: "Using 2 documents" or "Using FAQ"
    - Make badge tappable to show details
    - Position near transcript area
  - **13.6.11 Create knowledge source drawer:**
    - Create `src/components/KnowledgeSourceDrawer.tsx`
    - Implement slide-up bottom sheet
    - List referenced documents with titles
    - Show relevance scores for each source
    - Add tap to view document content
    - Include quick link to knowledge base management
    - Add close button and swipe-to-dismiss
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
  - **13.10.1 Enhance audio recording service:**
    - Enhance existing `src/services/AudioManager.ts`
    - Ensure 16 kHz, mono, 16-bit PCM format
    - Implement 100ms chunk streaming
    - Add audio quality monitoring (SNR, clipping detection)
    - Create audio normalization
    - Implement noise reduction (device-dependent)
    - Add audio format validation
    - Handle microphone permission errors gracefully
  - **13.10.2 Enhance audio playback service:**
    - Enhance existing `src/services/AudioPlaybackManager.ts`
    - Implement audio chunk queue management
    - Create 200-500ms buffer for smooth playback
    - Add audio ducking for interruptions
    - Implement playback speed control (0.5x - 2x)
    - Create crossfade for smooth transitions
    - Handle audio focus (phone calls, notifications)
    - Implement iOS AVAudioSession configuration
    - Implement Android AudioManager focus handling
  - **13.10.3 Implement Voice Activity Detection (VAD):**
    - Create `src/services/VADService.ts`
    - Implement speech onset detection
    - Create silence detection (500ms threshold)
    - Add configurable sensitivity
    - Implement interruption detection during playback
    - Create VAD state callbacks (speaking, silence)
  - **13.10.4 Create video player service:**
    - Create `src/services/VideoPlayerService.ts`
    - Implement video frame buffering
    - Create audio-video synchronization (< 50ms offset)
    - Implement adaptive quality based on network
    - Add frame dropping for performance
    - Create video error handling and recovery
    - Implement fullscreen mode handling
  - **13.10.5 Implement WebSocket client service:**
    - Create `src/services/WebSocketService.ts`
    - Install socket.io-client
    - Implement connection with JWT authentication
    - Create connection state management (connecting, connected, disconnected, error)
    - Implement automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
    - Create message queue for offline scenarios
    - Implement heartbeat/ping-pong for connection health
    - Create message handlers for all server message types:
      - `transcript` (interim and final)
      - `response_start`, `response_audio`, `response_video`, `response_end`
      - `state:changed`, `error`
      - `conversation:interrupted`
    - Implement message sending: `audio_chunk`, `interruption`, `end_utterance`
    - Add WebSocket error handling and recovery
    - Create connection quality monitoring
  - **13.10.6 Implement network monitoring service:**
    - Create `src/services/NetworkService.ts`
    - Install @react-native-community/netinfo
    - Implement network status monitoring (online/offline)
    - Create network quality detection (bandwidth, latency)
    - Implement adaptive quality settings
    - Create offline mode detection and UI notification
    - Implement graceful degradation (audio-only mode when bandwidth < 500 kbps)
    - Add network quality indicator updates
  - **13.10.7 Create audio-video synchronization service:**
    - Create `src/services/AVSyncService.ts`
    - Implement timestamp-based synchronization
    - Create buffer management for both streams
    - Handle sync drift correction
    - Implement frame skipping when behind
    - Add sync quality monitoring
  - _Requirements: 1, 6, 7, 10, 15_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.11 Implement UI components and platform features
  - **13.11.1 Create component library - buttons:**
    - Create `src/components/ui/Button.tsx` (primary, secondary, outline, ghost variants)
    - Create `src/components/ui/IconButton.tsx` (circular icon buttons)
    - Create `src/components/ui/FloatingActionButton.tsx`
    - Implement loading state with spinner
    - Add disabled state styling
    - Implement haptic feedback on press
  - **13.11.2 Create component library - inputs:**
    - Create `src/components/ui/TextInput.tsx` with label and error states
    - Create `src/components/ui/PasswordInput.tsx` with show/hide toggle
    - Create `src/components/ui/SearchInput.tsx` with clear button
    - Create `src/components/ui/TextArea.tsx` for multi-line input
    - Implement form validation integration
    - Add keyboard-aware behavior
  - **13.11.3 Create component library - layout:**
    - Create `src/components/ui/Card.tsx` with shadow and border variants
    - Create `src/components/ui/ListItem.tsx` with icon, title, subtitle
    - Create `src/components/ui/Divider.tsx`
    - Create `src/components/ui/Spacer.tsx`
    - Create `src/components/ui/Container.tsx` with safe area handling
  - **13.11.4 Create component library - feedback:**
    - Create `src/components/ui/Modal.tsx` with backdrop
    - Create `src/components/ui/BottomSheet.tsx` with drag-to-dismiss
    - Create `src/components/ui/Toast.tsx` for notifications
    - Create `src/components/ui/Spinner.tsx` (loading indicator)
    - Create `src/components/ui/Skeleton.tsx` (loading placeholder)
    - Create `src/components/ui/ProgressBar.tsx`
    - Create `src/components/ui/Badge.tsx`
  - **13.11.5 Implement theme system:**
    - Create `src/theme/index.ts` with colors, typography, spacing
    - Implement light and dark mode themes
    - Create `src/hooks/useTheme.ts` hook
    - Create `src/context/ThemeContext.tsx`
    - Implement theme persistence in AsyncStorage
    - Add system theme detection and auto-switch
  - **13.11.6 Configure iOS platform settings:**
    - Update `ios/Info.plist` with all required permissions:
      - NSMicrophoneUsageDescription
      - NSCameraUsageDescription
      - NSPhotoLibraryUsageDescription
      - NSFaceIDUsageDescription
    - Configure background audio mode (UIBackgroundModes: audio)
    - Set up push notification capabilities
    - Configure deep linking (URL schemes)
    - Set app icons and launch screen
  - **13.11.7 Configure Android platform settings:**
    - Update `android/app/src/main/AndroidManifest.xml` with permissions:
      - RECORD_AUDIO, CAMERA, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE
      - INTERNET, ACCESS_NETWORK_STATE
      - FOREGROUND_SERVICE, WAKE_LOCK
    - Create foreground service for active conversations
    - Configure deep linking (intent filters)
    - Set app icons and splash screen
    - Configure notification channels
  - **13.11.8 Implement accessibility features:**
    - Add accessibilityLabel to all interactive elements
    - Add accessibilityHint for complex actions
    - Implement accessibilityRole for semantic meaning
    - Test with VoiceOver (iOS) and TalkBack (Android)
    - Implement font scaling support (up to 200%)
    - Add high contrast mode support
    - Implement focus management for navigation
    - Add haptic feedback for important actions (react-native-haptic-feedback)
  - _Requirements: 1, 6, 7, 13_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.12 Implement app performance and monitoring
  - **13.12.1 Optimize app performance:**
    - Analyze and optimize React Native bundle size
    - Implement React.lazy for screen code splitting
    - Create image optimization with react-native-fast-image
    - Implement list virtualization with FlashList or FlatList
    - Optimize re-renders with React.memo, useMemo, useCallback
    - Create memory leak detection in development mode
    - Optimize app startup time (reduce initial bundle)
    - Implement Hermes engine for Android (if not already)
    - Profile and optimize JavaScript thread performance
  - **13.12.2 Integrate analytics:**
    - Install @react-native-firebase/analytics
    - Create `src/services/AnalyticsService.ts`
    - Implement screen view tracking
    - Track user actions: conversation_started, conversation_ended, document_uploaded, voice_model_created, face_model_created
    - Track feature usage: interruptions, knowledge_base_queries
    - Implement user properties: subscription_tier, voice_model_active, face_model_active
    - Create conversion tracking for onboarding completion
  - **13.12.3 Integrate crash reporting:**
    - Install @sentry/react-native or @react-native-firebase/crashlytics
    - Create `src/services/CrashReportingService.ts`
    - Implement automatic crash reporting
    - Add breadcrumbs for debugging context
    - Create error boundary with crash reporting
    - Implement user feedback on crash
    - Add performance monitoring (app start, screen load times)
  - **13.12.4 Implement push notifications:**
    - Install @react-native-firebase/messaging
    - Create `src/services/NotificationService.ts`
    - Configure FCM for Android
    - Configure APNs for iOS
    - Request notification permissions
    - Handle foreground notifications
    - Handle background notifications
    - Create notification handlers for:
      - Voice model training complete
      - Face model processing complete
      - Document processing complete
    - Implement notification action handlers
    - Create badge count management
  - **13.12.5 Implement deep linking:**
    - Install react-native-linking
    - Configure URL schemes: `digitwinlive://`
    - Create deep link routes:
      - `digitwinlive://conversation` → open conversation screen
      - `digitwinlive://knowledge` → open knowledge base
      - `digitwinlive://settings` → open settings
      - `digitwinlive://verify?token=xxx` → email verification
    - Handle deep links in navigation
    - Implement universal links for iOS
    - Implement app links for Android
  - _Requirements: 10, 11_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.13 Implement mobile app testing
  - **13.13.1 Unit tests for services:**
    - Enhance existing tests in `src/__tests__/`
    - Add tests for WebSocketService
    - Add tests for NetworkService
    - Add tests for VADService
    - Add tests for VideoPlayerService
    - Add tests for AVSyncService
    - Add tests for SecureStorage
    - Add tests for AnalyticsService
    - Target: 80% coverage for services
  - **13.13.2 Component tests:**
    - Create tests for all UI components
    - Test button interactions and states
    - Test form validation
    - Test modal and bottom sheet behavior
    - Test navigation flows
    - Use @testing-library/react-native
  - **13.13.3 Integration tests:**
    - Test authentication flow (login → main app)
    - Test onboarding flow completion
    - Test conversation flow (start → speak → response → end)
    - Test document upload flow
    - Test voice model creation flow
    - Test face model creation flow
  - **13.13.4 E2E tests:**
    - Install Detox for E2E testing
    - Create E2E test for complete user journey
    - Test on iOS simulator
    - Test on Android emulator
    - Create CI/CD integration for E2E tests
  - _Requirements: All mobile requirements_
  - Create appropriate and minimal documentation in /docs with proper links in the root README file, ensuring no redundant information

- [ ] 13.14 Final mobile app integration and polish
  - **13.14.1 End-to-end integration testing:**
    - Test complete conversation flow with backend
    - Verify audio streaming to ASR service
    - Verify transcript display from ASR
    - Verify RAG context retrieval
    - Verify LLM response streaming
    - Verify TTS audio playback
    - Verify lip-sync video playback
    - Test interruption handling end-to-end
    - Test network disconnection and recovery
  - **13.14.2 Performance validation:**
    - Measure end-to-end latency (target: < 2000ms)
    - Measure audio capture latency (target: < 100ms)
    - Measure video playback latency (target: < 300ms)
    - Test with various network conditions (3G, 4G, WiFi)
    - Profile memory usage during long conversations
    - Test battery consumption
  - **13.14.3 UI/UX polish:**
    - Review all screens for consistency
    - Ensure smooth animations and transitions
    - Verify loading states and error handling
    - Test on various device sizes (phone, tablet)
    - Verify dark mode appearance
    - Test accessibility with screen readers
    - Gather user feedback and iterate
  - **13.14.4 App store preparation:**
    - Create app icons in all required sizes
    - Create splash screen assets
    - Prepare app store screenshots
    - Write app store description
    - Create privacy policy and terms of service
    - Configure app signing (iOS certificates, Android keystore)
    - Create TestFlight build for iOS
    - Create internal testing build for Android
  - _Requirements: All mobile requirements (1, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18)_
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
