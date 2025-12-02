---
inclusion: fileMatch
fileMatchPattern: 'apps/api-gateway/**/*'
---

# API Gateway Patterns

## REST API Structure

The API Gateway follows RESTful conventions:

```
/api/v1/users
/api/v1/documents
/api/v1/conversations
/api/v1/voice-models
/api/v1/face-models
```

## Request Validation

All requests are validated using Zod schemas:

```typescript
import { z } from 'zod';
import { ValidationError } from '@clone/errors';

const createDocumentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string(),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024),
});

app.post('/api/v1/documents', async (req, res) => {
  const result = createDocumentSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }
  // Process validated data
});
```

## Response Format

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "timestamp": "2024-12-02T10:00:00.000Z",
    "requestId": "abc-123"
  }
}
```

## Authentication Middleware

```typescript
import { verifyToken } from '@clone/service-auth';

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = await verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

## Error Handling Middleware

```typescript
import { AppError } from '@clone/errors';
import { logger } from '@clone/logger';

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
    });
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId: req.id,
    },
  });
};
```

## Rate Limiting

```typescript
import { RateLimitRepository } from '@clone/database';

const rateLimitMiddleware = async (req, res, next) => {
  const userId = req.user?.id;
  const endpoint = req.path;

  const allowed = await rateLimitRepository.checkLimit(userId, endpoint);
  if (!allowed) {
    return res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
      },
    });
  }

  next();
};
```

## OpenAPI Documentation

API documentation is auto-generated and available at `/docs` when running.

```typescript
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * @openapi
 * /api/v1/documents:
 *   post:
 *     summary: Upload a document
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentUpload'
 */
```
