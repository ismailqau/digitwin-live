---
inclusion: fileMatch
fileMatchPattern: 'apps/websocket-server/**/*'
---

# WebSocket Server Patterns

## Socket.io Setup

The WebSocket server uses Socket.io for real-time communication:

```typescript
import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    methods: ['GET', 'POST'],
  },
});
```

## Authentication

Authenticate connections using JWT:

```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = await verifyToken(token);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});
```

## Event Handlers

### Client Events (Incoming)

```typescript
socket.on('audio-chunk', async (data) => {
  // Handle audio chunk from client
  const { sessionId, audioData, sequenceNumber } = data;
  await processAudioChunk(socket.user.id, sessionId, audioData, sequenceNumber);
});

socket.on('interruption', async (data) => {
  // Handle user interruption
  const { sessionId } = data;
  await handleInterruption(socket.user.id, sessionId);
});

socket.on('conversation:start', async (data) => {
  // Start new conversation session
  const session = await startConversation(socket.user.id, data);
  socket.emit('conversation:started', { sessionId: session.id });
});

socket.on('conversation:end', async (data) => {
  // End conversation session
  await endConversation(socket.user.id, data.sessionId);
  socket.emit('conversation:ended', { sessionId: data.sessionId });
});
```

### Server Events (Outgoing)

```typescript
// Send transcript to client
socket.emit('transcript', {
  sessionId,
  text: transcribedText,
  isFinal: true,
  timestamp: Date.now(),
});

// Send LLM response
socket.emit('llm-response', {
  sessionId,
  text: responseText,
  timestamp: Date.now(),
});

// Send audio chunk
socket.emit('audio-chunk', {
  sessionId,
  audioData: base64Audio,
  sequenceNumber,
  timestamp: Date.now(),
});

// Send error
socket.emit('error', {
  sessionId,
  errorCode: 'ASR_ERROR',
  errorMessage: 'Technical error',
  userMessage: 'Could not understand audio. Please try again.',
  recoverable: true,
  timestamp: Date.now(),
});
```

## Session Management

```typescript
// Track active sessions per socket
const activeSessions = new Map<string, Set<string>>();

socket.on('connect', () => {
  activeSessions.set(socket.id, new Set());
});

socket.on('disconnect', async () => {
  const sessions = activeSessions.get(socket.id);
  if (sessions) {
    for (const sessionId of sessions) {
      await cleanupSession(sessionId);
    }
  }
  activeSessions.delete(socket.id);
});
```

## Error Handling

```typescript
import { WebSocketErrorHandler } from '../utils/errorHandler';

socket.on('audio-chunk', async (data) => {
  try {
    await processAudioChunk(data);
  } catch (error) {
    if (error.code === 'ASR_ERROR') {
      WebSocketErrorHandler.sendASRError(socket, data.sessionId);
    } else if (error.code === 'GPU_UNAVAILABLE') {
      WebSocketErrorHandler.sendGPUUnavailableError(socket, data.sessionId, 5);
    } else {
      WebSocketErrorHandler.sendGenericError(socket, data.sessionId, error.message);
    }
  }
});
```

## Room Management

```typescript
// Join user to their room
socket.join(`user:${socket.user.id}`);

// Join session room
socket.join(`session:${sessionId}`);

// Broadcast to session
io.to(`session:${sessionId}`).emit('event', data);
```
