/**
 * WebSocket Client Service
 *
 * Manages WebSocket connection to backend server for real-time communication.
 * - Handles connection lifecycle (connect, disconnect, reconnect)
 * - Implements JWT authentication in handshake
 * - Provides automatic reconnection with exponential backoff
 * - Manages message queue for offline scenarios
 * - Monitors connection health with heartbeat/ping-pong
 *
 * This is a re-export of NativeWebSocketClient for backward compatibility.
 */

export {
  NativeWebSocketClient as WebSocketClient,
  getWebSocketClient,
  ConnectionState,
  type WebSocketMessage,
  type MessageEnvelope,
} from './NativeWebSocketClient';
