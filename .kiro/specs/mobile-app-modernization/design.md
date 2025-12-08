# Design Document

## Overview

This design outlines the migration from Socket.IO to native WebSockets and the upgrade from Expo SDK 52 to SDK 54 for the mobile application. The migration will maintain all existing functionality while reducing bundle size, improving performance, and leveraging the latest platform features.

### Goals

1. Replace Socket.IO with native WebSocket implementation (server: `ws` library, client: React Native built-in)
2. Upgrade Expo SDK from 52 to 54 with all compatible dependencies
3. Maintain 100% backward compatibility with existing features
4. Reduce mobile app bundle size by at least 100KB
5. Preserve all authentication, reconnection, and message handling logic
6. Ensure Cloud Run compatibility and production readiness

### Non-Goals

- Changing the message protocol or event structure
- Modifying business logic or application features
- Changing database schema or API contracts
- Implementing new features beyond the migration

## Architecture

### Current Architecture

```
┌─────────────────┐         Socket.IO          ┌──────────────────┐
│                 │◄──────────────────────────►│                  │
│  Mobile App     │    socket.io-client        │  WebSocket       │
│  (React Native) │    (~150KB bundle)         │  Server          │
│                 │                             │  (Node.js)       │
└─────────────────┘                             └──────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
  Expo SDK 52                                    socket.io library
  React Native 0.76.9                            Express + HTTP
```

### Target Architecture

```
┌─────────────────┐      Native WebSocket       ┌──────────────────┐
│                 │◄──────────────────────────►│                  │
│  Mobile App     │    Built-in WebSocket      │  WebSocket       │
│  (React Native) │    (~50KB smaller)         │  Server          │
│                 │                             │  (Node.js)       │
└─────────────────┘                             └──────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
  Expo SDK 54                                     ws library
  React Native 0.81.x                            Express + HTTP
```

## Components and Interfaces

### Server Components

#### 1. Native WebSocket Server

**File:** `apps/websocket-server/src/infrastructure/websocket/NativeWebSocketServer.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server as HTTPServer } from 'http';

export interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
  lastPing: number;
}

export class NativeWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<string, WebSocketConnection>;
  private pingInterval: NodeJS.Timeout | null;

  constructor(httpServer: HTTPServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/socket.io/', // Keep same path for compatibility
    });
    this.connections = new Map();
    this.pingInterval = null;
  }

  start(): void;
  handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void>;
  handleMessage(connectionId: string, data: string | Buffer): Promise<void>;
  handleClose(connectionId: string): void;
  sendMessage(connectionId: string, message: object): void;
  broadcast(sessionId: string, message: object): void;
  startHeartbeat(): void;
  stopHeartbeat(): void;
  close(): Promise<void>;
}
```

#### 2. WebSocket Connection Manager

**File:** `apps/websocket-server/src/infrastructure/websocket/ConnectionManager.ts`

```typescript
export class ConnectionManager {
  private connections: Map<string, WebSocketConnection>;

  registerConnection(id: string, connection: WebSocketConnection): void;
  unregisterConnection(id: string): void;
  getConnection(id: string): WebSocketConnection | undefined;
  getConnectionsBySession(sessionId: string): WebSocketConnection[];
  getConnectionsByUser(userId: string): WebSocketConnection[];
  getActiveConnectionCount(): number;
}
```

#### 3. Message Protocol Handler

**File:** `apps/websocket-server/src/infrastructure/websocket/MessageProtocol.ts`

```typescript
export interface MessageEnvelope {
  type: string;
  sessionId?: string;
  data?: unknown;
  timestamp: number;
}

export class MessageProtocol {
  static serialize(message: MessageEnvelope): string;
  static deserialize(data: string): MessageEnvelope;
  static validate(message: unknown): message is MessageEnvelope;
  static createEnvelope(type: string, data?: unknown, sessionId?: string): MessageEnvelope;
}
```

#### 4. Authentication Handler

**File:** `apps/websocket-server/src/infrastructure/websocket/AuthenticationHandler.ts`

