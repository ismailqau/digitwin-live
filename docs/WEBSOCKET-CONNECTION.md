# WebSocket Connection Guide

## Overview

This guide documents the WebSocket connection flow, authentication mechanisms, and troubleshooting procedures for the DigiTwin Live real-time communication system.

## Table of Contents

- [Connection Flow](#connection-flow)
- [Authentication](#authentication)
- [Guest Token Support](#guest-token-support)
- [Client States](#client-states)
- [Server Events](#server-events)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Cloud Run Configuration](#cloud-run-configuration)

## Connection Flow

### Overview Diagram

```
Mobile Client                    WebSocket Server
     |                                  |
     |------ connect() ----------------->|
     |  (with auth token)               |
     |                                  |
     |<----- Socket.IO connect ---------|
     |  (transport established)         |
     |                                  |
     |  State: AUTHENTICATING           |
     |  (waits for session_created)    |
     |                                  |
     |                                  | (validates token)
     |                                  |
     |<----- session_created -----------| (success)
     |  OR                              |
     |<----- auth_error ----------------| (failure)
     |                                  |
     | State: CONNECTED or ERROR        |
```

### Detailed Flow

1. **Client Initiates Connection**
   - Client calls `connect()` with authentication token
   - State transitions to `CONNECTING`
   - Socket.IO begins connection handshake

2. **Transport Establishment**
   - Socket.IO establishes transport (polling first, then upgrades to WebSocket)
   - `connect` event fires on client
   - State transitions to `AUTHENTICATING`

3. **Server Authentication**
   - Server validates authentication token
   - Creates session if valid
   - Emits either `session_created` or `auth_error`

4. **Client State Resolution**
   - On `session_created`: State transitions to `CONNECTED`
   - On `auth_error`: State transitions to `ERROR`, schedules reconnection
   - On timeout (10s): State transitions to `ERROR`, schedules reconnection

## Authentication

### Token Types

The WebSocket server supports two types of authentication tokens:

1. **JWT Tokens** - For authenticated users
2. **Guest Tokens** - For unauthenticated users

### JWT Token Authentication

JWT tokens are issued by the authentication service and contain user identity information.

**Token Format:**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE3MzM1NDc2MDAsImV4cCI6MTczMzU1MTIwMH0.signature
```

**Token Payload:**

```typescript
{
  userId: string;
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
}
```

**Usage:**

```typescript
const socket = io(WEBSOCKET_URL, {
  auth: { token: jwtToken },
  transports: ['polling', 'websocket'],
});
```

### Guest Token Authentication

Guest tokens allow users to connect without creating an account. They provide limited functionality.

**Token Format:**

```
guest_<uuid>_<timestamp>
```

**Example:**

```
guest_550e8400-e29b-41d4-a716-446655440000_1733547600000
```

**Generation (Mobile App):**

```typescript
import { v4 as uuidv4 } from 'uuid';

export const generateGuestToken = (): string => {
  const uuid = uuidv4();
  const timestamp = Date.now();
  return `guest_${uuid}_${timestamp}`;
};
```

**Validation (Server):**

```typescript
const isGuestToken = (token: string): boolean => {
  return /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_\d+$/.test(token);
};

const verifyGuestToken = (token: string): boolean => {
  if (!isGuestToken(token)) {
    return false;
  }

  const parts = token.split('_');
  const timestamp = parseInt(parts[2], 10);
  const age = Date.now() - timestamp;

  // Guest tokens expire after 1 hour
  return age < 3600000;
};
```

**Guest Session Limitations:**

- Cannot access protected resources
- Session expires after 1 hour
- Limited conversation history
- Cannot save preferences

## Guest Token Support

### Mobile App Implementation

**1. Token Generation on Sign-In Skip:**

```typescript
// When user skips sign-in
const handleSkipSignIn = async () => {
  const guestToken = generateGuestToken();
  await SecureStorage.setAccessToken(guestToken);

  // Connect to WebSocket with guest token
  await webSocketClient.connect();
};
```

**2. Token Storage:**

```typescript
import SecureStorage from '@clone/secure-storage';

// Store guest token
await SecureStorage.setAccessToken(guestToken);

// Retrieve token for connection
const token = await SecureStorage.getAccessToken();
```

**3. Guest Mode UI:**

```typescript
// Display guest mode indicator
{isGuest && (
  <View style={styles.guestBanner}>
    <Text>Guest Mode</Text>
    <Text>Sign in to save your data</Text>
    <Button title="Sign In" onPress={handleSignIn} />
  </View>
)}
```

### Server Implementation

**1. Token Validation:**

```typescript
const verifyToken = async (token: string): Promise<AuthResult> => {
  // Check if guest token
  if (isGuestToken(token)) {
    if (verifyGuestToken(token)) {
      return {
        success: true,
        payload: {
          userId: token, // Use token as userId for guest
          isGuest: true,
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'AUTH_EXPIRED',
        message: 'Guest token expired',
      },
    };
  }

  // Verify JWT token
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return {
      success: true,
      payload: {
        userId: payload.userId,
        isGuest: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AUTH_INVALID',
        message: 'Invalid authentication token',
      },
    };
  }
};
```

**2. Session Creation:**

```typescript
const handleConnection = async (socket: Socket) => {
  const token = socket.handshake.auth.token;
  const authResult = await verifyToken(token);

  if (!authResult.success) {
    socket.emit('auth_error', {
      code: authResult.error.code,
      message: authResult.error.message,
      timestamp: Date.now(),
    });
    socket.disconnect();
    return;
  }

  // Create session
  const session = await createSession({
    userId: authResult.payload.userId,
    isGuest: authResult.payload.isGuest,
    socketId: socket.id,
  });

  socket.emit('session_created', {
    sessionId: session.id,
    userId: session.userId,
    isGuest: session.isGuest,
    timestamp: Date.now(),
  });
};
```

## Client States

The WebSocket client uses a state machine to track connection status:

### State Enum

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

### State Transitions

```
DISCONNECTED
    |
    | connect()
    v
CONNECTING (Socket.IO connecting)
    |
    | Socket.IO 'connect' event
    v
AUTHENTICATING (waiting for session_created)
    |
    +---> CONNECTED (session_created received)
    |
    +---> ERROR (auth_error or timeout)
    |
    v
RECONNECTING (exponential backoff)
    |
    v
CONNECTING (retry)
```

### State Descriptions

| State            | Description                       | Duration            |
| ---------------- | --------------------------------- | ------------------- |
| `DISCONNECTED`   | Initial state, no connection      | Indefinite          |
| `CONNECTING`     | Socket.IO establishing transport  | 0-30s               |
| `AUTHENTICATING` | Waiting for server auth response  | 0-10s               |
| `CONNECTED`      | Fully connected and authenticated | Until disconnect    |
| `ERROR`          | Connection or auth failed         | Until reconnect     |
| `RECONNECTING`   | Waiting before retry              | Exponential backoff |

### Implementation

```typescript
class WebSocketClient {
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  private setConnectionState(state: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;

    logger.info('Connection state changed', {
      from: previousState,
      to: state,
      timestamp: Date.now(),
    });

    this.emit('connectionStateChange', state);
  }

  async connect(): Promise<void> {
    this.setConnectionState(ConnectionState.CONNECTING);

    const token = await SecureStorage.getAccessToken();

    this.socket = io(WEBSOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: false,
      timeout: 30000,
    });

    this.socket.on('connect', () => {
      this.setConnectionState(ConnectionState.AUTHENTICATING);
      this.startSessionTimeout();
    });

    this.socket.on('session_created', (data) => {
      this.clearSessionTimeout();
      this.setConnectionState(ConnectionState.CONNECTED);
      this.emit('sessionCreated', data);
    });

    this.socket.on('auth_error', (error) => {
      this.clearSessionTimeout();
      this.setConnectionState(ConnectionState.ERROR);
      this.handleAuthError(error);
    });
  }

  private startSessionTimeout(): void {
    this.sessionTimeout = setTimeout(() => {
      logger.error('Timeout waiting for session_created');
      this.setConnectionState(ConnectionState.ERROR);
      this.scheduleReconnect();
    }, 10000); // 10 seconds
  }
}
```

## Server Events

### session_created

Emitted when authentication succeeds and a session is created.

**Event Name:** `session_created`

**Payload:**

```typescript
interface SessionCreatedPayload {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  timestamp: number;
}
```

**Example:**

```json
{
  "sessionId": "sess_abc123",
  "userId": "user_xyz789",
  "isGuest": false,
  "timestamp": 1733547600000
}
```

**Client Handler:**

```typescript
socket.on('session_created', (data: SessionCreatedPayload) => {
  logger.info('Session created', data);
  setConnectionState(ConnectionState.CONNECTED);
  setSessionData(data);
});
```

### auth_error

Emitted when authentication fails.

**Event Name:** `auth_error`

**Payload:**

```typescript
interface AuthErrorPayload {
  code: 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'AUTH_EXPIRED';
  message: string;
  timestamp: number;
}
```

**Error Codes:**

| Code            | Description          | Client Action                 |
| --------------- | -------------------- | ----------------------------- |
| `AUTH_REQUIRED` | No token provided    | Fall back to guest token      |
| `AUTH_INVALID`  | Token format invalid | Fall back to guest token      |
| `AUTH_EXPIRED`  | Token expired        | Refresh token, then reconnect |

**Example:**

```json
{
  "code": "AUTH_EXPIRED",
  "message": "Authentication token expired",
  "timestamp": 1733547600000
}
```

**Client Handler:**

```typescript
socket.on('auth_error', async (error: AuthErrorPayload) => {
  logger.error('Authentication failed', error);

  if (error.code === 'AUTH_EXPIRED') {
    // Try to refresh token
    const refreshed = await refreshToken();
    if (refreshed) {
      reconnect();
      return;
    }
  }

  // Fall back to guest mode
  if (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_INVALID') {
    const guestToken = generateGuestToken();
    await SecureStorage.setAccessToken(guestToken);
    reconnect();
  }
});
```

## Error Handling

### Server-Side Error Handling

The server ensures that every connection attempt receives a response:

```typescript
const handleConnection = async (socket: Socket) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      socket.emit('auth_error', {
        code: 'AUTH_REQUIRED',
        message: 'Authentication token required',
        timestamp: Date.now(),
      });
      socket.disconnect();
      return;
    }

    const authResult = await verifyToken(token);

    if (!authResult.success) {
      socket.emit('auth_error', {
        code: authResult.error.code,
        message: authResult.error.message,
        timestamp: Date.now(),
      });
      socket.disconnect();
      return;
    }

    // Create session with timeout
    const session = await Promise.race([
      createSession(authResult.payload),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session creation timeout')), 5000)
      ),
    ]);

    socket.emit('session_created', {
      sessionId: session.id,
      userId: session.userId,
      isGuest: session.isGuest,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Connection handling failed', {
      error: error.message,
      stack: error.stack,
      socketId: socket.id,
    });

    socket.emit('auth_error', {
      code: 'AUTH_INVALID',
      message: 'Failed to establish connection',
      timestamp: Date.now(),
    });
    socket.disconnect();
  }
};
```

### Client-Side Error Handling

```typescript
class WebSocketClient {
  private handleAuthError(error: AuthErrorPayload): void {
    logger.error('Authentication error', {
      code: error.code,
      message: error.message,
      tokenType: this.isGuestToken() ? 'guest' : 'jwt',
    });

    this.setConnectionState(ConnectionState.ERROR);

    // Handle specific error codes
    switch (error.code) {
      case 'AUTH_EXPIRED':
        this.handleExpiredToken();
        break;
      case 'AUTH_REQUIRED':
      case 'AUTH_INVALID':
        this.handleInvalidToken();
        break;
    }
  }

