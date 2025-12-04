# Database Architecture

This document describes the database architecture for the Real-Time DigiTwin Live System.

## Overview

The system uses **PostgreSQL 15+** as the primary database, hosted on **Google Cloud SQL** for production. The database layer is built with:

- **Prisma ORM**: Type-safe database access with auto-generated TypeScript types
- **Repository Pattern**: Clean separation of data access logic from business logic
- **Connection Pooling**: Efficient management of database connections
- **Multi-level Caching**: PostgreSQL-based L2 cache for performance optimization

## Database Schema

### Core Entities

#### Users

Stores user account information, preferences, and settings.

**Key Fields:**

- `id`: UUID primary key
- `email`: Unique email address
- `personalityTraits`: Array of personality characteristics
- `subscriptionTier`: free, pro, or enterprise
- `settings`: JSON object for user preferences
- `deletedAt`: Soft delete timestamp

**Relationships:**

- One-to-many with VoiceModels
- One-to-many with FaceModels
- One-to-many with ConversationSessions
- One-to-many with KnowledgeDocuments

#### Voice Models

Stores voice cloning model metadata and references.

**Key Fields:**

- `provider`: xtts-v2, google-cloud-tts, or openai-tts
- `modelPath`: Cloud Storage path to model files
- `qualityScore`: 0-1 score indicating voice similarity
- `isActive`: Boolean flag for active model

#### Face Models

Stores face cloning model metadata and references.

**Key Fields:**

- `modelPath`: Cloud Storage path to model artifacts
- `resolution`: JSON object with width/height
- `qualityScore`: 0-1 score indicating face quality
- `isActive`: Boolean flag for active model

#### Conversation Sessions

Tracks conversation sessions between users and their clones.

**Key Fields:**

- `state`: idle, listening, processing, speaking, interrupted, error
- `llmProvider`: Selected LLM provider
- `ttsProvider`: Selected TTS provider
- `totalTurns`: Number of conversation turns
- `averageLatencyMs`: Average response latency
- `totalCost`: Total cost of the session

**Relationships:**

- Many-to-one with User
- One-to-many with ConversationTurns

#### Conversation Turns

Individual question-answer exchanges within a session.

**Key Fields:**

- `userTranscript`: Transcribed user speech
- `llmResponse`: Generated response text
- `asrLatencyMs`, `ragLatencyMs`, `llmLatencyMs`, `ttsLatencyMs`: Performance metrics
- `asrCost`, `llmCost`, `ttsCost`: Cost breakdown

#### Knowledge Documents

User-uploaded documents for the knowledge base.

**Key Fields:**

- `filename`: Original filename
- `contentType`: MIME type
- `textContent`: Extracted text content
- `chunkCount`: Number of embedded chunks
- `status`: pending, processing, completed, failed
- `vectorIds`: Array of vector database IDs
- `deletedAt`: Soft delete timestamp

### Cache Tables

#### Embedding Cache

Caches query embeddings to avoid redundant API calls.

**Key Fields:**

- `queryHash`: Hash of the query text
- `embedding`: Float array of embedding values
- `expiresAt`: Cache expiration timestamp

**TTL:** 1 hour (configurable)

#### Vector Search Cache

Caches vector search results for frequently accessed queries.

**Key Fields:**

- `queryHash`: Hash of query + filters
- `userId`: User ID for isolation
- `results`: JSON object with search results
- `expiresAt`: Cache expiration timestamp

**TTL:** 30 minutes (configurable)

#### LLM Response Cache

Caches LLM responses for common questions (FAQs).

**Key Fields:**

- `promptHash`: Hash of the prompt
- `response`: Generated response text
- `provider`: LLM provider used
- `hitCount`: Number of cache hits
- `expiresAt`: Cache expiration timestamp

**TTL:** 1 hour (configurable)

### System Tables

#### Rate Limits

Implements token bucket algorithm for rate limiting.

**Key Fields:**

