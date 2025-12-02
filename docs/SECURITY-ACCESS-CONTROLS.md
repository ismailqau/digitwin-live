# Security and Access Controls

This document describes the security measures, access controls, and data protection mechanisms implemented in the Real-Time Conversational Clone System.

## Overview

The system implements comprehensive security controls to ensure:

- **User Data Isolation**: All user data is strictly isolated and access-controlled
- **Audit Logging**: All sensitive operations are logged for compliance and security monitoring
- **Data Retention**: Automated data lifecycle management with configurable retention policies
- **Access Control**: Resource ownership verification prevents cross-user data leakage

## Security Architecture

### Data Encryption

- **At Rest**: All data in Cloud SQL and Cloud Storage is encrypted using Google-managed encryption keys
- **In Transit**: All communication uses TLS 1.3 (HTTPS, WSS)
- **Database**: PostgreSQL with encryption at rest enabled
- **Storage**: GCS buckets with encryption enabled

### Authentication & Authorization

- **JWT-based authentication** for API and WebSocket connections
- **Role-based access control (RBAC)** for user permissions
- **Service-to-service authentication** using JWT tokens
- **Token expiration** and refresh mechanisms

## User Data Isolation

### Principle

All database queries MUST filter by `userId` to ensure users can only access their own data.

### Implementation

The `@clone/security` package provides the `AccessControl` class for verifying resource ownership:

```typescript
import { AccessControl } from '@clone/security';

// Verify document ownership before access
await accessControl.verifyDocumentOwnership(userId, documentId, ipAddress);

// Verify voice model ownership
await accessControl.verifyVoiceModelOwnership(userId, voiceModelId);

// Verify face model ownership
await accessControl.verifyFaceModelOwnership(userId, faceModelId);

// Verify conversation ownership
await accessControl.verifyConversationOwnership(userId, sessionId);
```

### Database Queries

All queries must include `userId` filter:

```typescript
// ✅ CORRECT: Filter by userId
const documents = await prisma.knowledgeDocument.findMany({
  where: {
    userId: currentUserId,
    deletedAt: null,
  },
});

// ❌ WRONG: No userId filter (security vulnerability!)
const documents = await prisma.knowledgeDocument.findMany({
  where: {
    deletedAt: null,
  },
});
```

### Soft Deletes

Resources use soft deletes with a 30-day grace period:

```typescript
// Soft delete (sets deletedAt timestamp)
await prisma.knowledgeDocument.update({
  where: { id: documentId },
  data: { deletedAt: new Date() },
});

// Permanent delete (after 30 days)
await dataRetention.cleanupSoftDeletedResources();
```

## Audit Logging

### Tracked Operations

All sensitive operations are logged to the `audit_logs` table:

- **Authentication**: Login, logout, registration, failed attempts
- **Documents**: Upload, delete, update, view
- **Voice Models**: Create, delete, activate, sample upload
- **Face Models**: Create, delete, activate
- **Rate Limiting**: Exceeded limits
- **Content Policy**: Violations
- **Conversations**: Start, end
- **Access Control**: Unauthorized access, cross-user attempts

### Usage

```typescript
import { AuditLogger, AuditAction } from '@clone/security';

// Log authentication event
await auditLogger.logAuth(userId, AuditAction.USER_LOGIN, 'success', ipAddress, userAgent);

// Log document operation
await auditLogger.logDocumentOperation(userId, AuditAction.DOCUMENT_UPLOAD, documentId, 'success', {
  filename: 'report.pdf',
  sizeBytes: 1024000,
});

// Log rate limit violation
await auditLogger.logRateLimitViolation(userId, endpoint, ipAddress);

// Log content policy violation
await auditLogger.logContentPolicyViolation(userId, content, 'profanity detected');

// Log unauthorized access
await auditLogger.logUnauthorizedAccess(userId, resourceType, resourceId, ipAddress);

// Log cross-user access attempt
await auditLogger.logCrossUserAccessAttempt(
  userId,
  targetUserId,
  resourceType,
  resourceId,
  ipAddress
);
```

### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id UUID NOT NULL,
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  result VARCHAR(50) NOT NULL, -- 'success' or 'failure'
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'
);
```

### Querying Audit Logs

```typescript
// Get user's audit logs
const logs = await auditLogger.getUserAuditLogs(userId, {
  limit: 50,
  offset: 0,
  action: AuditAction.DOCUMENT_UPLOAD,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
});
```

## Data Retention Policies

### Default Policies

- **Conversation History**: 30 days (configurable per user)
- **Audit Logs**: 90 days
- **Cache Entries**: TTL-based expiration
  - Short: 5 minutes (embeddings, audio chunks)
  - Medium: 1 hour (vector searches)
  - Long: 24 hours (LLM responses)
- **Soft-Deleted Resources**: 30 days grace period
- **Rate Limit Records**: 24 hours

### Configuration

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
```

### User-Specific Settings

Users can configure their own retention periods:

```typescript
// Get user's retention settings
const settings = await dataRetention.getUserRetentionSettings(userId);

// Update user's retention settings
await dataRetention.updateUserRetentionSettings(userId, {
  conversationHistoryDays: 60, // Keep for 60 days instead of 30
});
```

## Cleanup Jobs

### Automated Cleanup

Run cleanup jobs regularly (recommended: daily cron job):

```typescript
import { CleanupJob } from '@clone/security';

const job = new CleanupJob(prisma, logger);

// Run all cleanup tasks
await job.run();

// Or run specific tasks
await job.runTask('conversations');
await job.runTask('auditLogs');
await job.runTask('cache');
await job.runTask('softDeleted');
await job.runTask('rateLimits');
```

### Cleanup Tasks

