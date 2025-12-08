---
inclusion: always
---

# Security Guidelines

## Core Principles

1. **User Data Isolation**: All queries filter by `userId` (see `database-patterns.md`)
2. **Audit Logging**: All sensitive operations are logged
3. **Input Validation**: All input is validated with Zod (see `validation-patterns.md`)
4. **Soft Deletes**: User data uses soft deletes for recovery (see `database-patterns.md`)

## Access Control

Use `@clone/security` for access control:

```typescript
import { AccessControl, AuditLogger } from '@clone/security';

// Verify resource ownership before access
await accessControl.verifyDocumentOwnership(userId, documentId, ipAddress);
await accessControl.verifyVoiceModelOwnership(userId, voiceModelId);
await accessControl.verifyFaceModelOwnership(userId, faceModelId);
await accessControl.verifyConversationOwnership(userId, sessionId);
```

## Audit Logging

Log all sensitive operations:

```typescript
import { AuditLogger, AuditAction } from '@clone/security';

// Authentication events
await auditLogger.logAuth(userId, AuditAction.USER_LOGIN, 'success', ipAddress, userAgent);

// Document operations
await auditLogger.logDocumentOperation(userId, AuditAction.DOCUMENT_UPLOAD, documentId, 'success', {
  filename: 'report.pdf',
  sizeBytes: 1024000,
});

// Security events
await auditLogger.logUnauthorizedAccess(userId, resourceType, resourceId, ipAddress);
await auditLogger.logRateLimitViolation(userId, endpoint, ipAddress);
```

## No Hardcoded Secrets

```typescript
// ❌ Bad
const apiKey = 'sk-1234567890abcdef';

// ✅ Good
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
```

## SQL Injection Prevention

Always use Prisma's parameterized queries:

```typescript
// ❌ Bad - SQL injection risk
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Good - Prisma handles parameterization
const user = await prisma.user.findUnique({
  where: { id: userId },
});
```

## Input Validation

See `validation-patterns.md` for detailed Zod validation patterns.

## Authentication

- Use JWT tokens for API authentication
- Implement token refresh mechanism
- Set appropriate token expiration times
- Use secure HTTP-only cookies where applicable

## Data Encryption

- **At Rest**: Cloud SQL automatic encryption (AES-256)
- **In Transit**: TLS 1.3 for all connections
- **Sensitive Fields**: Encrypt PII before storage

## Rate Limiting

Implement rate limiting for all public endpoints:

```typescript
// Rate limit configuration by subscription tier
const rateLimits = {
  free: { requests: 100, window: '1h' },
  pro: { requests: 1000, window: '1h' },
  enterprise: { requests: 10000, window: '1h' },
};
```

## Content Safety

See `validation-patterns.md` for content safety checking patterns.

## Data Retention

- **Conversation History**: 30 days (configurable)
- **Audit Logs**: 90 days
- **Soft-Deleted Resources**: 30 days grace period
- **Cache Entries**: TTL-based expiration