  private async handleExpiredToken(): Promise<void> {
    try {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        this.scheduleReconnect(0); // Immediate reconnect
        return;
      }
    } catch (error) {
      logger.error('Token refresh failed', error);
    }

    // Fall back to guest mode
    await this.useGuestToken();
    this.scheduleReconnect(1000);
  }

  private async handleInvalidToken(): Promise<void> {
    await this.useGuestToken();
    this.scheduleReconnect(1000);
  }

  private async useGuestToken(): Promise<void> {
    const guestToken = generateGuestToken();
    await SecureStorage.setAccessToken(guestToken);
    logger.info('Switched to guest mode');
  }
}
```

## Troubleshooting

### Connection Timeout

**Symptom:** Client times out waiting for `session_created` event.

**Possible Causes:**

1. Server authentication failure not emitting `auth_error`
2. Network issues preventing event delivery
3. Cloud Run cold start delay
4. Token validation taking too long

**Diagnosis:**

```typescript
// Enable debug logging
socket.on('connect', () => {
  logger.debug('Socket.IO connected', {
    socketId: socket.id,
    transport: socket.io.engine.transport.name,
  });
});

socket.on('connect_error', (error) => {
  logger.error('Connection error', {
    message: error.message,
    description: error.description,
  });
});
```

**Solutions:**

1. Check server logs for authentication errors
2. Verify token is being sent correctly
3. Increase timeout for Cloud Run cold starts
4. Check network connectivity

### Authentication Failures

**Symptom:** Receiving `auth_error` events repeatedly.

**Possible Causes:**

1. Invalid or expired JWT token
2. Guest token format incorrect
3. Server-side validation logic error
4. Token not being sent in handshake

**Diagnosis:**

```typescript
// Log token details (without exposing full token)
const token = await SecureStorage.getAccessToken();
logger.debug('Connecting with token', {
  tokenType: token?.startsWith('guest_') ? 'guest' : 'jwt',
  tokenLength: token?.length,
  tokenPrefix: token?.substring(0, 10),
});
```

**Solutions:**

1. Verify token format matches expected pattern
2. Check token expiration time
3. Ensure token is included in `auth` object
4. Try generating new guest token

### Stuck in AUTHENTICATING State

**Symptom:** Client remains in AUTHENTICATING state indefinitely.

**Possible Causes:**

1. Server not emitting any response event
2. Event listener not registered
3. Network packet loss
4. Server crash during authentication

**Diagnosis:**

```typescript
// Add timeout monitoring
const authTimeout = setTimeout(() => {
  logger.error('Stuck in AUTHENTICATING state', {
    duration: 10000,
    socketConnected: socket.connected,
    socketId: socket.id,
  });
}, 10000);

