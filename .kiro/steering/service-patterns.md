---
inclusion: always
---

# Service & Security Patterns

## Service Structure

```
services/my-service/src/
├── index.ts      # Entry
├── service.ts    # Main class
├── handlers/     # Request handlers
└── providers/    # External integrations
```

## Health Checks

```typescript
app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/ready', async (req, res) => {
  /* check deps */
});
```

## Inter-Service Communication

- gRPC: sync calls via `@clone/grpc-proto`
- Pub/Sub: async events via `@clone/event-bus`

## Security

- All queries filter by `userId`
- Validate all input with Zod
- No hardcoded secrets - use `process.env`
- Use Prisma parameterized queries (no raw SQL)
- JWT auth with refresh tokens

## Access Control

```typescript
import { AccessControl, AuditLogger } from '@clone/security';
await accessControl.verifyDocumentOwnership(userId, documentId, ipAddress);
await auditLogger.logAuth(userId, AuditAction.USER_LOGIN, 'success', ipAddress);
```

## Rate Limits

```typescript
const rateLimits = { free: { requests: 100, window: '1h' }, pro: { requests: 1000, window: '1h' } };
```
