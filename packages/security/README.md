# @clone/security

Security utilities for user data isolation, audit logging, and access controls.

## Features

- **Audit Logging**: Track sensitive operations (authentication, document uploads, model creation, rate limits, content policy violations)
- **Access Control**: Verify resource ownership and prevent cross-user data leakage
- **Data Retention**: Manage data lifecycle with configurable retention policies
- **Cleanup Jobs**: Automated cleanup of expired data (conversations, audit logs, cache, soft-deleted resources)

## Installation

```bash
pnpm add @clone/security
```

## Usage

### Audit Logging

```typescript
import { AuditLogger, AuditAction } from '@clone/security';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@clone/logger';

const prisma = new PrismaClient();
const logger = new Logger({ service: 'my-service' });
const auditLogger = new AuditLogger(prisma, logger);

// Log authentication event
await auditLogger.logAuth(
  'user-123',
  AuditAction.USER_LOGIN,
  'success',
  '192.168.1.1',
  'Mozilla/5.0'
);

// Log document operation
await auditLogger.logDocumentOperation(
  'user-123',
  AuditAction.DOCUMENT_UPLOAD,
  'doc-123',
  'success',
  { filename: 'report.pdf', sizeBytes: 1024000 }
);

// Log rate limit violation
await auditLogger.logRateLimitViolation('user-123', '/api/v1/documents', '192.168.1.1');

// Log content policy violation
await auditLogger.logContentPolicyViolation(
  'user-123',
  'inappropriate content',
  'profanity detected'
);

// Get user's audit logs
const logs = await auditLogger.getUserAuditLogs('user-123', {
  limit: 50,
  action: AuditAction.DOCUMENT_UPLOAD,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
});
```

### Access Control

```typescript
import { AccessControl, AuditLogger } from '@clone/security';

const auditLogger = new AuditLogger(prisma);
const accessControl = new AccessControl(prisma, auditLogger);

// Verify document ownership
try {
  await accessControl.verifyDocumentOwnership('user-123', 'doc-456', '192.168.1.1');
  // User owns the document, proceed with operation
} catch (error) {
  // User doesn't own the document or it doesn't exist
  // Audit log has been created automatically
}

// Verify voice model ownership
await accessControl.verifyVoiceModelOwnership('user-123', 'voice-456');

// Verify face model ownership
await accessControl.verifyFaceModelOwnership('user-123', 'face-456');

// Verify conversation ownership
await accessControl.verifyConversationOwnership('user-123', 'session-456');

// Get user's resource IDs for bulk operations
const documentIds = await accessControl.getUserDocumentIds('user-123');
const voiceModelIds = await accessControl.getUserVoiceModelIds('user-123');
```

### Data Retention

```typescript
import { DataRetentionService } from '@clone/security';

const dataRetention = new DataRetentionService(prisma, logger, {
  conversationHistoryDays: 30,
  auditLogDays: 90,
  cacheTTL: {
    short: 300, // 5 minutes
    medium: 3600, // 1 hour
    long: 86400, // 24 hours
  },
});

// Clean up expired conversation history
const sessionsDeleted = await dataRetention.cleanupConversationHistory();

// Clean up expired audit logs
const logsDeleted = await dataRetention.cleanupAuditLogs();

// Clean up expired cache entries
const cacheResults = await dataRetention.cleanupExpiredCache();

// Clean up soft-deleted resources
const softDeletedResults = await dataRetention.cleanupSoftDeletedResources();

// Run all cleanup jobs
const results = await dataRetention.runAllCleanupJobs();

// Get user-specific retention settings
const userSettings = await dataRetention.getUserRetentionSettings('user-123');

// Update user-specific retention settings
await dataRetention.updateUserRetentionSettings('user-123', {
  conversationHistoryDays: 60,
});
```

### Cleanup Job

Run the cleanup job as a scheduled task (e.g., daily cron job):

```typescript
import { CleanupJob } from '@clone/security';

const job = new CleanupJob(prisma, logger);

// Run all cleanup tasks
await job.run();

// Run specific cleanup task
await job.runTask('conversations');
await job.runTask('auditLogs');
await job.runTask('cache');
await job.runTask('softDeleted');
await job.runTask('rateLimits');
```

Or run from command line:

```bash
# Run all cleanup tasks
pnpm tsx packages/security/src/cleanup-job.ts

# Or use npm script
pnpm cleanup:data
```

## Audit Actions

Available audit actions:

- `USER_LOGIN` - User login
- `USER_LOGOUT` - User logout
- `USER_REGISTER` - User registration
- `AUTH_FAILED` - Authentication failed
- `DOCUMENT_UPLOAD` - Document uploaded
- `DOCUMENT_DELETE` - Document deleted
- `DOCUMENT_UPDATE` - Document updated
- `DOCUMENT_VIEW` - Document viewed
- `VOICE_MODEL_CREATE` - Voice model created
- `VOICE_MODEL_DELETE` - Voice model deleted
- `VOICE_MODEL_ACTIVATE` - Voice model activated
- `VOICE_SAMPLE_UPLOAD` - Voice sample uploaded
- `FACE_MODEL_CREATE` - Face model created
- `FACE_MODEL_DELETE` - Face model deleted
- `FACE_MODEL_ACTIVATE` - Face model activated
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `CONTENT_POLICY_VIOLATION` - Content policy violated
- `CONVERSATION_START` - Conversation started
- `CONVERSATION_END` - Conversation ended
- `UNAUTHORIZED_ACCESS` - Unauthorized access attempt
- `CROSS_USER_ACCESS_ATTEMPT` - Cross-user access attempt

## Data Retention Policies

Default retention policies:

- **Conversation History**: 30 days (configurable per user)
- **Audit Logs**: 90 days
- **Cache TTL**:
  - Short: 5 minutes (300 seconds)
  - Medium: 1 hour (3600 seconds)
  - Long: 24 hours (86400 seconds)
- **Soft-Deleted Resources**: 30 days grace period before permanent deletion
- **Rate Limit Records**: 24 hours

## Best Practices

1. **Always verify ownership** before accessing user resources
2. **Log all sensitive operations** for audit trail
3. **Run cleanup jobs regularly** (daily recommended)
4. **Configure user-specific retention** for compliance
5. **Monitor audit logs** for security incidents
6. **Use soft deletes** for user data (30-day grace period)

## Integration with Services

### API Gateway

```typescript
import { AccessControl, AuditLogger } from '@clone/security';

// Middleware for verifying document ownership
app.get('/api/v1/documents/:id', async (req, res) => {
  try {
    await accessControl.verifyDocumentOwnership(req.user.id, req.params.id, req.ip);

    const document = await prisma.knowledgeDocument.findUnique({
      where: { id: req.params.id },
    });

    res.json(document);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});
```

### WebSocket Server

```typescript
// Log conversation events
socket.on('conversation:start', async (data) => {
  await auditLogger.log({
    userId: socket.user.id,
    action: AuditAction.CONVERSATION_START,
    resource: `session:${data.sessionId}`,
    result: 'success',
    ipAddress: socket.handshake.address,
  });
});
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test --coverage
```

## License

MIT
