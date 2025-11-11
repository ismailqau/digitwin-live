# RAG Source Tracking and Metadata

This document describes the implementation of source tracking and metadata for the RAG (Retrieval-Augmented Generation) pipeline, enabling detailed analytics and transparency about knowledge sources used in conversations.

## Overview

The RAG source tracking system provides:

- **Source Metadata**: Detailed information about documents, FAQs, and conversation history used to generate responses
- **API Endpoints**: REST endpoints to retrieve source information for conversation turns
- **WebSocket Integration**: Real-time source information in conversation messages
- **Analytics**: Comprehensive analytics about knowledge base usage patterns
- **UI Integration**: Support for displaying source information in conversation interfaces

## Features

### 1. Enhanced RAG Response Metadata

The RAG pipeline now includes detailed source metadata for each retrieved chunk:

```typescript
interface SourceMetadata {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  relevanceScore: number;
  sourceType: 'document' | 'faq' | 'conversation';
  contentSnippet: string;
}
```

### 2. Conversation Turn Source Storage

Retrieved sources are stored in the `ConversationTurn.retrievedChunks` field as an array of chunk IDs, enabling:

- Historical source tracking
- Analytics on knowledge base usage
- Source attribution for responses

### 3. REST API Endpoints

#### Get Turn Sources

```
GET /api/v1/conversations/{sessionId}/turns/{turnId}/sources
```

Returns detailed source information for a specific conversation turn:

```json
{
  "success": true,
  "data": {
    "turnId": "uuid",
    "sessionId": "uuid",
    "sources": [
      {
        "documentId": "uuid",
        "documentTitle": "User Manual",
        "chunkIndex": 5,
        "relevanceScore": 0.85,
        "sourceType": "document",
        "contentSnippet": "To configure the system, navigate to..."
      }
    ],
    "sourceCount": 1,
    "hasKnowledgeBase": true
  }
}
```

#### Get Knowledge Base Analytics

```
GET /api/v1/conversations/analytics?days=30
```

Returns comprehensive analytics about knowledge base usage:

```json
{
  "success": true,
  "data": {
    "totalQueries": 150,
    "queriesWithSources": 120,
    "knowledgeBaseUsageRate": 0.8,
    "averageSourcesPerQuery": 2.3,
    "mostReferencedDocuments": [
      {
        "documentId": "uuid",
        "documentTitle": "User Manual",
        "referenceCount": 45,
        "averageRelevanceScore": 0.82
      }
    ],
    "popularQueries": [...],
    "lowConfidenceQueries": [...]
  }
}
```

### 4. WebSocket Message Enhancement

WebSocket messages now include source metadata:

#### Response Start Message

```typescript
interface ResponseStartMessage {
  type: 'response_start';
  sessionId: string;
  turnId: string;
  sources?: SourceMetadata[];
}
```

#### Response End Message

```typescript
interface ResponseEndMessage {
  type: 'response_end';
  sessionId: string;
  turnId: string;
  sources?: SourceMetadata[];
  metrics: { ... };
}
```

### 5. Analytics and Tracking

The system tracks:

- **Document Usage**: Which documents are referenced most frequently
- **Query Patterns**: Popular queries and low-confidence results
- **Knowledge Base Effectiveness**: Usage rates and source quality
- **Temporal Trends**: Usage patterns over time

## Implementation Details

### Database Schema

The system uses existing Prisma models:

- `ConversationTurn.retrievedChunks`: Stores array of chunk IDs
- `QueryAnalytics`: Tracks query patterns and confidence scores
- `KnowledgeDocument.metadata`: Stores usage statistics

### Caching Strategy

Following the PostgreSQL caching architecture:

- **Vector Search Cache**: Cached search results include source metadata
- **Embedding Cache**: Query embeddings cached for performance
- **Analytics Cache**: Usage statistics cached with TTL

### Services

#### RAGOrchestrator

Enhanced to include source metadata in responses:

```typescript
interface RAGQueryResponse {
  // ... existing fields
  sources: SourceMetadata[];
}
```

#### AnalyticsService

Tracks and analyzes knowledge base usage:

```typescript
class AnalyticsService {
  async trackQuery(query: string, userId: string, ...): Promise<void>
  async getKnowledgeBaseStats(userId: string): Promise<KnowledgeBaseUsageStats>
  async updateDocumentStats(documentIds: string[], scores: number[]): Promise<void>
}
```

#### ConversationService

Manages conversation turns with source tracking:

```typescript
class ConversationService {
  async storeTurn(turnData: ConversationTurnData): Promise<string>;
  async getKnowledgeBaseAnalytics(userId: string): Promise<KnowledgeBaseAnalytics>;
}
```

