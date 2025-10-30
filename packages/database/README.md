# @clone/database

Database access layer with Prisma ORM and repository pattern for the Real-Time Conversational Clone System.

## Features

- **Prisma ORM**: Type-safe database access with auto-generated types
- **Repository Pattern**: Clean separation of data access logic
- **Soft Delete**: Built-in soft delete support for user data
- **Connection Pooling**: Efficient database connection management
- **Caching**: PostgreSQL-based L2 cache for embeddings, vector search, and LLM responses
- **Rate Limiting**: Token bucket algorithm for API rate limiting
- **Audit Logging**: Comprehensive audit trail for security and compliance
- **Migrations**: Version-controlled database schema changes

## Installation

```bash
pnpm install
```

## Setup

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Update `DATABASE_URL` in `.env` with your PostgreSQL connection string

3. Generate Prisma client:

```bash
pnpm prisma:generate
```

4. Run migrations:

```bash
pnpm prisma:migrate
```

5. Seed the database (optional):

```bash
pnpm prisma:seed
```

## Usage

### Initialize Database Connection

```typescript
import { DatabaseConnection } from '@clone/database';

// Connect to database
await DatabaseConnection.connect();

// Health check
const isHealthy = await DatabaseConnection.healthCheck();

// Disconnect when done
await DatabaseConnection.disconnect();
```

### Using Repositories

```typescript
import { DatabaseConnection, RepositoryFactory } from '@clone/database';

const prisma = DatabaseConnection.getInstance();
const factory = new RepositoryFactory(prisma);

// User operations
const userRepo = factory.getUserRepository();
const user = await userRepo.create({
  email: 'user@example.com',
  name: 'John Doe',
  personalityTraits: ['friendly', 'professional'],
  subscriptionTier: 'free',
  settings: {},
});

// Find user by email
const foundUser = await userRepo.findByEmail('user@example.com');

// Update user
await userRepo.update(user.id, {
  name: 'Jane Doe',
});

// Soft delete
await userRepo.delete(user.id);

// Restore
await userRepo.restore(user.id);
```

### Conversation Sessions

```typescript
const sessionRepo = factory.getConversationSessionRepository();

// Create session
const session = await sessionRepo.create({
  user: { connect: { id: userId } },
  llmProvider: 'gemini-flash',
  ttsProvider: 'xtts-v2',
  state: 'idle',
});

// Update state
await sessionRepo.updateState(session.id, 'listening');

// End session
await sessionRepo.endSession(session.id);

// Get statistics
const stats = await sessionRepo.getUserStatistics(userId);
```

### Knowledge Documents

```typescript
const docRepo = factory.getKnowledgeDocumentRepository();

// Create document
const doc = await docRepo.create({
  user: { connect: { id: userId } },
  filename: 'document.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1024000,
  textContent: 'Document content...',
  storagePath: 'gs://bucket/path',
  status: 'pending',
});

// Update status
await docRepo.updateStatus(doc.id, 'completed');

// Update vector IDs
await docRepo.updateVectorIds(doc.id, ['vec-1', 'vec-2']);

// Search by tags
const docs = await docRepo.searchByTags(userId, ['technical', 'specs']);
```

### Caching

```typescript
const cacheRepo = factory.getCacheRepository();

// Embedding cache
await cacheRepo.setEmbedding('query-hash', [0.1, 0.2, 0.3], 3600);
const embedding = await cacheRepo.getEmbedding('query-hash');

// Vector search cache
await cacheRepo.setVectorSearchResults('query-hash', userId, results, 1800);
const cached = await cacheRepo.getVectorSearchResults('query-hash', userId);

// LLM response cache
await cacheRepo.setLLMResponse('prompt-hash', 'response', 'gemini-flash', 3600);
const response = await cacheRepo.getLLMResponse('prompt-hash');

// Clean expired cache
await cacheRepo.cleanAllExpiredCache();
```

### Rate Limiting

```typescript
const rateLimitRepo = factory.getRateLimitRepository();

// Check and increment
const result = await rateLimitRepo.checkAndIncrement(
  userId,
  '/api/conversations',
  60, // limit
  60 // window in seconds
);

if (!result.allowed) {
  throw new Error(`Rate limit exceeded. Reset at ${result.resetAt}`);
}

// Get status
const status = await rateLimitRepo.getStatus(userId, '/api/conversations', 60);
console.log(`Remaining: ${status.remaining}`);
```

### Audit Logging

```typescript
const auditRepo = factory.getAuditLogRepository();

// Log action
await auditRepo.log({
  userId,
  action: 'document.upload',
  resource: documentId,
  result: 'success',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  metadata: { filename: 'doc.pdf' },
});

// Get user audit logs
const logs = await auditRepo.findByUserId(userId);

// Get statistics
const stats = await auditRepo.getUserStatistics(userId, 30);
```

## Database Schema

### Core Tables

- **users**: User accounts and profiles
- **voice_models**: Voice cloning models
- **face_models**: Face cloning models
- **conversation_sessions**: Conversation sessions
- **conversation_turns**: Individual conversation turns
- **knowledge_documents**: User knowledge base documents

### Cache Tables

- **embedding_cache**: Cached query embeddings
- **vector_search_cache**: Cached vector search results
- **llm_response_cache**: Cached LLM responses

### System Tables

- **rate_limits**: Rate limiting records
- **audit_logs**: Audit trail

## Migrations

### Create a new migration

```bash
pnpm prisma migrate dev --name migration_name
```

### Apply migrations to production

```bash
pnpm prisma:migrate:deploy
```

### Reset database (development only)

```bash
pnpm prisma migrate reset
```

## Prisma Studio

Launch Prisma Studio to view and edit data:

```bash
pnpm prisma:studio
```

## Best Practices

1. **Always use repositories**: Don't access Prisma client directly in application code
2. **Use soft delete**: For user data, use soft delete instead of hard delete
3. **Implement pagination**: For large result sets, always use pagination
4. **Cache frequently accessed data**: Use the cache repository for hot data
5. **Log important actions**: Use audit logging for security-sensitive operations
6. **Clean up old data**: Regularly clean expired cache and old audit logs
7. **Monitor connection pool**: Keep an eye on database connections

## Connection Pooling

Prisma automatically manages connection pooling. Default settings:

- Connection limit: Based on database configuration
- Connection timeout: 10 seconds
- Pool timeout: 10 seconds

For Cloud SQL, use Unix socket connections for better performance:

```
DATABASE_URL="postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE"
```

## Performance Tips

1. **Use indexes**: All foreign keys and frequently queried fields are indexed
2. **Batch operations**: Use `createMany`, `updateMany` for bulk operations
3. **Select only needed fields**: Use `select` to reduce data transfer
4. **Use transactions**: For operations that must succeed or fail together
5. **Monitor slow queries**: Enable query logging in development

## Troubleshooting

### Connection errors

```bash
# Test database connection
pnpm prisma db pull
```

### Migration conflicts

```bash
# Mark migration as applied
pnpm prisma migrate resolve --applied migration_name
```

### Schema out of sync

```bash
# Regenerate Prisma client
pnpm prisma:generate
```

## License

MIT