- `userId`: User ID
- `endpoint`: API endpoint
- `windowStart`: Time window start
- `requestCount`: Number of requests in window

**Unique Constraint:** (userId, endpoint, windowStart)

#### Audit Logs

Comprehensive audit trail for security and compliance.

**Key Fields:**

- `userId`: User who performed the action
- `action`: Action type (e.g., user.login, document.upload)
- `resource`: Resource ID affected
- `result`: success or failure
- `ipAddress`: Client IP address
- `userAgent`: Client user agent
- `metadata`: JSON object with additional context

## Repository Pattern

### Base Repository Interface

All repositories implement a common interface:

```typescript
interface BaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findMany(where?: any): Promise<T[]>;
  findOne(where: any): Promise<T | null>;
  create(data: any): Promise<T>;
  update(id: string, data: any): Promise<T>;
  delete(id: string): Promise<T>; // Soft delete
  hardDelete(id: string): Promise<T>;
  restore(id: string): Promise<T>;
  count(where?: any): Promise<number>;
  exists(where: any): Promise<boolean>;
}
```

### Repository Implementations

1. **UserRepository**: User account operations
2. **ConversationSessionRepository**: Session management
3. **KnowledgeDocumentRepository**: Document operations
4. **VoiceModelRepository**: Voice model management
5. **FaceModelRepository**: Face model management
6. **CacheRepository**: Cache operations
7. **RateLimitRepository**: Rate limiting
8. **AuditLogRepository**: Audit logging

### Benefits

- **Testability**: Easy to mock repositories for unit tests
- **Maintainability**: Centralized data access logic
- **Type Safety**: Full TypeScript type checking
- **Reusability**: Common operations defined once
- **Flexibility**: Easy to swap implementations

## Soft Delete

User-related data uses soft delete to support:

- **Data Recovery**: Restore accidentally deleted data
- **Compliance**: Retain data for audit purposes
- **User Experience**: Undo delete operations

**Implementation:**

- `deletedAt` timestamp field (NULL = not deleted)
- Queries automatically filter out soft-deleted records
- `restore()` method to undelete records
- `hardDelete()` method for permanent deletion

## Connection Pooling

Prisma automatically manages connection pooling:

- **Default Pool Size**: Based on database configuration
- **Connection Timeout**: 10 seconds
- **Pool Timeout**: 10 seconds
- **Idle Timeout**: 600 seconds

**Cloud SQL Configuration:**

```typescript
// Unix socket connection (recommended for Cloud Run)
DATABASE_URL = 'postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE';

// TCP connection
DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:PORT/DATABASE';
```

## Caching Strategy

### Multi-Level Cache

1. **L1 Cache (Application Memory)**
   - In-memory cache for hot data
   - Managed by application code
   - Fastest access (< 1ms)

2. **L2 Cache (PostgreSQL)**
   - Database-backed cache tables
   - Shared across application instances
   - Fast access (< 10ms)
   - Implemented in this package

3. **L3 Cache (Cloud Storage)**
   - Large objects (voice models, face models)
   - Slowest but unlimited capacity
   - Managed by application code

### Cache Invalidation

- **Time-based (TTL)**: Automatic expiration
- **Event-based**: Invalidate on data updates
- **Manual**: Explicit cache clearing
- **LRU**: Least Recently Used eviction (application level)

### Cache Warming

- Pre-load frequently accessed data on startup
- Background jobs to refresh cache
- Predictive caching based on usage patterns

## Performance Optimization

### Indexes

All foreign keys and frequently queried fields are indexed:

- `users.email`
- `users.deletedAt`
- `voice_models.userId, isActive`
- `face_models.userId, isActive`
- `conversation_sessions.userId, startedAt`
- `knowledge_documents.userId, uploadedAt`
- `knowledge_documents.status`
- `embedding_cache.queryHash`
- `vector_search_cache.queryHash, userId`
- `llm_response_cache.promptHash`
- `rate_limits.userId, endpoint, windowStart`
- `audit_logs.userId, timestamp`

