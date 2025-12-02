# Error Handling Guide

## Overview

The Conversational Clone System uses a centralized error handling approach with standardized error codes, user-friendly messages, and consistent API responses.

## Error Codes

All error codes are defined in `@clone/errors` package:

| Category | Code                   | HTTP Status | Recoverable |
| -------- | ---------------------- | ----------- | ----------- |
| Client   | `VALIDATION_ERROR`     | 400         | No          |
| Client   | `NOT_FOUND`            | 404         | No          |
| Client   | `UNAUTHORIZED`         | 401         | No          |
| Client   | `RATE_LIMIT_EXCEEDED`  | 429         | Yes         |
| Service  | `ASR_ERROR`            | 500         | Yes         |
| Service  | `KNOWLEDGE_BASE_EMPTY` | 400         | No          |
| Service  | `LLM_ERROR`            | 500         | Yes         |
| Service  | `TTS_ERROR`            | 500         | Yes         |
| Resource | `GPU_UNAVAILABLE`      | 503         | Yes         |
| Resource | `TIMEOUT`              | 504         | Yes         |

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

## WebSocket Error Message Format

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

## Usage

### API Gateway

```typescript
import { createApiError, ErrorCode } from '@clone/errors';

// Throw a standardized error
throw createApiError(ErrorCode.NOT_FOUND, 'Document not found');
```

### WebSocket Server

```typescript
import { WebSocketErrorHandler } from '../utils/errorHandler';

// Send ASR error to client
WebSocketErrorHandler.sendASRError(socket, sessionId);

// Send GPU unavailable with wait time
WebSocketErrorHandler.sendGPUUnavailableError(socket, sessionId, 5);
```

## User-Friendly Messages

Common scenarios and their user messages:

- **ASR failure**: "Could not understand audio. Please try again."
- **Knowledge base empty**: "Please upload documents to your knowledge base first."
- **GPU unavailable**: "Processing queue is full. Estimated wait: X minutes."
- **Service timeout**: "Request took too long. Please try again."

## Mobile App Retry

For ASR failures, the mobile app can emit a `retry_asr` event to signal readiness for retry:

```typescript
socket.emit('retry_asr');
// Server responds with 'asr_retry_acknowledged'
```
