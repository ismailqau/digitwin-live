---
inclusion: fileMatch
fileMatchPattern: 'apps/websocket-server/**/*'
---

# WebSocket Server Patterns

## Native WebSocket Setup (ws library)

The WebSocket server uses the native `ws` library for real-time communication:

```typescript
import { Server as HTTPServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

const httpServer = createServer();
const wss = new WebSocketServer({
  server: httpServer,
  path: '/socket.io/', // Maintain compatibility with existing clients
});

wss.on('connection', async (ws, request) => {
  // Handle new connection
});
```

## Authentication

Authenticate connections using JWT or guest tokens in the URL query string:

```typescript
import { AuthenticationHandler } from './AuthenticationHandler';
import { AuthService } from '../../application/services/AuthService';

const authService = new AuthService();
const authHandler = new AuthenticationHandler(authService);

wss.on('connection', async (ws, request) => {
  const connectionId = uuidv4();

  try {
    // Extract token from query string: ?token=xxx
    const token = authHandler.extractTokenFromRequest(request);

    // Verify token (supports JWT and guest tokens)
    const payload = await authHandler.authenticateConnection(token, connectionId);

    // Create session
    const session = await sessionService.createSession(payload.userId, connectionId);

    // Send session_created event
    authHandler.sendSessionCreated(ws, session.id, payload.userId, payload.isGuest);
  } catch (error) {
    // Send auth error and close connection
    const { code, message } = authHandler.mapAuthError(error);
    authHandler.sendAuthError(ws, code, message);
    ws.close(4001, message);
  }
});
```

### Guest Token Format

Guest tokens follow the format: `guest_{uuid}_{timestamp}`

```typescript
// Generate guest token on client
const guestToken = `guest_${uuid()}_${Date.now()}`;

// Guest tokens expire after 24 hours (configurable)
const GUEST_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;
```

## Message Protocol

All messages use a standardized envelope format:

```typescript
interface MessageEnvelope {
  type: string; // Message type (e.g., 'audio_chunk', 'transcript')
  sessionId?: string; // Session identifier
  data?: unknown; // Message payload
  timestamp: number; // Unix timestamp in milliseconds
}

// Create and send messages
const envelope = MessageProtocol.createEnvelope(
  'transcript',
  {
    text: transcribedText,
    isFinal: true,
  },
  sessionId
);

ws.send(MessageProtocol.serialize(envelope));

// Parse incoming messages
const result = MessageProtocol.deserialize(data.toString());
if (result.success && result.message) {
  // Handle message
}
```

## Event Handlers

### Message Handling

```typescript
ws.on('message', async (data) => {
  const result = MessageProtocol.deserialize(data.toString());

  if (!result.success || !result.message) {
    // Send error response
    const errorEnvelope = MessageProtocol.createErrorEnvelope(
      'INVALID_MESSAGE',
      result.error || 'Invalid message format',
      sessionId
    );
    ws.send(MessageProtocol.serialize(errorEnvelope));
    return;
  }

  const message = result.message;

  switch (message.type) {
    case 'audio_chunk':
      await handleAudioChunk(connectionId, message);
      break;
    case 'ping':
      const pong = MessageProtocol.createEnvelope('pong', { timestamp: Date.now() }, sessionId);
      ws.send(MessageProtocol.serialize(pong));
      break;
    case 'message':
      await messageRouter.routeClientMessage(sessionId, message.data);
      break;
    default:
      logger.debug('Unhandled message type', { type: message.type });
  }
});
```

### Server Events (Outgoing)