socket.on('session_created', () => {
  clearTimeout(authTimeout);
});

socket.on('auth_error', () => {
  clearTimeout(authTimeout);
});
```

**Solutions:**

1. Implement timeout mechanism (10 seconds)
2. Verify server is emitting events
3. Check server logs for errors
4. Restart connection

### Rapid Reconnection Loop

**Symptom:** Client repeatedly connects and disconnects.

**Possible Causes:**

1. Auth error causing immediate reconnect
2. No exponential backoff
3. Invalid token not being replaced
4. Server rejecting all connections

**Diagnosis:**

```typescript
// Track reconnection attempts
let reconnectCount = 0;
const reconnectStart = Date.now();

const scheduleReconnect = (delay: number) => {
  reconnectCount++;
  const elapsed = Date.now() - reconnectStart;

  logger.warn('Scheduling reconnection', {
    attempt: reconnectCount,
    delay,
    elapsedMs: elapsed,
  });

  if (reconnectCount > 10 && elapsed < 60000) {
    logger.error('Too many reconnection attempts', {
      count: reconnectCount,
      duration: elapsed,
    });
    // Stop reconnecting
    return;
  }

  setTimeout(() => connect(), delay);
};
```

**Solutions:**

1. Implement exponential backoff
2. Replace invalid tokens with guest tokens
3. Add maximum reconnection attempts
4. Check server health

### Guest Mode Not Working

**Symptom:** Guest token connections failing.

**Possible Causes:**

1. Guest token format incorrect
2. Server not recognizing guest tokens
3. Guest token validation failing
4. Guest session creation error

**Diagnosis:**

```typescript
// Validate guest token format
const validateGuestToken = (token: string): boolean => {
  const pattern = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_\d+$/;
  const isValid = pattern.test(token);

  logger.debug('Guest token validation', {
    isValid,
    token: token.substring(0, 20) + '...',
  });

  return isValid;
};
```

**Solutions:**

1. Verify guest token generation logic
2. Check server guest token validation
3. Ensure guest session creation works
4. Review server logs for guest-specific errors

### Cloud Run Cold Start Issues

**Symptom:** First connection takes 10+ seconds.

**Possible Causes:**

1. Cloud Run instance starting from zero
2. Container initialization time
3. Database connection pool warming up
4. Dependencies loading

**Diagnosis:**

```typescript
// Measure connection timing
const connectStart = Date.now();

