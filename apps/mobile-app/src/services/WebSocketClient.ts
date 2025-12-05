/**
 * WebSocket Client Service
 *
 * Manages WebSocket connection to backend server for real-time communication.
 * - Handles connection lifecycle (connect, disconnect, reconnect)
 * - Implements JWT authentication in handshake
 * - Provides automatic reconnection with exponential backoff
 * - Manages message queue for offline scenarios
 * - Monitors connection health with heartbeat/ping-pong
 */

import { io, Socket } from 'socket.io-client';

import { SecureStorage } from './SecureStorage';

console.log('[WebSocketClient] Module loaded');

// WebSocket server configuration
// For iOS simulator, use 127.0.0.1 (localhost doesn't work in React Native)
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'http://127.0.0.1:3001';
const RECONNECTION_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]; // Exponential backoff
const CONNECTION_TIMEOUT = 8000; // 30 seconds
const HEARTBEAT_INTERVAL = 4000; // 15 seconds

export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

export interface WebSocketMessage {
  type: string;
  sessionId?: string;
  data?: unknown;
  timestamp?: number;
}

type EventHandler = (data: unknown) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;

export class WebSocketClient {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private stateHandlers: Set<ConnectionStateHandler> = new Set();
  private lastPingTime: number = 0;
  private latency: number = 0;
  private authToken: string | null = null;

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Connect to WebSocket server with JWT authentication
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('[WebSocketClient] Already connected');
      return;
    }

    try {
      this.setConnectionState(ConnectionState.CONNECTING);

      // Use stored auth token or try to get from SecureStorage
      let accessToken: string | null = this.authToken;

      if (!accessToken) {
        try {
          accessToken = await SecureStorage.getAccessToken();
        } catch {
          console.warn('[WebSocketClient] Could not get access token from storage');
        }
      }

      if (!accessToken) {
        console.warn('[WebSocketClient] No auth token available, connecting without auth');
      } else {
        console.log('[WebSocketClient] Using auth token:', accessToken.substring(0, 20) + '...');
      }

      console.log('[WebSocketClient] Connecting to:', WEBSOCKET_URL);
      console.log('[WebSocketClient] Connection timeout:', CONNECTION_TIMEOUT);

      // Test basic HTTP connectivity first
      try {
        console.log('[WebSocketClient] Testing HTTP connectivity...');
        const testResponse = await fetch(`${WEBSOCKET_URL}/health`);
        const testData = await testResponse.json();
        console.log('[WebSocketClient] ✅ HTTP test successful:', testData);
      } catch {
        console.error('[WebSocketClient] ❌ HTTP test failed');
        throw new Error(`Cannot reach server at ${WEBSOCKET_URL}`);
      }

      // Create socket connection with auth
      // Try polling first, then upgrade to websocket
      this.socket = io(WEBSOCKET_URL, {
        auth: accessToken ? { token: accessToken } : {},
        transports: ['polling', 'websocket'],
        reconnection: false, // We handle reconnection manually
        timeout: CONNECTION_TIMEOUT,
        forceNew: true,
      });

      console.log('[WebSocketClient] Socket.IO client created');

      this.setupEventListeners();
      this.startHeartbeat();
    } catch (error) {
      console.error('[WebSocketClient] Connection error:', error);
      this.setConnectionState(ConnectionState.ERROR);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[WebSocketClient] Disconnecting...');

    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.reconnectAttempts = 0;
    this.messageQueue = [];
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (this.socket?.connected) {
      this.socket.emit(message.type, message.data);
    } else {
      // Queue message for later if disconnected
      console.log('[WebSocketClient] Queueing message (disconnected):', message.type);
      this.messageQueue.push(message);
    }
  }

  /**
   * Subscribe to event
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.stateHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current latency (from ping/pong)
   */
  getLatency(): number {
    return this.latency;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) {
      console.error('[WebSocketClient] Cannot setup listeners - socket is null');
      return;
    }

    console.log('[WebSocketClient] Setting up event listeners');

    // Connection established
    this.socket.on('connect', () => {
      console.log('[WebSocketClient] ✅ Connected successfully!');
      this.setConnectionState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.processMessageQueue();
    });

    // Connection lost
    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocketClient] Disconnected:', reason);
      this.setConnectionState(ConnectionState.DISCONNECTED);

      // Attempt reconnection unless manually disconnected
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('[WebSocketClient] ❌ Connection error:', error.message);
      console.error('[WebSocketClient] Error details:', JSON.stringify(error, null, 2));
      this.setConnectionState(ConnectionState.ERROR);
      this.scheduleReconnect();
    });

    // Authentication successful
    this.socket.on('authenticated', (data) => {
      console.log('[WebSocketClient] Authenticated:', data);
      this.emit('authenticated', data);
    });

    // Authentication failed
    this.socket.on('auth_error', (error) => {
      console.error('[WebSocketClient] Authentication failed:', error);
      this.emit('auth_error', error);
      this.disconnect();
    });

    // Pong response (for latency measurement)
    this.socket.on('pong', () => {
      this.latency = Date.now() - this.lastPingTime;
      console.log('[WebSocketClient] Latency:', this.latency, 'ms');
    });

    // Generic error handler
    this.socket.on('error', (error) => {
      console.error('[WebSocketClient] Socket error:', error);
      this.emit('error', error);
    });

    // Forward all other events to handlers
    this.socket.onAny((event, data) => {
      this.emit(event, data);
    });
  }

  /**
   * Emit event to all registered handlers
   */
  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);

    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocketClient] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Set connection state and notify handlers
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      console.log('[WebSocketClient] State changed:', state);

      this.stateHandlers.forEach((handler) => {
        try {
          handler(state);
        } catch (error) {
          console.error('[WebSocketClient] Error in state handler:', error);
        }
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const delayIndex = Math.min(this.reconnectAttempts, RECONNECTION_DELAYS.length - 1);
    const delay = RECONNECTION_DELAYS[delayIndex];

    console.log(
      `[WebSocketClient] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`
    );

    this.setConnectionState(ConnectionState.RECONNECTING);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Start heartbeat/ping-pong mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.lastPingTime = Date.now();
        this.socket.emit('ping');
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Process queued messages after reconnection
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`[WebSocketClient] Processing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach((message) => {
      this.send(message);
    });
  }
}

// Singleton instance
let instance: WebSocketClient | null = null;

export const getWebSocketClient = (): WebSocketClient => {
  if (!instance) {
    instance = new WebSocketClient();
  }
  return instance;
};
