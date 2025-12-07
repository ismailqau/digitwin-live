# Design Document

## Overview

This design addresses the WebSocket connection timeout issue between the mobile app and websocket-server. The core problem is a mismatch in the connection handshake flow: the client waits for a `session_created` event that never arrives when authentication fails, causing a 20-second timeout before retry.

The solution involves:

1. Ensuring the server always emits either `session_created` or `auth_error` before disconnecting
2. Making the client wait for `session_created` after Socket.IO `connect` event
3. Implementing proper guest token support
4. Adding comprehensive logging for debugging

## Architecture

### Current Flow (Broken)

```
Mobile Client                    WebSocket Server
     |                                  |
     |------ connect() ----------------->|
     |                                  |
     |<----- Socket.IO connect ---------|
     |                                  |
     |  (waits for session_created)    |
     |                                  |
     |                                  | (auth fails silently)
     |                                  | (disconnects without event)
     |                                  |
     |  (20s timeout)                  |
     |                                  |
     |------ retry ---------------------->|
```

### Fixed Flow

```
Mobile Client                    WebSocket Server
     |                                  |
     |------ connect() ----------------->|
     |                                  |
     |<----- Socket.IO connect ---------|
     |                                  |
     |  (waits for session_created)    |
     |                                  |
     |                                  | (validates token)
     |                                  |
     |<----- session_created -----------| (success)
     |  OR                              |
     |<----- auth_error ----------------| (failure)
     |                                  |
     | (transitions to CONNECTED        |
     |  or ERROR state)                 |
```

## Components and Interfaces

### 1. WebSocketController (Server)

**Changes:**

- Always emit `auth_error` before disconnecting on authentication failure
- Support guest tokens with limited permissions
- Add detailed logging for all connection attempts

**Interface:**

```typescript
interface AuthErrorPayload {
  code: 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'AUTH_EXPIRED';
  message: string;
  timestamp: number;
}

interface SessionCreatedPayload {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  timestamp: number;
}
```

### 2. AuthService (Server)

**Changes:**

- Add `verifyGuestToken()` method to validate guest tokens
- Return specific error codes for different auth failures
- Support guest sessions with limited permissions
- Accept tokens in format: `guest_<uuid>_<timestamp>` for guest users

**Guest Token Format:**

```
guest_<uuid>_<timestamp>
Example: guest_550e8400-e29b-41d4-a716-446655440000_1733547600000
```

**Interface:**

```typescript
interface TokenPayload {
  userId: string;
  isGuest: boolean;
  exp?: number;
}

interface AuthResult {
  success: boolean;
  payload?: TokenPayload;
  error?: {
    code: 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'AUTH_EXPIRED';
    message: string;
  };
}
```

### 3. WebSocketClient (Mobile)

**Changes:**

- Generate guest token when user skips sign-in
- Wait for `session_created` event after Socket.IO `connect` event
- Handle `auth_error` event properly
- Add timeout for waiting for `session_created` (5 seconds)
- Improve state transition logic

**Guest Token Generation:**

```typescript
// When user skips sign-in
const guestToken = generateGuestToken(); // Format: "guest_<uuid>_<timestamp>"
await SecureStorage.setAccessToken(guestToken);
```

**State Machine:**

```
DISCONNECTED
    |
    v
CONNECTING (socket.io connecting)
    |
    v
AUTHENTICATING (waiting for session_created)
    |
    +---> CONNECTED (session_created received)
    |
    +---> ERROR (auth_error or timeout)
```

## Data Models

