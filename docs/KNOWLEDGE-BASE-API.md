# Knowledge Base Management API

Complete REST API for managing documents, FAQs, and knowledge sources in the Real-Time Conversational Clone System.

## Overview

The Knowledge Base Management API provides comprehensive endpoints for:

- Document upload, management, and processing
- FAQ creation and prioritization
- Knowledge source configuration
- Search and filtering capabilities
- Statistics and usage tracking

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

## Rate Limits

- **Document Upload**: 10 requests/minute per user
- **Batch Upload**: 2 requests/minute per user
- **Search**: 30 requests/minute per user
- **Other Operations**: 100 requests/15 minutes per IP

## Document Management

### Upload Document

```http
POST /api/v1/documents
Content-Type: multipart/form-data

file: <binary>
```

**Supported File Types**: PDF, DOCX, DOC, TXT, HTML, Markdown  
**Max File Size**: 50MB

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "filename": "document.pdf",
  "status": "pending",
  "sizeBytes": 1024000,
  "uploadedAt": "2025-01-01T00:00:00Z"
}
```

### Batch Upload

```http
POST /api/v1/documents/batch
Content-Type: multipart/form-data

files: <binary[]>
```

### List Documents

```http
GET /api/v1/documents?page=1&limit=20&status=completed&sortBy=uploadedAt&order=desc
```

**Query Parameters**:

- `q`: Search query (title, content, tags)
- `status`: Filter by status (pending, processing, completed, failed)
- `fileType`: Filter by file type
- `dateFrom`, `dateTo`: Date range filter
- `sortBy`: Sort field (uploadedAt, processedAt, filename, sizeBytes)
- `order`: Sort order (asc, desc)
- `page`, `limit`: Pagination

### Get Document

```http
GET /api/v1/documents/:id
```

### Get Document Content

```http
GET /api/v1/documents/:id/content
```

Returns first 1000 characters as preview.

### Get Document Chunks

```http
GET /api/v1/documents/:id/chunks
```

Returns all chunks for debugging purposes.

### Update Document

```http
PUT /api/v1/documents/:id
Content-Type: application/json

{
  "title": "Updated Title",
  "tags": ["tag1", "tag2"],
  "sourceUrl": "https://example.com"
}
```

### Delete Document

```http
DELETE /api/v1/documents/:id
```

Performs soft delete and removes from storage.

### Reindex Document

```http
POST /api/v1/documents/:id/reindex
```

Queues document for reprocessing.

### Bulk Operations

```http
POST /api/v1/documents/bulk-delete
Content-Type: application/json

{
  "documentIds": ["uuid1", "uuid2"]
}
```

```http
POST /api/v1/documents/bulk-reindex
Content-Type: application/json

{
  "documentIds": ["uuid1", "uuid2"]
}
```

### Document Statistics

```http
GET /api/v1/documents/stats
```

**Response**:

```json
{
  "totalDocuments": 42,
  "documentsByStatus": {
    "completed": 40,
    "processing": 1,
    "failed": 1
  },
  "documentsByType": {
    "pdf": 30,
    "docx": 10,
    "txt": 2
  },
  "totalStorageBytes": 104857600,
  "processingSuccessRate": 0.95,
  "averageProcessingTimeMs": 15000
}
```

### Storage Usage

```http
GET /api/v1/documents/stats/usage
```

## FAQ Management

### Create FAQ

```http
POST /api/v1/faqs
Content-Type: application/json

{
  "question": "What is this?",
  "answer": "This is an answer.",
  "priority": 80,
  "tags": ["general"]
}
```

### List FAQs

```http
GET /api/v1/faqs?page=1&limit=20
```

FAQs are sorted by priority (descending) then creation date.

### Get FAQ

```http
GET /api/v1/faqs/:id
```

### Update FAQ

```http
PUT /api/v1/faqs/:id
Content-Type: application/json

{
  "question": "Updated question?",
  "answer": "Updated answer.",
  "priority": 90
}
```

### Delete FAQ

```http
DELETE /api/v1/faqs/:id
```

### Reorder FAQs

```http
PUT /api/v1/faqs/reorder
Content-Type: application/json

{
  "faqIds": ["uuid1", "uuid2", "uuid3"]
}
```

Updates priorities based on array order.

## Knowledge Source Priority

### Get Sources

```http
GET /api/v1/knowledge/sources
```

**Response**:

```json
{
  "sources": [
    { "type": "documents", "priority": 1, "enabled": true },
    { "type": "faqs", "priority": 2, "enabled": true },
    { "type": "conversations", "priority": 3, "enabled": true }
  ]
}
```

### Update Priorities

```http
PUT /api/v1/knowledge/sources/priority
Content-Type: application/json

{
  "documents": 1,
  "faqs": 2,
  "conversations": 3
}
```

Lower numbers = higher priority in search results.

### Preview Search

```http
GET /api/v1/knowledge/sources/preview?q=search+query
```

Preview how current priorities affect search results.

## Error Codes

- `400`: Invalid request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `404`: Resource not found
- `409`: Duplicate document
- `413`: File too large (>50MB)
- `415`: Unsupported file type
- `429`: Rate limit exceeded
- `500`: Internal server error

## Caching

Document statistics are cached for 5 minutes using PostgreSQL cache tables. Cache is invalidated on document changes.

## WebSocket Events

Real-time document processing updates:

```javascript
socket.on('document:processing:update', (data) => {
  // { documentId, status, progress }
});

socket.on('document:processing:complete', (data) => {
  // { documentId, chunkCount }
});

socket.on('document:processing:failed', (data) => {
  // { documentId, errorMessage }
});
```

## Related Documentation

- [RAG Pipeline](./RAG-COVERAGE-SUMMARY.md)
- [Document Processing](./DOCUMENT-PROCESSING.md)
- [Vector Database](./VECTOR-DATABASE.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