```typescript
// Send transcript
const transcriptEnvelope = MessageProtocol.createEnvelope(
  'transcript',
  {
    text: transcribedText,
    isFinal: true,
  },
  sessionId
);
ws.send(MessageProtocol.serialize(transcriptEnvelope));

// Send LLM response
const responseEnvelope = MessageProtocol.createEnvelope(
  'llm_response',
  {
    text: responseText,
  },
  sessionId
);
ws.send(MessageProtocol.serialize(responseEnvelope));

// Send audio chunk
const audioEnvelope = MessageProtocol.createEnvelope(
  'audio_chunk',
  {
    audioData: base64Audio,
    sequenceNumber,
  },
  sessionId
);
ws.send(MessageProtocol.serialize(audioEnvelope));

// Send error
const errorEnvelope = MessageProtocol.createErrorEnvelope(
  'ASR_ERROR',
  'Could not understand audio. Please try again.',
  sessionId
);
ws.send(MessageProtocol.serialize(errorEnvelope));
```

## Connection Management

```typescript
import { ConnectionManager, WebSocketConnection } from './ConnectionManager';

const connectionManager = new ConnectionManager();

// Register connection after authentication
const connection: WebSocketConnection = {
  id: connectionId,
  ws,
  userId: payload.userId,
  sessionId: session.id,
  isAuthenticated: true,
  lastPing: Date.now(),
  createdAt: Date.now(),
};
connectionManager.registerConnection(connectionId, connection);

// Get connection
const conn = connectionManager.getConnection(connectionId);

// Get connections by session
const sessionConnections = connectionManager.getConnectionsBySession(sessionId);

// Unregister on disconnect
ws.on('close', () => {
  connectionManager.unregisterConnection(connectionId);
});
```

## Heartbeat Mechanism

Heartbeat ping every 25 seconds, connection timeout after 60 seconds without pong:

```typescript
const HEARTBEAT_INTERVAL_MS = 25000;
const CONNECTION_TIMEOUT_MS = 60000;

// Start heartbeat
const pingInterval = setInterval(() => {
  const now = Date.now();
  const connections = connectionManager.getAllConnections();

  for (const connection of connections) {
    // Check for timeout
    if (now - connection.lastPing > CONNECTION_TIMEOUT_MS) {
      connection.ws.close(4002, 'Connection timeout');
      continue;
    }

    // Send ping
    if (connection.ws.readyState === WebSocket.OPEN) {
      const pingEnvelope = MessageProtocol.createEnvelope('ping', { timestamp: now });
      connection.ws.send(MessageProtocol.serialize(pingEnvelope));
    }
  }
}, HEARTBEAT_INTERVAL_MS);

// Handle pong from client
if (message.type === 'ping') {
  const pongEnvelope = MessageProtocol.createEnvelope('pong', { timestamp: Date.now() }, sessionId);
  ws.send(MessageProtocol.serialize(pongEnvelope));
  connectionManager.updateConnection(connectionId, { lastPing: Date.now() });
}
```

## Error Handling

```typescript
// Authentication errors
export enum AuthErrorCode {
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  SESSION_CREATE_FAILED = 'SESSION_CREATE_FAILED',
}

// Send auth error
authHandler.sendAuthError(ws, AuthErrorCode.AUTH_INVALID, 'Invalid token');

// Send message error
const errorEnvelope = MessageProtocol.createErrorEnvelope(
  'PROCESSING_ERROR',
  'Failed to process request',
  sessionId
);
ws.send(MessageProtocol.serialize(errorEnvelope));

// Close codes
// 4001 - Authentication failed
// 4002 - Connection timeout
// 1001 - Server shutting down
```

## Broadcasting

```typescript
// Send to specific connection
sendMessage(connectionId: string, message: MessageEnvelope): boolean {
  const connection = connectionManager.getConnection(connectionId);
  if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  connection.ws.send(MessageProtocol.serialize(message));
  return true;
}

// Broadcast to all connections in a session
broadcast(sessionId: string, message: MessageEnvelope): void {
  const connections = connectionManager.getConnectionsBySession(sessionId);
  for (const connection of connections) {
    sendMessage(connection.id, message);
  }
}
```

## Key Components

- `NativeWebSocketServer` - Main WebSocket server implementation
- `ConnectionManager` - Manages active WebSocket connections
- `AuthenticationHandler` - Handles JWT and guest token authentication
- `MessageProtocol` - Serialization/deserialization of message envelopes
- `WebSocketController` - Routes messages to appropriate handlers