### Connection State

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
}
```

### Session Data

```typescript
interface SessionData {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  createdAt: Date;
  socketId: string;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Authentication response guarantee

_For any_ WebSocket connection attempt, the server must emit either `session_created` or `auth_error` within 5 seconds before disconnecting (accounting for Cloud Run cold start).
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Client state consistency

_For any_ connection attempt, the client state must transition from CONNECTING → AUTHENTICATING → (CONNECTED | ERROR), never skipping AUTHENTICATING.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 3: Error message completeness

_For any_ authentication failure, the `auth_error` event must include a non-empty message and a valid error code from the defined set.
**Validates: Requirements 2.1, 2.3, 2.4, 2.5**

### Property 4: Guest session creation

_For any_ connection with a guest token, the server must create a session with `isGuest: true` and emit `session_created`.
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Connection timeout handling

_For any_ connection that doesn't receive `session_created` within 10 seconds (accounting for Cloud Run cold start), the client must transition to ERROR state and schedule reconnection.
**Validates: Requirements 5.5**

### Property 6: Logging completeness

_For any_ connection attempt, the server must log at least one entry with socket ID, timestamp, and outcome (success/failure).
**Validates: Requirements 4.1, 4.2, 4.3**

## Error Handling

### Server-Side Errors

| Error Code            | HTTP Status | Message                         | Action                        |
| --------------------- | ----------- | ------------------------------- | ----------------------------- |
| AUTH_REQUIRED         | 401         | "Authentication token required" | Emit `auth_error`, disconnect |
| AUTH_INVALID          | 401         | "Invalid authentication token"  | Emit `auth_error`, disconnect |
| AUTH_EXPIRED          | 401         | "Authentication token expired"  | Emit `auth_error`, disconnect |
| SESSION_CREATE_FAILED | 500         | "Failed to create session"      | Emit `error`, disconnect      |

### Client-Side Error Handling

```typescript
// On auth_error
socket.on('auth_error', (error) => {
  logger.error('Authentication failed', error);

  if (error.code === 'AUTH_EXPIRED') {
    // Try to refresh token
    await refreshToken();
    reconnect();
  } else if (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_INVALID') {
    // Fall back to guest mode
    useGuestToken();
    reconnect();
  }
});

// On timeout waiting for session_created
const sessionTimeout = setTimeout(() => {
  logger.error('Timeout waiting for session_created');
  setConnectionState(ConnectionState.ERROR);
  scheduleReconnect();
}, 5000);
```

## Testing Strategy

### Unit Tests

1. **AuthService.verifyToken()**
   - Test with valid JWT token
   - Test with invalid JWT token
   - Test with expired JWT token
   - Test with missing token
   - Test with guest token

2. **WebSocketController.handleConnection()**
   - Test successful authentication flow
   - Test authentication failure flows
   - Test guest token flow
   - Test session creation

3. **WebSocketClient state transitions**
   - Test CONNECTING → AUTHENTICATING → CONNECTED
   - Test CONNECTING → AUTHENTICATING → ERROR
   - Test timeout handling
   - Test auth_error handling

### Integration Tests

1. **End-to-end connection flow**
   - Mobile app connects with valid token
   - Verify `session_created` received within 2 seconds
   - Verify client transitions to CONNECTED state

2. **Authentication failure flow**
   - Mobile app connects with invalid token
   - Verify `auth_error` received immediately
   - Verify client transitions to ERROR state
   - Verify reconnection attempt

3. **Guest mode flow**
   - Mobile app connects with guest token
   - Verify `session_created` with `isGuest: true`
   - Verify limited permissions enforced

4. **Timeout handling**
   - Simulate server not responding
   - Verify client times out after 5 seconds
   - Verify client schedules reconnection

### Property-Based Tests

Using fast-check for JavaScript/TypeScript:

1. **Property 1: Authentication response guarantee**

