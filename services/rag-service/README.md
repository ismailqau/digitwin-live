# RAG Service

Retrieval-Augmented Generation (RAG) service for the Real-Time Conversational Clone System.

## Overview

The RAG service provides intelligent knowledge retrieval and context assembly for the conversational AI. It combines vector search, embedding generation, and context management to deliver personalized, accurate responses based on user-specific knowledge bases.

## Features

- **Embedding Generation**: Google Vertex AI text-embedding-004 (768 dimensions)
- **Vector Search**: Dual database support (PostgreSQL pgvector / Weaviate)
- **Context Assembly**: Intelligent context building with conversation history
- **Caching**: PostgreSQL-based caching for embeddings and search results
- **User Isolation**: Complete data isolation per user
- **Health Monitoring**: Built-in health checks for all components

## Architecture

```
Query → Embedding → Vector Search → Context Assembly → LLM Prompt
  ↓         ↓            ↓                ↓
Cache   Cache      PostgreSQL        Conversation
                   or Weaviate         History
```

## Components

### EmbeddingService

Generates embeddings using Google Vertex AI text-embedding-004 model.

```typescript
const embeddingService = new EmbeddingService({
  model: 'text-embedding-004',
  projectId: 'your-project-id',
  location: 'us-central1',
});

const embedding = await embeddingService.embedQuery('What is AI?');
```

### VectorSearchService

Performs similarity search using PostgreSQL pgvector or Weaviate.

```typescript
const vectorSearchService = new VectorSearchService({
  useWeaviate: false, // Use PostgreSQL by default
  postgresql: {
    connectionString: process.env.DATABASE_URL,
    similarityThreshold: 0.7,
  },
});

const results = await vectorSearchService.search(
  embedding,
  5, // topK
  { userId: 'user-123' }
);
```

### ContextAssembler

Assembles context from search results, conversation history, and user profile.

```typescript
const contextAssembler = new ContextAssembler({
  maxConversationTurns: 5,
  maxKnowledgeChunks: 5,
});

const context = contextAssembler.assembleContext(
  query,
  searchResults,
  conversationHistory,
  userProfile
);
```

### CacheService

Manages PostgreSQL-based caching for embeddings and search results.

```typescript
const cacheService = new CacheService(prisma, {
  enabled: true,
  ttlShort: 300, // 5 minutes
  ttlMedium: 3600, // 1 hour
  ttlLong: 86400, // 24 hours
});

// Cache embedding
await cacheService.cacheEmbedding(query, embedding);

// Get cached embedding
const cached = await cacheService.getCachedEmbedding(query);
```

### RAGOrchestrator

Coordinates all RAG components for end-to-end query processing.

```typescript
const ragOrchestrator = new RAGOrchestrator(
  embeddingService,
  vectorSearchService,
  contextAssembler,
  cacheService,
  {
    topK: 5,
    similarityThreshold: 0.7,
    maxConversationTurns: 5,
  }
);

const response = await ragOrchestrator.processQuery({
  query: 'What is my favorite color?',
  userId: 'user-123',
  userProfile: {
    name: 'John',
    personalityTraits: ['friendly', 'helpful'],
    speakingStyle: 'casual',
  },
  conversationHistory: [],
});
```

## Configuration

### Environment Variables

```bash
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Vector Database Selection
WEAVIATE_ENABLED=false  # Use PostgreSQL by default
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=your-api-key

# Caching (PostgreSQL-based)
ENABLE_CACHING=true
CACHE_TTL_SHORT=300      # 5 minutes
CACHE_TTL_MEDIUM=3600    # 1 hour
CACHE_TTL_LONG=86400     # 24 hours

# RAG Configuration
SIMILARITY_THRESHOLD=0.7
RAG_TOP_K=5
MAX_CONVERSATION_TURNS=5
```

## Usage

### Initialize Service