```typescript
export class AuthenticationHandler {
  async authenticateConnection(
    token: string | undefined,
    connectionId: string
  ): Promise<{ userId: string; isGuest: boolean }>;

  extractTokenFromRequest(request: IncomingMessage): string | undefined;
  sendAuthError(ws: WebSocket, code: string, message: string): void;
  sendSessionCreated(ws: WebSocket, sessionId: string, userId: string, isGuest: boolean): void;
}
```

### Client Components

#### 1. Native WebSocket Client

**File:** `apps/mobile-app/src/services/NativeWebSocketClient.ts`

```typescript
export class NativeWebSocketClient {
  private ws: WebSocket | null;
  private connectionState: ConnectionState;
  private reconnectAttempts: number;
  private reconnectTimer: NodeJS.Timeout | null;
  private heartbeatTimer: NodeJS.Timeout | null;
  private messageQueue: WebSocketMessage[];
  private eventHandlers: Map<string, Set<EventHandler>>;
  private stateHandlers: Set<ConnectionStateHandler>;

  async connect(): Promise<void>;
  disconnect(): void;
  send(message: WebSocketMessage): void;
  on(event: string, handler: EventHandler): () => void;
  onConnectionStateChange(handler: ConnectionStateHandler): () => void;

  private handleOpen(): void;
  private handleMessage(event: MessageEvent): void;
  private handleError(event: Event): void;
  private handleClose(event: CloseEvent): void;
  private startHeartbeat(): void;
  private stopHeartbeat(): void;
  private scheduleReconnect(): void;
  private processMessageQueue(): void;
}
```

#### 2. Message Queue Manager

**File:** `apps/mobile-app/src/services/MessageQueueManager.ts`

```typescript
export class MessageQueueManager {
  private queue: WebSocketMessage[];
  private readonly MAX_QUEUE_SIZE = 100;

  enqueue(message: WebSocketMessage): void;
  dequeue(): WebSocketMessage | undefined;
  dequeueAll(): WebSocketMessage[];
  clear(): void;
  size(): number;
  isFull(): boolean;
}
```

## Data Models

### Message Envelope

```typescript
interface MessageEnvelope {
  type: string; // Event type (e.g., 'session_created', 'audio-chunk')
  sessionId?: string; // Optional session identifier
  data?: unknown; // Event-specific payload
  timestamp: number; // Unix timestamp in milliseconds
}
```

### Connection State

```typescript
enum ConnectionState {
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}
```

### WebSocket Connection

```typescript
interface WebSocketConnection {
  id: string; // Unique connection identifier
  ws: WebSocket; // Native WebSocket instance
  userId?: string; // Authenticated user ID
  sessionId?: string; // Session ID after creation
  isAuthenticated: boolean; // Authentication status
  lastPing: number; // Last ping timestamp
  createdAt: number; // Connection creation time
}
```

### Authentication Payload

