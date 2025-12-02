---
inclusion: always
---

# Database Patterns

## ORM

This project uses **Prisma ORM** with PostgreSQL. The database package is `@clone/database`.

## Repository Pattern

All data access uses the repository pattern:

```typescript
import { prisma } from '@clone/database';

// ✅ Good - Use repository methods
const user = await userRepository.findById(userId);
const documents = await documentRepository.findMany({ userId });

// ❌ Bad - Direct Prisma calls in business logic
const user = await prisma.user.findUnique({ where: { id: userId } });
```

## User Data Isolation

**CRITICAL**: All queries MUST filter by `userId` to ensure data isolation:

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

## Soft Deletes

Use soft deletes for user-related data:

```typescript
// Soft delete (sets deletedAt timestamp)
await prisma.knowledgeDocument.update({
  where: { id: documentId },
  data: { deletedAt: new Date() },
});

// Query excludes soft-deleted records
const documents = await prisma.knowledgeDocument.findMany({
  where: {
    userId,
    deletedAt: null, // Exclude soft-deleted
  },
});

// Hard delete (permanent - use sparingly)
await prisma.knowledgeDocument.delete({
  where: { id: documentId },
});
```

## Query Optimization

### Select Only Needed Fields

```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
    // Don't select large fields if not needed
  },
});
```

### Use Pagination

```typescript
const documents = await prisma.knowledgeDocument.findMany({
  where: { userId },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});
```

### Eager Loading (Avoid N+1)

```typescript
// ✅ Good - Single query with include
const session = await prisma.conversationSession.findUnique({
  where: { id: sessionId },
  include: { turns: true },
});

// ❌ Bad - N+1 queries
const session = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
const turns = await prisma.conversationTurn.findMany({ where: { sessionId } });
```

### Batch Operations

```typescript
// ✅ Good - Batch create
await prisma.knowledgeDocument.createMany({
  data: documents,
});

// ✅ Good - Batch update
await prisma.knowledgeDocument.updateMany({
  where: { userId, status: 'pending' },
  data: { status: 'processing' },
});
```

## Transactions

Use transactions for operations that must succeed or fail together:

```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.userSettings.create({ data: { userId: user.id, ...settings } });
  return user;
});
```

## Migrations

```bash
# Create migration
pnpm db:migrate

# Apply migrations (production)
pnpm db:migrate:deploy

# Reset database (development only)
pnpm db:reset

# Open Prisma Studio
pnpm db:studio
```