```typescript
import { initializeRAGService } from '@clone/rag-service';

const ragService = initializeRAGService({
  projectId: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION,
  databaseUrl: process.env.DATABASE_URL,
  weaviateEnabled: process.env.WEAVIATE_ENABLED === 'true',
  cacheEnabled: true,
  similarityThreshold: 0.7,
  topK: 5,
  maxConversationTurns: 5,
});
```

### Process Query

```typescript
const response = await ragService.processQuery({
  query: 'What are my hobbies?',
  userId: 'user-123',
  userProfile: {
    name: 'Alice',
    personalityTraits: ['creative', 'analytical'],
    speakingStyle: 'professional',
  },
  conversationHistory: [
    {
      userTranscript: 'Hello',
      llmResponse: 'Hi! How can I help you today?',
      timestamp: new Date(),
    },
  ],
  filters: {
    sourceType: 'document',
  },
});

console.log('Prompt:', response.prompt);
console.log('Search Results:', response.searchResults);
console.log('Metrics:', response.metrics);
```

### Health Check

```typescript
const health = await ragService.healthCheck();
console.log('Status:', health.status);
console.log('Components:', health.components);
```

## Database Schema

### PostgreSQL pgvector

The service uses PostgreSQL with the pgvector extension for vector storage and search.

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks with embeddings
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768), -- 768-dimensional vectors
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Indexes for efficient search
CREATE INDEX idx_document_chunks_user_id ON document_chunks(user_id);
CREATE INDEX idx_document_chunks_vector ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Cache Tables

```sql
-- Embedding cache
CREATE TABLE embedding_cache (
  id UUID PRIMARY KEY,
  query_hash VARCHAR(64) UNIQUE NOT NULL,
  embedding FLOAT8[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Vector search cache
CREATE TABLE vector_search_cache (
  id UUID PRIMARY KEY,
  query_hash VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(query_hash, user_id)
);
```

## Performance

### Latency Targets

- **Embedding Generation**: < 200ms
- **Vector Search**: < 100ms (with proper indexing)
- **Context Assembly**: < 50ms
- **Total RAG Pipeline**: < 200ms

### Caching Strategy

- **Embeddings**: Cached for 1 hour (CACHE_TTL_MEDIUM)
- **Search Results**: Cached for 5 minutes (CACHE_TTL_SHORT)
- **Cache Hit Rate**: Target > 60% for common queries

### Optimization Tips

1. **Use PostgreSQL caching** (NOT Redis) - already configured
2. **Enable pgvector IVFFlat index** for faster searches
3. **Batch embedding generation** for document processing
4. **Limit topK** to 3-5 for optimal context size
5. **Periodic cache cleanup** to prevent bloat

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test --coverage

# Type check
pnpm type-check
```

## Monitoring

### Health Check Endpoint

```typescript
const health = await ragService.healthCheck();
// Returns: { status: 'healthy' | 'unhealthy', components: {...} }
```

### Metrics to Monitor

- Query latency (embedding, search, total)
- Cache hit rate
- Search result count
- Similarity scores
- Error rates

## Troubleshooting

### No Search Results

- Check similarity threshold (default: 0.7)
- Verify user has uploaded documents
- Check vector database connection
- Verify embeddings are generated correctly

### High Latency

- Enable caching (ENABLE_CACHING=true)
- Check database indexes
- Reduce topK value
- Monitor GCP Vertex AI quotas

### Cache Not Working

- Verify PostgreSQL connection
- Check cache TTL settings
- Run cache cleanup: `await cacheService.cleanup()`
- Check cache table indexes

## References

- [Vector Database Setup](../../docs/VECTOR-DATABASE.md)
- [Caching Architecture](../../docs/CACHING-ARCHITECTURE.md)
- [Database Architecture](../../docs/DATABASE-ARCHITECTURE.md)
- [GCP Management](../../docs/GCP-MANAGEMENT.md)

## License

Private - Real-Time Conversational Clone System
