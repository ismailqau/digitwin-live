# RAG Service API Documentation

## Overview

The RAG (Retrieval-Augmented Generation) Service provides semantic search and document indexing capabilities using PostgreSQL with pgvector extension.

**Base URL (Local):** `http://localhost:3002`  
**Base URL (GCP):** `https://rag-service-yrzc7r3fcq-uc.a.run.app`

## Quick Start

### Start the Service Locally

```bash
# Install dependencies
pnpm install

# Build the service
pnpm build

# Start the service
pnpm start

# Or run in development mode
pnpm dev
```

The service will be available at `http://localhost:3002`

### Access API Documentation

- **Swagger UI:** http://localhost:3002/api/v1/rag/docs
- **OpenAPI Spec (JSON):** http://localhost:3002/api/v1/rag/docs.json
- **Health Check:** http://localhost:3002/api/v1/rag/health

## Environment Variables

```bash
# Service Configuration
RAG_SERVICE_PORT=3002
RAG_SERVICE_HOST=0.0.0.0
NODE_ENV=development

# Database (PostgreSQL with pgvector)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Vector Configuration
VECTOR_DIMENSIONS=1536
VECTOR_INDEX_LISTS=100

# OpenAI API (for embeddings)
OPENAI_API_KEY=your-openai-api-key

# RAG Configuration
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_MAX_RESULTS=10
SIMILARITY_THRESHOLD=0.7

# Caching (PostgreSQL-based per caching-guidelines)
ENABLE_CACHING=true
CACHE_TTL_SHORT=300
CACHE_TTL_MEDIUM=3600
CACHE_TTL_LONG=86400

# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1

# CORS
CORS_ORIGIN=*
```

## API Endpoints

### Health & Status

#### GET /api/v1/rag/health

Health check endpoint with detailed status of all components.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "rag-service",
  "version": "1.0.0",
  "checks": {
    "database": {
      "healthy": true,
      "details": { "connected": true }
    },
    "vectorSearch": {
      "healthy": true,
      "details": { "initialized": true }
    }
  }
}
```

#### GET /api/v1/rag/health/ready

Kubernetes readiness probe endpoint.

**Response:**

```json
{
  "status": "ready",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/v1/rag/health/live

Kubernetes liveness probe endpoint.

**Response:**

```json
{
  "status": "alive",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Document Management

#### POST /api/v1/rag/documents

Index a document for semantic search.

**Request Body:**

```json
{
  "id": "doc-123",
  "title": "Product Documentation",
  "content": "Your document content here...",
  "sourceUrl": "https://example.com/docs",
  "documentType": "text",
  "metadata": {
    "category": "documentation",
    "tags": ["product", "guide"]
  },
  "knowledgeBaseId": "kb-456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Document indexed successfully",
  "documentId": "doc-123"
}
```

**Status Codes:**

- `201` - Document indexed successfully
- `400` - Invalid request (validation error)
- `500` - Server error

#### DELETE /api/v1/rag/documents/:documentId

Delete a document from the index.

**Parameters:**

- `documentId` (path) - Document identifier

**Response:**

```json
{
  "success": true,
  "message": "Document deleted successfully",
  "documentId": "doc-123"
}
```

### Search

#### POST /api/v1/rag/search

Search for relevant documents using semantic similarity.

**Request Body:**

```json
{
  "query": "How do I configure the service?",
  "knowledgeBaseId": "kb-456",
  "maxResults": 10,
  "similarityThreshold": 0.7
}
```

**Response:**

```json
{
  "results": [
    {
      "content": "To configure the service, you need to...",
      "similarity": 0.89,
      "metadata": {
        "title": "Configuration Guide",
        "category": "documentation"
      },
      "source": {
        "documentId": "doc-123",
        "chunkIndex": 2,
        "title": "Configuration Guide"
      }
    }
  ],
  "query": "How do I configure the service?",
  "totalResults": 1,
  "processingTimeMs": 150
}
```

**Status Codes:**

- `200` - Search completed successfully
- `400` - Invalid request (validation error)
- `500` - Server error

### Knowledge Base Management

#### DELETE /api/v1/rag/knowledge-bases/:knowledgeBaseId

Delete all documents for a knowledge base.

**Parameters:**

- `knowledgeBaseId` (path) - Knowledge base identifier

**Response:**

```json
{
  "success": true,
  "message": "Knowledge base deleted successfully",
  "knowledgeBaseId": "kb-456"
}
```

### Statistics

#### GET /api/v1/rag/stats

Get service statistics and health information.

**Response:**

```json
{
  "service": "rag-service",
  "version": "1.0.0",
  "health": {
    "status": "healthy",
    "components": {
      "database": "healthy",
      "vectorSearch": "healthy",
      "embeddingService": "healthy"
    }
  }
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": [
    {
      "path": "field.name",
      "message": "Validation error message"
    }
  ]
}
```

**Common Status Codes:**

- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

## Testing

### Run Tests

```bash
# Run all tests
pnpm test

# Run API tests only
pnpm test -- src/__tests__/api.test.ts

# Run with coverage
pnpm test -- --coverage
```

### Manual Testing with curl

```bash
# Health check
curl http://localhost:3002/api/v1/rag/health

# Index a document
curl -X POST http://localhost:3002/api/v1/rag/documents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-doc-1",
    "title": "Test Document",
    "content": "This is a test document for the RAG service.",
    "knowledgeBaseId": "test-kb-1",
    "documentType": "text"
  }'

# Search documents
curl -X POST http://localhost:3002/api/v1/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test document",
    "maxResults": 5,
    "similarityThreshold": 0.7
  }'

# Get statistics
curl http://localhost:3002/api/v1/rag/stats

# Delete a document
curl -X DELETE http://localhost:3002/api/v1/rag/documents/test-doc-1
```

## Deployment

### Docker

```bash
# Build Docker image
docker build -t rag-service .

# Run container
docker run -p 3002:8080 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e OPENAI_API_KEY=your-key \
  rag-service
```

### GCP Cloud Run

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/rag-service

# Deploy to Cloud Run
gcloud run deploy rag-service \
  --image gcr.io/PROJECT_ID/rag-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=postgresql://... \
  --set-env-vars OPENAI_API_KEY=...
```

## Architecture

### PostgreSQL with pgvector

The RAG service uses PostgreSQL with the pgvector extension for vector storage and similarity search:

```sql
-- Document chunks table with vector embeddings
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-ada-002
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector similarity index for fast search
CREATE INDEX document_chunks_embedding_idx
ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Caching Strategy

Following the caching-guidelines, the RAG service uses PostgreSQL-based caching:

- **Embedding Cache:** Cache generated embeddings to avoid re-computation
- **Search Results Cache:** Cache frequent queries and their results
- **TTL Configuration:** Short (5min), Medium (1hr), Long (24hr)

### Performance

- **Embedding Generation:** ~50ms per query (OpenAI API)
- **Vector Search:** <5ms (PostgreSQL with IVFFlat index)
- **Total Query Time:** ~100-200ms end-to-end

## Monitoring

### Health Checks

- **Liveness:** `/api/v1/rag/health/live` - Process is running
- **Readiness:** `/api/v1/rag/health/ready` - Service can accept requests
- **Health:** `/api/v1/rag/health` - Detailed component status

### Metrics

Monitor these key metrics:

- Request latency (p50, p95, p99)
- Error rate
- Database connection pool usage
- Vector search performance
- Cache hit rate

## Support

- **Documentation:** [services/rag-service/README.md](./README.md)
- **Swagger UI:** http://localhost:3002/api/v1/rag/docs
- **GitHub Issues:** [repository-url]/issues

## License

[License information]
