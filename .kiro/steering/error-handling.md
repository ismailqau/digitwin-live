---
inclusion: always
---

# Error Handling Guidelines

## Error Package

Use `@clone/errors` for all error handling:

```typescript
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  createApiError,
  ErrorCode,
} from '@clone/errors';
```

## Error Codes

| Category | Code                  | HTTP Status | Recoverable |
| -------- | --------------------- | ----------- | ----------- |
| Client   | `VALIDATION_ERROR`    | 400         | No          |
| Client   | `NOT_FOUND`           | 404         | No          |
| Client   | `UNAUTHORIZED`        | 401         | No          |
| Client   | `RATE_LIMIT_EXCEEDED` | 429         | Yes         |
| Service  | `ASR_ERROR`           | 500         | Yes         |
| Service  | `LLM_ERROR`           | 500         | Yes         |
| Service  | `TTS_ERROR`           | 500         | Yes         |
| Resource | `GPU_UNAVAILABLE`     | 503         | Yes         |
| Resource | `TIMEOUT`             | 504         | Yes         |

## API Error Response Format

```json
{
  "error": {
    "code": "ASR_ERROR",
    "message": "Technical error message",
    "userMessage": "Could not understand audio. Please try again.",
    "category": "server",
    "recoverable": true,
    "timestamp": "2024-12-02T10:00:00.000Z",
    "requestId": "abc-123"
  }
}
```

## WebSocket Error Format

```json
{
  "type": "error",
  "sessionId": "session-123",
  "errorCode": "ASR_ERROR",
  "errorMessage": "Technical error message",
  "userMessage": "Could not understand audio. Please try again.",
  "recoverable": true,
  "retryable": true,
  "timestamp": 1701511200000
}
```

## Usage Examples

### Throwing Errors

```typescript
// Specific error types
throw new NotFoundError('User not found');
throw new ValidationError('Invalid email format');
throw new UnauthorizedError('Invalid token');

// Generic with status code
throw new AppError('Something went wrong', 500);

// Using error codes
throw createApiError(ErrorCode.NOT_FOUND, 'Document not found');
```

### Catching Errors

```typescript
try {
  await processRequest();
} catch (error) {
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  // Log unexpected errors
  logger.error('Unexpected error', { error: error.message, stack: error.stack });
  return res.status(500).json({ error: 'Internal server error' });
}
```

## User-Friendly Messages

Always provide user-friendly messages for client-facing errors:

- **ASR failure**: "Could not understand audio. Please try again."
- **Knowledge base empty**: "Please upload documents to your knowledge base first."
- **GPU unavailable**: "Processing queue is full. Estimated wait: X minutes."
- **Service timeout**: "Request took too long. Please try again."

## Logging Errors

```typescript
import { logger } from '@clone/logger';

// Log with context
logger.error('Failed to process document', {
  error: error.message,
  stack: error.stack,
  documentId,
  userId,
});
```
