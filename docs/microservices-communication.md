# Microservices Communication

This document describes the microservices communication infrastructure for the Real-Time Conversational Clone system.

## Overview

The system uses gRPC for internal service-to-service communication with the following features:

- **JWT-based Authentication**: Secure service-to-service authentication
- **Service Discovery**: Dynamic service registration and discovery
- **Circuit Breaker**: Automatic failure detection and recovery
- **Retry Logic**: Exponential backoff retry for transient failures
- **Saga Pattern**: Distributed transaction management with compensation

## Architecture

### Components

1. **Service Auth** (`@clone/service-auth`)
   - JWT token generation and verification
   - gRPC authentication interceptors
   - Permission-based access control

2. **Service Discovery** (`@clone/service-discovery`)
   - Service registration and health checks
   - Round-robin load balancing
   - Automatic endpoint management

3. **Service Errors** (`@clone/service-errors`)
   - Standardized error codes and handling
   - Circuit breaker implementation
   - Retry policy with exponential backoff

4. **gRPC Proto** (`@clone/grpc-proto`)
   - Protocol Buffer definitions
   - Client factory with interceptors
   - Service communication manager

5. **Saga** (`@clone/saga`)
   - Distributed transaction orchestration
   - Automatic compensation on failure
   - Step-by-step execution tracking

## Usage

### Setting Up Service Communication

```typescript
import { ServiceCommunicationManager } from '@clone/grpc-proto';

// Initialize the communication manager
const commManager = new ServiceCommunicationManager({
  serviceId: 'websocket-server-1',
  serviceName: 'websocket-server',
  jwtSecret: process.env.JWT_SECRET!,
  tokenExpirySeconds: 3600,
  healthCheckIntervalMs: 30000,
  enableServiceDiscovery: true,
});

// Register services
const registry = commManager.getServiceRegistry();
registry.register({
  serviceId: 'asr-service-1',
  serviceName: 'asr',
  host: 'asr-service',
  port: 50051,
  protocol: 'grpc',
  healthCheckUrl: '/health',
});

// Start health checks
commManager.startHealthChecks();
```

### Creating Service Clients

```typescript
// Create ASR client
const asrClient = commManager.createASRClient({ host: 'asr-service', port: 50051 }, ['asr:read']);

// Create LLM client
const llmClient = commManager.createLLMClient({ host: 'llm-service', port: 50052 }, ['llm:read']);

// Create RAG client
const ragClient = commManager.createRAGClient({ host: 'rag-service', port: 50053 }, [
  'rag:read',
  'rag:write',
]);

// Create TTS client
const ttsClient = commManager.createTTSClient({ host: 'tts-service', port: 50054 }, ['tts:read']);

// Create Lip-sync client
const lipSyncClient = commManager.createLipSyncClient({ host: 'lipsync-service', port: 50055 }, [
  'lipsync:read',
]);
```

### Making Service Calls with Error Handling

```typescript
import { ServiceError, ServiceErrorCode } from '@clone/service-errors';

try {
  // Execute with automatic retry and circuit breaker
  const result = await commManager.executeServiceCall('asr', async () => {
    return new Promise((resolve, reject) => {
      asrClient.HealthCheck({}, (error: any, response: any) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  });

  console.log('ASR service health:', result);
} catch (error) {
  if (error instanceof ServiceError) {
    console.error(`Service error [${error.code}]:`, error.message);

    if (error.retryable) {
      // Handle retryable error
    }
  }
}
```

### Using Saga Pattern for Distributed Transactions

```typescript
import { createSaga } from '@clone/saga';

interface ConversationContext {
  userId: string;
  sessionId: string;
  transcript?: string;
  ragContext?: string;
  llmResponse?: string;
  audioData?: Buffer;
}

// Create a saga for conversation processing
const result = await createSaga<ConversationContext>({
  userId: 'user-123',
  sessionId: 'session-456',
})
  .step(
    'transcribe-audio',
    async (ctx) => {
      // Call ASR service
      const transcript = await transcribeAudio(ctx.sessionId);
      ctx.transcript = transcript;
      return transcript;
    },
    async (ctx) => {
      // Compensation: log the failure
      console.log('Transcription failed, no cleanup needed');
    }
  )
  .step(
    'retrieve-context',
    async (ctx) => {
      // Call RAG service
      const context = await retrieveContext(ctx.userId, ctx.transcript!);
      ctx.ragContext = context;
      return context;
    },
    async (ctx) => {
      // Compensation: clear cached context
      await clearContextCache(ctx.sessionId);
    }
  )
  .step(
    'generate-response',
    async (ctx) => {
      // Call LLM service
      const response = await generateResponse(ctx.transcript!, ctx.ragContext!);
      ctx.llmResponse = response;
      return response;
    },
    async (ctx) => {
      // Compensation: log failed generation
      console.log('LLM generation failed');
    }
  )
  .step(
    'synthesize-speech',
    async (ctx) => {
      // Call TTS service
      const audio = await synthesizeSpeech(ctx.llmResponse!);
      ctx.audioData = audio;
      return audio;
    },
    async (ctx) => {
      // Compensation: clean up audio resources
      await cleanupAudioResources(ctx.sessionId);
    }
  )
  .execute();

if (result.success) {
  console.log('Conversation processed successfully');
  console.log('Completed steps:', result.completedSteps);
} else {
  console.error('Conversation processing failed:', result.error);
  console.error('Failed at step:', result.failedStep);
  console.log('Compensated steps:', result.completedSteps);
}
```

### Service Authentication

