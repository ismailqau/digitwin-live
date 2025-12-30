---
inclusion: fileMatch
fileMatchPattern: 'apps/websocket-server/**/*'
---

# WebSocket Patterns

## Setup (ws library)

```typescript
const wss = new WebSocketServer({ server: httpServer, path: '/socket.io/' });
```

## Auth

Token in query string: `?token=xxx` (JWT or guest `guest_{uuid}_{timestamp}`)

```typescript
const token = authHandler.extractTokenFromRequest(request);
const payload = await authHandler.authenticateConnection(token, connectionId);
```

## Message Protocol

```typescript
interface MessageEnvelope {
  type: string;
  sessionId?: string;
  data?: unknown;
  timestamp: number;
}
ws.send(
  MessageProtocol.serialize(
    MessageProtocol.createEnvelope('transcript', { text, isFinal }, sessionId)
  )
);
```

## Events

Client → Server: `audio_chunk`, `ping`, `message`
Server → Client: `session_created`, `transcript`, `llm_response`, `audio_chunk`, `pong`, `error`

## Heartbeat

Ping every 25s, timeout after 60s without pong. Close codes: 4001 (auth), 4002 (timeout)

## Key Components

`NativeWebSocketServer` | `ConnectionManager` | `AuthenticationHandler` | `MessageProtocol`