1. **Conversation History**: Delete conversations older than retention period
2. **Audit Logs**: Delete audit logs older than 90 days
3. **Cache Entries**: Delete expired cache entries (TTL-based)
4. **Soft-Deleted Resources**: Permanently delete resources soft-deleted > 30 days ago
5. **Rate Limit Records**: Delete rate limit records older than 24 hours

### Scheduling

Add to `package.json`:

```json
{
  "scripts": {
    "cleanup:data": "tsx packages/security/src/cleanup-job.ts"
  }
}
```

Set up cron job (Linux/macOS):

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/project && pnpm cleanup:data
```

Or use Cloud Scheduler (GCP):

```bash
gcloud scheduler jobs create http cleanup-job \
  --schedule="0 2 * * *" \
  --uri="https://your-api.com/admin/cleanup" \
  --http-method=POST \
  --oidc-service-account-email=scheduler@project.iam.gserviceaccount.com
```

## Access Control Patterns

### API Endpoints

```typescript
import { AuditLogger, AccessControl } from '@clone/security';

const auditLogger = new AuditLogger(prisma);
const accessControl = new AccessControl(prisma, auditLogger);

// Express middleware for access control
app.get('/api/v1/documents/:id', async (req, res) => {
  try {
    // Verify ownership
    await accessControl.verifyDocumentOwnership(req.user.id, req.params.id, req.ip);

    // Fetch document (already filtered by userId in verification)
    const document = await prisma.knowledgeDocument.findUnique({
      where: { id: req.params.id },
    });

    // Log access
    await auditLogger.logDocumentOperation(
      req.user.id,
      AuditAction.DOCUMENT_VIEW,
      req.params.id,
      'success'
    );

    res.json(document);
  } catch (error) {
    // Access denied - audit log already created
    res.status(403).json({ error: error.message });
  }
});
```

### WebSocket Connections

```typescript
// Verify session ownership
socket.on('conversation:message', async (data) => {
  try {
    await accessControl.verifyConversationOwnership(
      socket.user.id,
      data.sessionId,
      socket.handshake.address
    );

    // Process message
    await processMessage(data);
  } catch (error) {
    socket.emit('error', { message: 'Access denied' });
  }
});
```

### Bulk Operations

```typescript
// Get user's resource IDs for bulk operations
const documentIds = await accessControl.getUserDocumentIds(userId);

// Delete multiple documents (already filtered by userId)
await prisma.knowledgeDocument.updateMany({
  where: {
    id: { in: documentIds },
    userId: userId, // Double-check userId
  },
  data: {
    deletedAt: new Date(),
  },
});
```

## Security Best Practices

### 1. Always Verify Ownership

```typescript
// ✅ CORRECT
await accessControl.verifyDocumentOwnership(userId, documentId);
const document = await getDocument(documentId);

// ❌ WRONG
const document = await getDocument(documentId);
// No ownership verification!
```

### 2. Filter All Queries by userId

```typescript
// ✅ CORRECT
const documents = await prisma.knowledgeDocument.findMany({
  where: { userId: currentUserId },
});

// ❌ WRONG
const documents = await prisma.knowledgeDocument.findMany();
```

### 3. Log Sensitive Operations

```typescript
// ✅ CORRECT
await auditLogger.logDocumentOperation(userId, action, documentId, 'success');

// ❌ WRONG
// No audit logging
```

### 4. Use Soft Deletes

```typescript
// ✅ CORRECT
await prisma.knowledgeDocument.update({
  where: { id: documentId },
  data: { deletedAt: new Date() },
});

// ❌ WRONG (no recovery possible)
await prisma.knowledgeDocument.delete({
  where: { id: documentId },
});
```

### 5. Validate Input

```typescript
// ✅ CORRECT
const schema = z.object({
  documentId: z.string().uuid(),
});
const { documentId } = schema.parse(req.params);

// ❌ WRONG
const documentId = req.params.id; // No validation
```

## Monitoring & Alerts

### Security Metrics

Monitor these metrics for security incidents:

- **Failed authentication attempts** (> 5 per minute per IP)
- **Cross-user access attempts** (any occurrence)
- **Rate limit violations** (> 10 per hour per user)
- **Content policy violations** (any occurrence)
- **Unauthorized access attempts** (any occurrence)

### Alert Configuration

```typescript
// Example: Alert on cross-user access attempts
const recentAttempts = await prisma.auditLog.count({
  where: {
    action: AuditAction.CROSS_USER_ACCESS_ATTEMPT,
    timestamp: {
      gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    },
  },
});

if (recentAttempts > 0) {
  // Send alert to security team
  await sendSecurityAlert({
    type: 'cross_user_access',
    count: recentAttempts,
    severity: 'high',
  });
}
```

## Compliance

### GDPR Compliance

- **Right to Access**: Users can export their data via API
- **Right to Deletion**: Soft deletes with 30-day grace period
- **Right to Rectification**: Users can update their data
- **Data Portability**: Export functionality available
- **Audit Trail**: All operations logged for compliance

### Data Export

```typescript
// Export user data
const userData = {
  profile: await prisma.user.findUnique({ where: { id: userId } }),
  documents: await prisma.knowledgeDocument.findMany({
    where: { userId },
  }),
  conversations: await prisma.conversationSession.findMany({
    where: { userId },
    include: { turns: true },
  }),
  voiceModels: await prisma.voiceModel.findMany({ where: { userId } }),
  faceModels: await prisma.faceModel.findMany({ where: { userId } }),
};
```

## Related Documentation

- [Database Architecture](./DATABASE-ARCHITECTURE.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [API Documentation](./API-DOCUMENTATION.md)
- [Error Handling](./ERROR-HANDLING.md)

## Package Reference

See [@clone/security](../packages/security/README.md) for detailed API documentation.