```typescript
import { ServiceAuthManager } from '@clone/service-auth';

const authManager = new ServiceAuthManager({
  jwtSecret: process.env.JWT_SECRET!,
  tokenExpirySeconds: 3600,
});

// Generate service token
const token = authManager.generateServiceToken('websocket-server-1', 'websocket-server', [
  'asr:read',
  'llm:read',
  'rag:read',
  'tts:read',
]);

// Verify token
try {
  const payload = authManager.verifyServiceToken(token);
  console.log('Service:', payload.serviceName);
  console.log('Permissions:', payload.permissions);

  // Check permission
  if (authManager.hasPermission(payload, 'asr:read')) {
    console.log('Has ASR read permission');
  }
} catch (error) {
  console.error('Token verification failed:', error);
}
```

### Circuit Breaker Usage

```typescript
import { CircuitBreaker, CircuitState } from '@clone/service-errors';

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5, // Open after 5 failures
  successThreshold: 2, // Close after 2 successes in half-open
  timeout: 30000, // 30 second timeout
  resetTimeoutMs: 60000, // Try again after 60 seconds
});

try {
  const result = await circuitBreaker.execute(async () => {
    // Call external service
    return await callExternalService();
  });

  console.log('Result:', result);
} catch (error) {
  const stats = circuitBreaker.getStats();
  console.log('Circuit breaker state:', stats.state);
  console.log('Failure count:', stats.failureCount);

  if (stats.state === CircuitState.OPEN) {
    console.log('Circuit is open, service unavailable');
  }
}
```

### Retry Policy Usage

```typescript
import { RetryPolicy } from '@clone/service-errors';

const retryPolicy = new RetryPolicy({
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: ['UNAVAILABLE', 'TIMEOUT'],
});

try {
  const result = await retryPolicy.execute(async () => {
    // Operation that might fail
    return await unreliableOperation();
  });

  console.log('Success:', result);
} catch (error) {
  console.error('Failed after retries:', error);
}
```

## Protocol Buffer Definitions

All services use Protocol Buffers for message serialization. Proto files are located in `packages/grpc-proto/proto/`:

- `asr.proto` - Automatic Speech Recognition service
- `llm.proto` - Large Language Model service
- `rag.proto` - Retrieval-Augmented Generation service
- `tts.proto` - Text-to-Speech service
- `lipsync.proto` - Lip-sync video generation service

## Error Handling

### Error Codes

```typescript
enum ServiceErrorCode {
  // Client errors
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',

  // Service-specific
  ASR_FAILED = 'ASR_FAILED',
  RAG_FAILED = 'RAG_FAILED',
  LLM_FAILED = 'LLM_FAILED',
  TTS_FAILED = 'TTS_FAILED',
  LIPSYNC_FAILED = 'LIPSYNC_FAILED',

  // Resource errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}
```

### Creating Service Errors

```typescript
import { ServiceError, ServiceErrorCode } from '@clone/service-errors';

throw new ServiceError(ServiceErrorCode.ASR_FAILED, 'Failed to transcribe audio', 'asr-service', {
  retryable: true,
  metadata: { sessionId: 'session-123' },
});
```

## Best Practices

1. **Always use service authentication** for production environments
2. **Enable circuit breakers** for external service calls
3. **Implement retry logic** with exponential backoff
4. **Use saga pattern** for multi-service transactions
5. **Monitor circuit breaker states** and adjust thresholds
6. **Set appropriate timeouts** based on service SLAs
7. **Log all service errors** with context for debugging
8. **Implement health checks** for all services
9. **Use service discovery** for dynamic environments
10. **Handle compensation failures** gracefully in sagas

## Configuration

### Environment Variables

```bash
# JWT Secret for service authentication
JWT_SECRET=your-secret-key

# Service endpoints
ASR_SERVICE_HOST=asr-service
ASR_SERVICE_PORT=50051

LLM_SERVICE_HOST=llm-service
LLM_SERVICE_PORT=50052

RAG_SERVICE_HOST=rag-service
RAG_SERVICE_PORT=50053

TTS_SERVICE_HOST=tts-service
TTS_SERVICE_PORT=50054

LIPSYNC_SERVICE_HOST=lipsync-service
LIPSYNC_SERVICE_PORT=50055

# Circuit breaker settings
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2
CIRCUIT_BREAKER_TIMEOUT=30000
CIRCUIT_BREAKER_RESET_TIMEOUT=60000

# Retry settings
RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_DELAY=100
RETRY_MAX_DELAY=5000
RETRY_BACKOFF_MULTIPLIER=2

# Health check interval
HEALTH_CHECK_INTERVAL=30000
```

## Monitoring

Monitor the following metrics for service communication:

- Circuit breaker state changes
- Retry attempt counts
- Service call latencies
- Authentication failures
- Service discovery health check results
- Saga execution success/failure rates

## Troubleshooting

### Circuit Breaker Stuck Open

If a circuit breaker remains open:

1. Check service health
2. Review failure threshold settings
3. Verify network connectivity
4. Check service logs for errors

### Authentication Failures

If seeing authentication errors:

1. Verify JWT secret matches across services
2. Check token expiry settings
3. Ensure permissions are correctly configured
4. Verify service IDs are unique

### Saga Compensation Failures

If saga compensations fail:

1. Ensure compensation logic is idempotent
2. Log all compensation errors
3. Implement manual cleanup procedures
4. Review compensation order (reverse of execution)

## Related Documentation

- [Service Architecture](./architecture.md)
- [Deployment Guide](./deployment.md)
- [Monitoring and Observability](./monitoring.md)
