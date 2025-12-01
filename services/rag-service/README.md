# RAG Service

Retrieval-Augmented Generation (RAG) service using PostgreSQL with pgvector extension for vector similarity search.

## 🎯 Usage

**This service is designed to be used as a library/package, not as a standalone microservice.**

✅ **Recommended:** Import and use within API Gateway  
❌ **Not Recommended:** Deploy as separate Cloud Run service

See [INTEGRATION.md](./INTEGRATION.md) for integration guide.

## Architecture Decision

### Why Library Instead of Microservice?

The RAG service is implemented as a **library/package** rather than a standalone microservice because:

1. **Performance:** Direct function calls (50-100ms) vs HTTP calls (100-200ms)
2. **Cost:** One Cloud Run instance (~$8-15/month) vs two (~$16-30/month)
3. **Simplicity:** One deployment, one database connection pool, shared caching
4. **Development:** Easier to debug and test as a single service

### When to Deploy Standalone?

Only deploy RAG as a separate service if you need:

- Independent scaling (different CPU/memory requirements)
- Separate deployment cycles
- Team separation

For most use cases, **integrate into API Gateway** (see [INTEGRATION.md](./INTEGRATION.md)).

## Overview

The RAG service provides document indexing and semantic search capabilities using:

- **PostgreSQL with pgvector**: Vector database for embeddings storage and similarity search
- **OpenAI Embeddings**: text-embedding-ada-002 model for generating embeddings
- **Intelligent Chunking**: Document chunking with sentence/paragraph preservation
- **Caching**: PostgreSQL-based caching for search results and embeddings

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        RAG Service                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Chunking   │  │  Embedding   │  │   Vector DB  │    │
│  │   Service    │  │   Service    │  │   Service    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                  │                  │            │
│         └──────────────────┴──────────────────┘            │
│                           │                                │
│                    ┌──────▼──────┐                        │
│                    │ RAG Service │                        │
│                    └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  PostgreSQL + pgvector│
                │  - document_chunks    │
                │  - vector_searches    │
                │  - embeddings (1536D) │
                └───────────────────────┘
```

## Features

### Vector Database (PostgreSQL + pgvector)

- **Native PostgreSQL Integration**: Uses pgvector extension for vector operations
- **Cosine Similarity Search**: Fast similarity search using IVFFlat indexing
- **ACID Compliance**: Full transactional support
- **Scalable**: Handles millions of vectors efficiently
- **No Additional Infrastructure**: Uses existing PostgreSQL database

### Document Processing

- **Intelligent Chunking**: Preserves sentence and paragraph boundaries
- **Configurable Chunk Size**: Default 1000 characters with 200 character overlap
- **Metadata Preservation**: Maintains document metadata throughout pipeline
- **Multiple Document Types**: Supports text, PDF, URLs, and files

### Embedding Generation

- **OpenAI text-embedding-ada-002**: 1536-dimensional embeddings
- **Batch Processing**: Efficient batch embedding generation
- **Validation**: Automatic embedding validation and error handling
- **Caching**: PostgreSQL-based caching for generated embeddings

### Search & Retrieval

- **Semantic Search**: Find relevant documents using natural language queries
- **Similarity Threshold**: Configurable similarity threshold (default 0.7)
- **Knowledge Base Filtering**: Filter results by knowledge base
- **Result Ranking**: Results sorted by similarity score
- **Search Analytics**: Track queries and results for optimization

## Installation

```bash
# Install dependencies
pnpm install

# Build the service
pnpm build

# Run tests
pnpm test
```

## Configuration

### Environment Variables

```bash
# Database (includes vector storage)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Vector Configuration
VECTOR_DIMENSIONS=1536  # OpenAI text-embedding-ada-002
VECTOR_INDEX_LISTS=100  # IVFFlat index parameter

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# RAG Configuration
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_MAX_RESULTS=10

# Caching (PostgreSQL-based)
ENABLE_CACHING=true
CACHE_TTL_SHORT=300
CACHE_TTL_MEDIUM=3600
CACHE_TTL_LONG=86400
```

### Database Setup

1. **Install pgvector extension**:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. **Run migrations**:

```bash
pnpm db:migrate
```

3. **Verify setup**:

```bash
./scripts/verify-local-vector-db.sh
```

## Usage

### Initialize Service

```typescript
import { RAGService } from '@clone/rag-service';

const ragService = new RAGService();
await ragService.initialize();
```

### Index Documents

```typescript
await ragService.indexDocument({
  id: 'doc-123',
  title: 'Product Documentation',
  content: 'Your document content here...',
  sourceUrl: 'https://example.com/docs',
  documentType: 'text',
  metadata: {
    category: 'documentation',
    tags: ['product', 'guide'],
  },
  knowledgeBaseId: 'kb-456',
});
```

### Search Documents

```typescript
const results = await ragService.search({
  query: 'How do I configure the service?',
  knowledgeBaseId: 'kb-456',
  maxResults: 10,
  similarityThreshold: 0.7,
});

