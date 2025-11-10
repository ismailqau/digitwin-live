# Document Processing Service

## Overview

The Document Processing Service handles document upload, text extraction, chunking, embedding generation, and vector storage for the RAG (Retrieval-Augmented Generation) pipeline.

## Features

- **Multi-format Support**: PDF, DOCX, TXT, HTML, Markdown
- **Automatic Text Extraction**: Extracts text from various document formats
- **Intelligent Chunking**: Splits documents into overlapping chunks (500-1000 tokens)
- **Batch Embedding**: Generates embeddings in batches for efficiency
- **Background Processing**: Uses Bull/BullMQ for async document processing
- **Progress Tracking**: Real-time status updates via API
- **Error Handling**: Automatic retries with exponential backoff (3 attempts)
- **Storage Integration**: Stores original documents in GCS bucket `digitwin-live-documents`

## Architecture

```
Upload → GCS Storage → Queue → Extract → Chunk → Embed → Vector DB
   ↓                      ↓        ↓        ↓       ↓         ↓
 API                  Bull/MQ   TextExt  Chunker  Vertex  PostgreSQL
```

## API Endpoints

### Upload Document

```http
POST /api/v1/documents
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <binary>
```

**Response:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "filename": "document.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 1024000,
  "uploadedAt": "2025-01-01T00:00:00Z",
  "status": "pending",
  "chunkCount": 0
}
```

### Get Document Status

```http
GET /api/v1/documents/:id/status
Authorization: Bearer <token>
```

**Response:**

```json
{
  "documentId": "uuid",
  "status": "processing",
  "progress": 50,
  "chunkCount": 0
}
```

### List Documents

```http
GET /api/v1/documents
Authorization: Bearer <token>
```

### Delete Document

```http
DELETE /api/v1/documents/:id
Authorization: Bearer <token>
```

## Configuration

### Environment Variables

```bash
# GCS Configuration
GCP_PROJECT_ID=digitwinlive
GCS_BUCKET_DOCUMENTS=digitwin-live-documents

# Processing Configuration
DOCUMENT_CHUNK_SIZE=800          # Tokens per chunk
DOCUMENT_CHUNK_OVERLAP=100       # Overlap tokens
DOCUMENT_BATCH_SIZE=10           # Embeddings per batch
MAX_FILE_SIZE_BYTES=52428800     # 50MB

# Queue Configuration (Bull/BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY=1000           # Base delay in ms
```

## Processing Pipeline

### 1. Upload Phase

- Validate file type and size
- Upload to GCS: `{userId}/{documentId}/{filename}`
- Create database record with status `pending`
- Add to processing queue

### 2. Extraction Phase

- Download from GCS
- Extract text based on content type:
  - **PDF**: pdf-parse
  - **DOCX**: mammoth
  - **TXT**: native fs
  - **HTML**: cheerio
  - **Markdown**: marked
- Store extracted text in database

### 3. Chunking Phase

- Split text into sentences
- Group into chunks (500-1000 tokens)
- Add overlap (100 tokens) between chunks
- Preserve sentence boundaries

### 4. Embedding Phase

- Generate embeddings using Vertex AI text-embedding-004
- Process in batches (10-20 chunks)
- Store in PostgreSQL with pgvector

### 5. Completion Phase

- Update document status to `completed`
- Store chunk count and vector IDs
- Emit completion event

## Error Handling

### Retry Logic

- **Max Retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)
- **Failure**: Status set to `failed` with error message

### Common Errors

- `FILE_TOO_LARGE`: File exceeds 50MB limit
- `UNSUPPORTED_TYPE`: File type not supported
- `EXTRACTION_FAILED`: Text extraction error
- `EMBEDDING_FAILED`: Embedding generation error
- `STORAGE_ERROR`: GCS upload/download error

## Monitoring

### Metrics

- Documents processed per hour
- Average processing time
- Success/failure rate
- Queue depth
- Chunk count distribution

### Logs

All processing stages are logged with:

- Document ID
- User ID
- Processing time
- Error details (if any)

## Usage Example

```typescript
import { DocumentService } from '@clone/api-gateway/services/document.service';
import { PrismaClient } from '@clone/database';

const prisma = new PrismaClient();
const documentService = new DocumentService(prisma);

// Upload document
const document = await documentService.uploadDocument(userId, file);

// Check status
const status = await documentService.getProcessingStatus(document.id, userId);

// Get document
const doc = await documentService.getDocument(document.id, userId);

// Delete document
await documentService.deleteDocument(document.id, userId);
```

## Related Documentation

- [RAG Pipeline](./RAG-COVERAGE-SUMMARY.md)
- [Vector Database](./VECTOR-DATABASE.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [GCP Management](./GCP-MANAGEMENT.md)