### Query Optimization

1. **Select Only Needed Fields**: Use Prisma's `select` to reduce data transfer
2. **Batch Operations**: Use `createMany`, `updateMany` for bulk operations
3. **Pagination**: Always paginate large result sets
4. **Eager Loading**: Use `include` to avoid N+1 queries
5. **Transactions**: Use for operations that must succeed or fail together

### Monitoring

- Enable query logging in development
- Monitor slow queries (> 100ms)
- Track connection pool utilization
- Alert on connection errors

## Migrations

### Development Workflow

1. Modify `schema.prisma`
2. Create migration: `pnpm prisma migrate dev --name migration_name`
3. Review generated SQL
4. Test migration on local database
5. Commit migration files to Git

### Production Deployment

1. Test migration on staging environment
2. Create database backup
3. Run migration: `pnpm prisma migrate deploy`
4. Verify data integrity
5. Monitor application health
6. Rollback if issues detected

### Migration Best Practices

- **Backward Compatible**: Ensure migrations don't break existing code
- **Incremental**: Make small, focused changes
- **Reversible**: Plan for rollback scenarios
- **Tested**: Test on staging before production
- **Documented**: Add comments explaining complex migrations

## Backup and Recovery

### Backup Strategy

- **Automated Daily Backups**: Cloud SQL automatic backups
- **Retention**: 30 days for production, 7 days for staging
- **Point-in-Time Recovery**: Enabled for production
- **Cross-Region Replication**: For disaster recovery

### Recovery Procedures

1. **Identify Issue**: Determine scope of data loss
2. **Stop Application**: Prevent further data corruption
3. **Restore Backup**: Use Cloud SQL restore feature
4. **Verify Data**: Check data integrity
5. **Resume Application**: Bring services back online
6. **Post-Mortem**: Document incident and improvements

## Security

### Data Encryption

- **At Rest**: Cloud SQL automatic encryption (AES-256)
- **In Transit**: TLS 1.3 for all connections
- **Key Management**: Google Cloud KMS

### Access Control

- **Principle of Least Privilege**: Minimal permissions
- **Service Accounts**: Separate accounts per service
- **IP Whitelisting**: Restrict database access
- **Audit Logging**: Track all database access

### Data Privacy

- **User Data Isolation**: Row-level security by userId
- **Soft Delete**: Preserve data for compliance
- **Data Retention**: Automatic cleanup of old data
- **GDPR Compliance**: Support for data export and deletion

## Monitoring and Alerting

### Key Metrics

- **Connection Pool Utilization**: Alert if > 80%
- **Query Latency**: Alert if p95 > 100ms
- **Error Rate**: Alert if > 1%
- **Disk Usage**: Alert if > 80%
- **Backup Status**: Alert on backup failures

### Dashboards

- **Operations Dashboard**: Real-time metrics
- **Performance Dashboard**: Query performance
- **Cost Dashboard**: Database costs

### Alerts

- **Critical**: Database down, backup failed
- **Warning**: High latency, high connection usage
- **Info**: Slow queries, cache misses

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check connection pool settings
   - Verify network connectivity
   - Review Cloud SQL logs

2. **Slow Queries**
   - Enable query logging
   - Analyze query execution plans
   - Add missing indexes

3. **Migration Failures**
   - Review migration SQL
   - Check for data conflicts
   - Rollback and fix issues

4. **Cache Misses**
   - Review cache TTL settings
   - Check cache invalidation logic
   - Monitor cache hit rates

## Future Enhancements

1. **Read Replicas**: For read-heavy workloads
2. **Sharding**: For horizontal scaling
3. **Time-Series Data**: Separate tables for metrics
4. **Full-Text Search**: PostgreSQL full-text search
5. **Materialized Views**: For complex queries
6. **Partitioning**: For large tables

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl-best-practices.html)