socket.on('connect', () => {
  const transportTime = Date.now() - connectStart;
  logger.info('Transport established', { durationMs: transportTime });
});

socket.on('session_created', () => {
  const totalTime = Date.now() - connectStart;
  logger.info('Session created', { durationMs: totalTime });
});
```

**Solutions:**

1. Set minimum instances to 1: `--min-instances=1`
2. Enable session affinity
3. Increase client timeouts (30s connect, 10s auth)
4. Use polling transport first
5. Implement connection retry with backoff

## Cloud Run Configuration

### Required Settings

For optimal WebSocket performance on Cloud Run:

```bash
gcloud run services update websocket-server \
  --session-affinity \
  --min-instances=1 \
  --timeout=3600 \
  --cpu-throttling=false \
  --region=us-central1
```

### Configuration Explanation

| Setting            | Value   | Reason                                               |
| ------------------ | ------- | ---------------------------------------------------- |
| `session-affinity` | Enabled | Ensures WebSocket connections stick to same instance |
| `min-instances`    | 1       | Reduces cold starts                                  |
| `timeout`          | 3600s   | Allows long-lived WebSocket connections              |
| `cpu-throttling`   | false   | Consistent performance for real-time communication   |

### Socket.IO Configuration

**Server:**

```typescript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    credentials: true,
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowUpgrades: true,
  perMessageDeflate: false,
});
```

**Client:**

```typescript
const socket = io(WEBSOCKET_URL, {
  auth: { token },
  transports: ['polling', 'websocket'], // Polling first
  reconnection: false,
  timeout: 30000,
  upgrade: true,
  forceNew: true,
});
```

### Monitoring

Monitor these metrics for Cloud Run WebSocket performance:

- Connection success rate (target: >95%)
- Average connection time (target: <3s, allow for cold starts)
- Authentication failure rate
- Timeout rate
- Cold start frequency

## Best Practices

1. **Always Use Timeouts**
   - 30s for Socket.IO connection
   - 10s for session creation
   - Implement exponential backoff

2. **Handle All Error Cases**
   - Missing token → Guest mode
   - Invalid token → Guest mode
   - Expired token → Refresh, then guest mode
   - Timeout → Reconnect with backoff

3. **Log Comprehensively**
   - All connection attempts
   - State transitions
   - Authentication results
   - Error details with context

4. **Graceful Degradation**
   - Fall back to guest mode on auth failure
   - Continue with limited functionality
   - Prompt user to sign in for full features

5. **User Experience**
   - Show connection status clearly
   - Indicate guest mode prominently
   - Provide sign-in option
   - Handle reconnection transparently

## References

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Cloud Run WebSocket Support](https://cloud.google.com/run/docs/triggering/websockets)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [WebSocket Security](https://owasp.org/www-community/vulnerabilities/WebSocket_Security)