   ```typescript
   fc.assert(
     fc.asyncProperty(
       fc.record({
         token: fc.option(fc.string(), { nil: null }),
         isValid: fc.boolean(),
       }),
       async ({ token, isValid }) => {
         const events: string[] = [];
         const socket = createMockSocket();

         socket.on('session_created', () => events.push('session_created'));
         socket.on('auth_error', () => events.push('auth_error'));

         await controller.handleConnection(socket);
         await sleep(2000);

         // Must emit exactly one of these events
         return (
           events.length === 1 && (events[0] === 'session_created' || events[0] === 'auth_error')
         );
       }
     ),
     { numRuns: 100 }
   );
   ```

2. **Property 2: Client state consistency**
   ```typescript
   fc.assert(
     fc.asyncProperty(
       fc.record({
         serverResponds: fc.boolean(),
         authSucceeds: fc.boolean(),
       }),
       async ({ serverResponds, authSucceeds }) => {
         const client = new WebSocketClient();
         const states: ConnectionState[] = [];

         client.onConnectionStateChange((state) => states.push(state));

         await client.connect();
         await sleep(6000);

         // Must go through CONNECTING → AUTHENTICATING
         const hasConnecting = states.includes(ConnectionState.CONNECTING);
         const hasAuthenticating = states.includes(ConnectionState.AUTHENTICATING);
         const connectingIndex = states.indexOf(ConnectionState.CONNECTING);
         const authenticatingIndex = states.indexOf(ConnectionState.AUTHENTICATING);

         return hasConnecting && hasAuthenticating && connectingIndex < authenticatingIndex;
       }
     ),
     { numRuns: 100 }
   );
   ```

## Implementation Notes

### Server Changes

1. **WebSocketController.handleConnection()**
   - Wrap entire method in try-catch
   - Always emit event before disconnecting
   - Add timeout for session creation (2 seconds)

2. **AuthService**
   - Add guest token validation
   - Return structured error objects
   - Add token expiration checking

### Client Changes

1. **Guest Token Generation (Mobile App)**
   - Add `generateGuestToken()` utility function
   - Format: `guest_<uuid>_<timestamp>`
   - Store in SecureStorage when user skips sign-in
   - Use guest token for WebSocket connection

2. **WebSocketClient.connect()**
   - Add AUTHENTICATING state
   - Wait for `session_created` after Socket.IO `connect`
   - Add 5-second timeout for `session_created`
   - Handle `auth_error` event

3. **State Management**
   - Update state machine to include AUTHENTICATING
   - Ensure state transitions are atomic
   - Add state transition logging

### Configuration

```typescript
// Server
const AUTH_TIMEOUT = 5000; // 5 seconds to emit auth response (accounts for cold start)
const SESSION_CREATE_TIMEOUT = 5000; // 5 seconds to create session

// Client
const SESSION_CREATED_TIMEOUT = 10000; // 10 seconds to wait for session_created (Cloud Run cold start)
const CONNECT_TIMEOUT = 30000; // 30 seconds for Socket.IO connection (Cloud Run cold start)
const HEARTBEAT_INTERVAL = 25000; // Match server pingInterval
```

### Cloud Run Specific Configuration

```typescript
// Socket.IO Client - use polling first for Cloud Run compatibility
this.socket = io(WEBSOCKET_URL, {
  auth: { token: accessToken },
  transports: ['polling', 'websocket'], // Polling first, then upgrade
  reconnection: false,
  timeout: 30000, // Increased for cold start
  upgrade: true, // Allow upgrade to websocket after polling connects
  forceNew: true,
});

// Socket.IO Server - Cloud Run optimized
const io = new SocketIOServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowUpgrades: true,
  perMessageDeflate: false, // Disable compression for lower latency
});
```

## Deployment Considerations

1. **Cloud Run Configuration (Critical)**
   - Enable session affinity: `gcloud run services update websocket-server --session-affinity`
   - Set minimum instances to 1 to reduce cold starts: `--min-instances=1`
   - Increase request timeout: `--timeout=3600` (1 hour for long-lived connections)
   - Set CPU always allocated: `--cpu-throttling=false` for consistent WebSocket performance

2. **Backward Compatibility**
   - Old clients will still work (they already handle timeouts)
   - New clients will work with old servers (will timeout and retry)
   - Deploy server changes first, then client

3. **Monitoring**
   - Add metrics for connection success rate
   - Track authentication failure reasons
   - Monitor average connection establishment time
   - Alert on high timeout rates
   - Monitor Cloud Run cold start frequency

4. **Rollback Plan**
   - If connection success rate drops below 95%, rollback server
   - If average connection time exceeds 5 seconds, investigate (allow for cold starts)
   - Keep old client version available for emergency rollback

## Security Considerations

1. **Guest Token Validation**
   - Guest tokens must have limited permissions
   - Guest sessions must expire after 1 hour
   - Guest users cannot access protected resources

2. **Rate Limiting**
   - Limit connection attempts per IP (10 per minute)
   - Limit authentication failures per IP (5 per minute)
   - Block IPs with excessive failures

3. **Token Security**
   - Never log full tokens
   - Use secure token generation
   - Implement token rotation for long-lived sessions