## Usage Examples

### 1. Storing a Conversation Turn with Sources

```typescript
const turnData: ConversationTurnData = {
  sessionId: 'session-uuid',
  userTranscript: 'How do I configure the system?',
  llmResponse: 'To configure the system, you need to...',
  retrievedChunks: ['chunk-id-1', 'chunk-id-2'], // Source chunk IDs
  // ... other metrics
};

const turnId = await conversationService.storeTurn(turnData);
```

### 2. Retrieving Source Information

```typescript
// Get sources for a specific turn
const response = await fetch('/api/v1/conversations/session-id/turns/turn-id/sources');
const { data } = await response.json();

console.log(`Turn used ${data.sourceCount} sources`);
data.sources.forEach((source) => {
  console.log(`- ${source.documentTitle} (score: ${source.relevanceScore})`);
});
```

### 3. WebSocket Source Tracking

```typescript
socket.on('response_start', (message: ResponseStartMessage) => {
  if (message.sources && message.sources.length > 0) {
    showSourceIndicator(message.sources.length);
  }
});

socket.on('response_end', (message: ResponseEndMessage) => {
  if (message.sources) {
    displaySourceDetails(message.sources);
  }
});
```

## UI Integration

### Conversation Interface

- **Source Indicator**: Badge showing number of sources used
- **Source Drawer**: Expandable panel showing source details
- **Document Links**: Direct links to referenced documents
- **Relevance Scores**: Visual indicators of source quality

### Analytics Dashboard

- **Usage Statistics**: Knowledge base utilization rates
- **Popular Documents**: Most referenced content
- **Query Analysis**: Common questions and low-confidence queries
- **Trends**: Usage patterns over time

## Performance Considerations

### Database Optimization

- **Indexes**: Optimized queries for source retrieval
- **Caching**: PostgreSQL-based caching for frequent queries
- **Batch Operations**: Efficient bulk analytics updates

### API Performance

- **Pagination**: Large result sets paginated
- **Selective Fields**: Optional field filtering
- **Caching Headers**: ETags for conditional requests

## Security and Privacy

### Data Isolation

- **User Scoping**: All queries filtered by user ID
- **Access Control**: RBAC permissions for conversation data
- **Audit Logging**: Source access tracked for compliance

### Data Retention

- **Analytics Cleanup**: Configurable retention periods
- **Privacy Controls**: User data deletion support
- **Anonymization**: Optional query anonymization

## Configuration

### Environment Variables

```bash
# Analytics settings
ENABLE_SOURCE_TRACKING=true
ANALYTICS_RETENTION_DAYS=90
CACHE_TTL_ANALYTICS=3600

# Performance settings
MAX_SOURCES_PER_RESPONSE=5
SOURCE_SNIPPET_LENGTH=200
```

### Feature Flags

- `ENABLE_SOURCE_TRACKING`: Enable/disable source metadata collection
- `ENABLE_ANALYTICS`: Enable/disable usage analytics
- `ENABLE_REALTIME_SOURCES`: Include sources in WebSocket messages

## Monitoring and Alerts

### Metrics

- **Source Tracking Rate**: Percentage of responses with sources
- **Analytics Processing Time**: Performance of analytics queries
- **Storage Growth**: Rate of analytics data accumulation

### Alerts

- **Low Source Quality**: Alert when average relevance scores drop
- **High No-Source Rate**: Alert when too many queries return no sources
- **Analytics Failures**: Alert on analytics processing errors

## Future Enhancements

### Planned Features

1. **FAQ Source Integration**: Track FAQ usage in responses
2. **Conversation History Sources**: Reference previous conversation turns
3. **Source Quality Feedback**: User feedback on source relevance
4. **Advanced Analytics**: ML-based usage pattern analysis
5. **Export Capabilities**: Export analytics data for external analysis

### API Extensions

1. **Bulk Source Retrieval**: Get sources for multiple turns
2. **Source Search**: Search conversations by referenced documents
3. **Usage Recommendations**: Suggest content improvements based on analytics

## Related Documentation

- [RAG Query Optimization](./RAG-QUERY-OPTIMIZATION.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [Database Architecture](./DATABASE-ARCHITECTURE.md)
- [API Documentation](../apps/api-gateway/docs/)

## Support

For questions about RAG source tracking implementation:

1. Check the API documentation at `/api/docs`
2. Review the test files in `services/rag-service/src/__tests__/`
3. Examine the implementation in `services/rag-service/src/services/`