```typescript
interface AuthPayload {
  userId: string;
  isGuest: boolean;
  exp?: number;
}

interface SessionCreatedPayload {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  timestamp: number;
}

interface AuthErrorPayload {
  code: string;
  message: string;
  timestamp: number;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Authentication triggers session creation

_For any_ valid JWT token, when a client connects and authenticates successfully, the system should create a session and emit a `session_created` event with sessionId, userId, and isGuest fields.

**Validates: Requirements 2.2**

### Property 2: Reconnection follows exponential backoff

_For any_ sequence of connection failures, the reconnection delays should follow the exponential backoff pattern: 1s, 2s, 4s, 8s, 16s, 30s (capped at 30s for subsequent attempts).

**Validates: Requirements 2.3, 12.3**

### Property 3: Reconnection restores queued messages

_For any_ set of messages queued while disconnected, when the connection is re-established, all queued messages should be sent in the order they were queued.

**Validates: Requirements 2.4**

### Property 4: Manual disconnect prevents reconnection

_For any_ connection, when the user manually calls disconnect(), the system should not attempt automatic reconnection.

**Validates: Requirements 2.5**

### Property 5: Message envelope structure

_For any_ message sent through the WebSocket, the serialized message should contain type, timestamp, and optionally sessionId and data fields.

**Validates: Requirements 3.1**

### Property 6: Message routing to handlers

_For any_ valid JSON message received, the system should parse it and route it to all registered handlers for that message type.

**Validates: Requirements 3.2**

### Property 7: Invalid message error handling

_For any_ invalid JSON or malformed message, the system should log an error and send an error response without crashing.

**Validates: Requirements 3.3**

### Property 8: Heartbeat interval consistency

_For any_ established connection, ping messages should be sent at 25-second intervals (±1 second tolerance for timing).

**Validates: Requirements 3.4**

### Property 9: Connection timeout detection

_For any_ connection where no pong is received within 60 seconds of a ping, the system should consider the connection dead and initiate reconnection.

**Validates: Requirements 3.5**

### Property 10: Event handler invocation

_For any_ event emitted with registered handlers, all handlers for that event type should be invoked with the event data.

**Validates: Requirements 4.2**

### Property 11: Subscription returns unsubscribe

_For any_ event subscription, the system should return a function that, when called, removes the handler from the event handlers map.

**Validates: Requirements 4.3**

### Property 12: Message queuing while disconnected

_For any_ message sent while the connection state is DISCONNECTED or RECONNECTING, the message should be added to the queue and sent after reconnection.

**Validates: Requirements 4.4**

### Property 13: Queue size limit enforcement

_For any_ message queue, when the queue size exceeds 100 messages, the oldest message should be discarded before adding the new message.

**Validates: Requirements 4.5**

### Property 14: Health check endpoint responses

_For any_ HTTP GET request to `/health`, `/health/ready`, or `/health/live`, the system should return a JSON response with appropriate status code and health information.

**Validates: Requirements 8.2**

### Property 15: Metrics endpoint data

_For any_ HTTP GET request to `/metrics`, the response should include activeConnections, latency, and errorRate fields.

**Validates: Requirements 8.5, 9.5**

### Property 16: Connection event logging

_For any_ connection event (connect, disconnect, error), the system should create a log entry with socketId, timestamp, and event type.

**Validates: Requirements 9.1**

### Property 17: Error logging with stack trace

_For any_ error that occurs, the system should log the error with message, stack trace, and contextual information.

**Validates: Requirements 9.2**

### Property 18: State transition logging

_For any_ connection state change, the system should log both the previous state and the new state.

**Validates: Requirements 9.3**

### Property 19: Log categorization

_For any_ log entry created by WebSocketMonitor, the log should have a type field with one of: connection, lifecycle, message, or error.

**Validates: Requirements 9.4**

### Property 20: Message round-trip

_For any_ message sent from mobile app to server, the server should receive the message with the same type, data, and sessionId fields.

**Validates: Requirements 11.3**

### Property 21: Message serialization round-trip

_For any_ MessageEnvelope object, serializing then deserializing should produce an equivalent object with the same type, sessionId, data, and timestamp.

**Validates: Requirements 12.4**

## Error Handling

### Connection Errors

1. **Authentication Failures**
   - Invalid token → Send `auth_error` with code `AUTH_INVALID`
   - Expired token → Send `auth_error` with code `AUTH_EXPIRED`
   - Missing token → Send `auth_error` with code `AUTH_REQUIRED`
   - All auth errors should disconnect the socket after sending the error

2. **Connection Timeouts**
   - Session creation timeout (2s) → Log error and send `auth_error`
   - Connection timeout (30s) → Trigger reconnection with exponential backoff
   - Heartbeat timeout (60s) → Consider connection dead and reconnect

3. **Network Errors**
   - Connection refused → Log error and schedule reconnection
   - Network unreachable → Log error and schedule reconnection
   - DNS resolution failure → Log error and schedule reconnection

### Message Errors

1. **Parsing Errors**
   - Invalid JSON → Log error, send error response, continue processing
   - Missing required fields → Log error, send error response
   - Invalid message type → Log error, send error response

2. **Validation Errors**
   - Use Zod schemas to validate message structure
   - Log validation errors with full context
   - Send structured error response to client

### Server Errors

1. **Internal Errors**
   - Database connection failure → Return 503 on health checks
   - Service unavailable → Return 503 with retry-after header
   - Unexpected errors → Log with full stack trace, send generic error to client

2. **Resource Errors**
   - Too many connections → Reject new connections with 503
   - Memory pressure → Log warning, consider closing idle connections
   - CPU overload → Log warning, throttle new connections

## Testing Strategy

### Unit Testing

**Framework:** Jest with fast-check for property-based testing

**Server Unit Tests:**

- `NativeWebSocketServer.test.ts` - Server initialization, connection handling, message routing
- `ConnectionManager.test.ts` - Connection registration, lookup, cleanup
- `MessageProtocol.test.ts` - Serialization, deserialization, validation
- `AuthenticationHandler.test.ts` - Token verification, error handling

**Client Unit Tests:**

- `NativeWebSocketClient.test.ts` - Connection lifecycle, state management
- `MessageQueueManager.test.ts` - Queue operations, size limits
- `WebSocketMonitor.test.ts` - Logging, log retention

**Property-Based Tests:**

- Each correctness property will be implemented as a property-based test
- Use fast-check to generate random inputs (tokens, messages, connection states)
- Configure each test to run minimum 100 iterations
- Tag each test with the property number and requirement reference

### Integration Testing

**End-to-End Tests:**

- `websocket-connection.e2e.test.ts` - Full connection flow from mobile app to server
- `authentication.e2e.test.ts` - JWT authentication and session creation
- `message-flow.e2e.test.ts` - Bidirectional message exchange
- `reconnection.e2e.test.ts` - Connection loss and recovery
- `real-time-features.e2e.test.ts` - Audio chunks, transcripts, LLM responses

**Expo Module Tests:**

- Test each Expo module (camera, audio, file system, secure storage, biometrics)
- Verify functionality on both iOS and Android
- Use React Native Testing Library for component tests

### Manual Testing

**Device Testing:**

- Test on physical iOS devices (iPhone 12+, iOS 16+)
- Test on physical Android devices (Pixel 6+, Android 12+)
- Verify all user flows work correctly
- Test network interruption scenarios (airplane mode, poor connectivity)

**Performance Testing:**

- Measure bundle size before and after migration
- Verify 100KB+ reduction in bundle size
- Measure cold start time
- Verify no performance regressions

## Migration Strategy

### Phase 1: Server Migration (Week 1)

1. **Setup** (Day 1)
   - Install `ws` and `@types/ws` dependencies
   - Create new WebSocket infrastructure files
   - Set up test files

2. **Implementation** (Days 2-3)
   - Implement `NativeWebSocketServer`
   - Implement `ConnectionManager`
   - Implement `MessageProtocol`
   - Implement `AuthenticationHandler`

3. **Integration** (Day 4)
   - Update `index.ts` to use native WebSocket server
   - Migrate `WebSocketController` to work with native WebSockets
   - Update health check and metrics endpoints

4. **Testing** (Day 5)
   - Write and run unit tests
   - Write and run property-based tests
   - Verify all tests pass

### Phase 2: Client Migration (Week 2)

1. **Setup** (Day 1)
   - Create new `NativeWebSocketClient` file
   - Create `MessageQueueManager`
   - Set up test files

2. **Implementation** (Days 2-3)
   - Implement `NativeWebSocketClient` with all features
   - Implement reconnection logic with exponential backoff
   - Implement message queuing
   - Implement heartbeat mechanism

3. **Integration** (Day 4)
   - Replace Socket.IO client usage throughout the app
   - Update all WebSocket event handlers
   - Remove Socket.IO dependencies

4. **Testing** (Day 5)
   - Write and run unit tests
   - Write and run property-based tests
   - Run end-to-end tests

### Phase 3: Expo SDK Upgrade (Week 3)

1. **Preparation** (Day 1)
   - Review Expo SDK 54 release notes
   - Document breaking changes
   - Create upgrade checklist

2. **Dependency Updates** (Day 2)
   - Update `expo` to `~54.0.0`
   - Update all Expo modules
   - Update React Native and React
   - Update React Navigation
   - Update TypeScript types

3. **Code Updates** (Day 3)
   - Fix breaking changes
   - Replace deprecated APIs
   - Resolve type errors
   - Update configuration files

4. **Testing** (Days 4-5)
   - Run all unit tests
   - Test all Expo modules
   - Test on iOS and Android devices
   - Verify no regressions

### Phase 4: Integration and Deployment (Week 4)

1. **Integration Testing** (Days 1-2)
   - Run full end-to-end test suite
   - Test all user flows
   - Test network interruption scenarios
   - Verify backward compatibility

2. **Performance Validation** (Day 3)
   - Measure bundle size reduction
   - Verify performance metrics
   - Test cold start time
   - Load test WebSocket server

3. **Staging Deployment** (Day 4)
   - Deploy to staging environment
   - Run smoke tests
   - Monitor logs and metrics
   - Fix any issues

4. **Production Deployment** (Day 5)
   - Deploy to production
   - Monitor closely for first 24 hours
   - Be ready to rollback if needed
   - Document lessons learned

## Rollback Plan

### Server Rollback

If issues are discovered with the native WebSocket server:

1. Revert to previous commit with Socket.IO
2. Redeploy server
3. Verify Socket.IO clients can still connect
4. Monitor for 1 hour to ensure stability

### Client Rollback

If issues are discovered with the native WebSocket client:

1. Revert mobile app to previous version with Socket.IO client
2. Rebuild and redeploy to app stores (emergency release)
3. Notify users to update
4. Monitor crash reports and user feedback

### Expo Rollback

If issues are discovered with Expo SDK 54:

1. Revert to Expo SDK 52 dependencies
2. Revert any code changes specific to SDK 54
3. Rebuild and test
4. Redeploy to app stores

## Dependencies

### Server Dependencies

**New:**

- `ws` ^8.18.0 - Native WebSocket server
- `@types/ws` ^8.5.0 - TypeScript types for ws

**Removed:**

- `socket.io` ^4.8.1

### Client Dependencies

**New:**

- None (using React Native built-in WebSocket)

**Removed:**

- `socket.io-client` ^4.6.0

### Expo SDK 54 Dependencies

**Updated:**

- `expo` ~54.0.0
- `react-native` 0.81.x (latest stable version)
- `react` 19.1.0 (as specified by Expo SDK 54)
- `expo-av` ~16.0.0
- `expo-camera` ~17.0.0
- `expo-file-system` ~19.0.0
- `expo-secure-store` ~16.0.0
- `expo-local-authentication` ~16.0.0
- `expo-media-library` ~18.0.0
- `expo-splash-screen` ~1.0.0
- `@expo/metro-runtime` ~5.0.0
- `@react-navigation/native` ^7.1.0
- `@react-navigation/native-stack` ^7.3.0
- `@react-navigation/bottom-tabs` ^7.3.0
- `@types/react` ~19.1.0

## Monitoring and Observability

### Metrics to Track

1. **Connection Metrics**
   - Active connection count
   - Connection success rate
   - Connection failure rate by error type
   - Average connection duration
   - Reconnection attempts per session

2. **Performance Metrics**
   - Message latency (ping/pong)
   - Message throughput (messages/second)
   - Queue size distribution
   - Memory usage per connection
   - CPU usage

3. **Error Metrics**
   - Authentication failure rate by error code
   - Message parsing error rate
   - Connection timeout rate
   - Heartbeat timeout rate

### Logging

All logs should use structured logging with:

- Timestamp
- Log level (info, warn, error, debug)
- Component/service name
- Socket ID / Connection ID
- User ID (if authenticated)
- Session ID (if created)
- Event type
- Additional context

### Alerts

Set up alerts for:

- Connection failure rate > 5%
- Authentication failure rate > 10%
- Average latency > 1000ms
- Active connections > 10,000
- Error rate > 1%
- Health check failures

## Security Considerations

### Authentication

- JWT tokens must be validated on every connection
- Expired tokens must be rejected with appropriate error code
- Guest tokens must be supported for anonymous access
- Token refresh should be handled gracefully

### Data Protection

- All WebSocket connections must use WSS (WebSocket Secure) in production
- Sensitive data in logs must be redacted
- User data must be isolated by userId
- Session data must be cleaned up on disconnect

### Rate Limiting

- Limit connection attempts per IP address
- Limit message rate per connection
- Limit queue size per connection
- Reject connections when server is overloaded

### Input Validation

- All messages must be validated using Zod schemas
- Invalid messages must be rejected
- Message size must be limited
- Prevent injection attacks through message data