console.log(`Found ${results.totalResults} results`);
results.results.forEach((result) => {
  console.log(`- ${result.source.title} (${result.similarity})`);
  console.log(`  ${result.content}`);
});
```

### Delete Documents

```typescript
// Delete a single document
await ragService.deleteDocument('doc-123');

// Delete entire knowledge base
await ragService.deleteKnowledgeBase('kb-456');
```

### Health Check

```typescript
const health = await ragService.healthCheck();
console.log('RAG Service Health:', health);
```

## API Reference

### RAGService

#### `initialize(): Promise<void>`

Initialize the RAG service and vector database.

#### `indexDocument(document: DocumentInput): Promise<void>`

Index a document for retrieval.

**Parameters:**

- `document.id`: Unique document identifier
- `document.title`: Document title
- `document.content`: Document content
- `document.sourceUrl`: Optional source URL
- `document.documentType`: Document type (text, pdf, url, file)
- `document.metadata`: Optional metadata
- `document.knowledgeBaseId`: Knowledge base identifier

#### `search(query: RAGQuery): Promise<RAGResponse>`

Search for relevant documents.

**Parameters:**

- `query.query`: Search query text
- `query.knowledgeBaseId`: Optional knowledge base filter
- `query.maxResults`: Maximum results to return (default: 10)
- `query.similarityThreshold`: Minimum similarity score (default: 0.7)

**Returns:**

- `results`: Array of search results with content and similarity scores
- `query`: Original query text
- `totalResults`: Number of results found
- `processingTimeMs`: Query processing time

#### `deleteDocument(documentId: string): Promise<void>`

Delete a document and its chunks from the index.

#### `deleteKnowledgeBase(knowledgeBaseId: string): Promise<void>`

Delete all documents for a knowledge base.

#### `getStats(): Promise<Stats>`

Get RAG service statistics.

#### `healthCheck(): Promise<HealthCheck>`

Check service health status.

## Performance

### Indexing Performance

- **Chunking**: ~1000 chunks/second
- **Embedding Generation**: ~100 chunks/second (OpenAI API limit)
- **Storage**: ~500 chunks/second (PostgreSQL)

### Search Performance

- **Query Embedding**: ~50ms (OpenAI API)
- **Vector Search**: <5ms (PostgreSQL with IVFFlat index)
- **Total Query Time**: ~100-200ms

### Optimization Tips

1. **Use IVFFlat Indexing**: Significantly improves search performance
2. **Batch Embedding Generation**: Process multiple chunks together
3. **Enable Caching**: Cache frequently accessed embeddings and search results
4. **Tune Chunk Size**: Balance between context and performance
5. **Adjust Index Lists**: Higher values improve accuracy, lower values improve speed

## Caching Strategy

The RAG service uses PostgreSQL-based caching (following the caching-guidelines):

### Cached Data

1. **Embeddings**: Cache generated embeddings to avoid re-computation
2. **Search Results**: Cache frequent queries and their results
3. **Document Chunks**: Cache processed chunks for faster re-indexing

### Cache Tables

```sql
-- Embedding cache
CREATE TABLE cache_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) NOT NULL,
  cache_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Search results cache
CREATE TABLE cache_vector_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) NOT NULL,
  cache_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
```

### Cache Cleanup

```typescript
// Automatic cleanup runs periodically
await db.$executeRaw`
  DELETE FROM cache_embeddings WHERE expires_at < NOW();
  DELETE FROM cache_vector_searches WHERE expires_at < NOW();
`;
```

## Monitoring

### Metrics

- Document count per knowledge base
- Average chunk count per document
- Search query latency
- Embedding generation latency
- Cache hit rate

### Health Checks

```bash
# Check service health
curl http://localhost:3000/api/v1/rag/health

# Check vector database
./scripts/verify-local-vector-db.sh
```

## Troubleshooting

### pgvector Extension Not Found

```bash
# Install pgvector
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Slow Search Performance

1. Create IVFFlat index:

```sql
CREATE INDEX CONCURRENTLY document_chunks_embedding_idx
ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

2. Increase `VECTOR_INDEX_LISTS` for better accuracy
3. Enable caching for frequent queries

### OpenAI API Rate Limits

1. Reduce batch size for embedding generation
2. Add delays between API calls
3. Enable embedding caching
4. Consider using a different embedding model

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test vector-database.service.test.ts

# Run with coverage
pnpm test --coverage
```

## Documentation

- [Vector Database Setup](../../docs/VECTOR-DATABASE.md)
- [Caching Architecture](../../docs/CACHING-ARCHITECTURE.md)
- [Database Architecture](../../docs/DATABASE-ARCHITECTURE.md)
- [RAG Query Optimization](../../docs/RAG-QUERY-OPTIMIZATION.md)

## License

[License information]
