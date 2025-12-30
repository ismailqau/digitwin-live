---
inclusion: fileMatch
fileMatchPattern: 'apps/api-gateway/**/*'
---

# API Gateway Patterns

## REST Structure

`/api/v1/users | documents | conversations | voice-models | face-models`

## Response Format

```json
{ "data": {}, "meta": { "page": 1, "limit": 20, "total": 100 } }
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "..." } }
```

## Auth Middleware

```typescript
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = await verifyToken(token);
req.user = decoded;
```

## OpenAPI

Auto-generated at `/docs` using swagger-jsdoc annotations.
