/**
 * Native WebSocket Client Service
 *
 * Manages WebSocket connection to backend server for real-time communication using native WebSocket.
 * - Handles connection lifecycle (connect, disconnect, reconnect)
 * - Implements JWT authentication in handshake
 * - Provides automatic reconnection with exponential backoff
 * - Manages message queue for offline scenarios
 * - Monitors connection health with heartbeat/ping-pong
 *
 * Implements Requirements:
 * - 1.2: React Native built-in WebSocket implementation
 * - 2.3: Reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s)
 * - 2.4: Session restoration and message queue processing
 * - 2.5: Manual disconnect prevents automatic reconnection
 * - 3.4: Heartbeat ping every 25 seconds
 * - 3.5: Connection timeout after 60 seconds without pong
 * - 4.1-4.5: Event handling, subscription, message queuing
 */

import ENV from '../config/env';
import { generateGuestToken, isGuestToken } from '../utils/guestToken';

import { SecureStorage } from './SecureStorage';
import WebSocketMonitor from './WebSocketMonitor';

// WebSocket server configuration
const WEBSOCKET_URL = ENV.WEBSOCKET_URL;
const RECONNECTION_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]; // Exponential backoff
const HEARTBEAT_INTERVAL = 25000; // 25 seconds (match server pingInterval)
const SESSION_CREATED_TIMEOUT = 10000; // 10 seconds to wait for session_created (Cloud Run cold start)
const PONG_TIMEOUT = 60000; // 60 seconds to wait for pong response
const MAX_QUEUE_SIZE = 100; // Maximum queued messages

export enum ConnectionState {
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
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

export interface MessageEnvelope {
  type: string;
  sessionId?: string;
  data?: unknown;
  timestamp: number;
}

type EventHandler = (data: unknown) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;

/**
 * Native WebSocket Client implementation
 */
export class NativeWebSocketClient {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private stateHandlers: Set<ConnectionStateHandler> = new Set();
  private lastPingTime: number = 0;
  private latency: number = 0;
  private authToken: string | null = null;
  private connectionStartTime: number = 0;
  private connectionId: number = 0;
  private sessionCreatedTimer: NodeJS.Timeout | null = null;
  private manualDisconnect = false;

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
    if (this.ws && this.connectionState === ConnectionState.CONNECTED) {
      WebSocketMonitor.info('connection', 'Already connected');
      return;
    }

    try {
      this.manualDisconnect = false;
      this.setConnectionState(ConnectionState.CONNECTING);
      WebSocketMonitor.info('connection', `Connecting to ${WEBSOCKET_URL}...`, {
        url: WEBSOCKET_URL,
      });

      // Use stored auth token or try to get from SecureStorage
      let accessToken: string | null = this.authToken;

      if (!accessToken) {
        try {
          accessToken = await SecureStorage.getAccessToken();
        } catch {
          WebSocketMonitor.warn('connection', 'Could not get access token from storage');
        }
      }

      // If still no token, use guest token as fallback
      if (!accessToken) {
        accessToken = 'mock-guest-token';
        WebSocketMonitor.info('connection', 'Using guest token');
      } else {
        WebSocketMonitor.debug('connection', 'Token available', {
          type: accessToken.startsWith('eyJ') ? 'JWT' : 'Guest',
        });
      }

      // Initialize connection tracking
      this.connectionId++;
      this.connectionStartTime = Date.now();

      // Clean up old connection if exists
      if (this.ws) {
        try {
          this.ws.close();
        } catch {
          // Ignore errors during cleanup
        }
        this.ws = null;
      }

      // Create WebSocket connection with auth token in URL
      const wsUrl = new URL(WEBSOCKET_URL);
      wsUrl.searchParams.set('token', accessToken);

      WebSocketMonitor.info('connection', 'Creating WebSocket connection', {
        url: wsUrl.toString(),
      });

      this.ws = new WebSocket(wsUrl.toString());

      // Set up event listeners
      this.setupEventListeners();

      // Start heartbeat
      this.startHeartbeat();

      // Start session creation timeout
      this.startSessionCreatedTimeout();

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket not initialized'));

        const onOpen = () => {
          cleanup();
          resolve();
        };

        const onError = (event: Event) => {
          cleanup();
          const error = new Error(`WebSocket error: ${event.type}`);
          reject(error);
        };

        const cleanup = () => {
          if (this.ws) {
            this.ws.removeEventListener('open', onOpen);
            this.ws.removeEventListener('error', onError);
          }
        };

        this.ws.addEventListener('open', onOpen);
        this.ws.addEventListener('error', onError);

        // Set a timeout for the connection attempt
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('WebSocket connection timeout'));
        }, 30000);

        // Clear timeout if connection succeeds
        const originalResolve = resolve;
        resolve = () => {
          clearTimeout(timeoutId);
          originalResolve();
        };
      });

      WebSocketMonitor.info('connection', 'WebSocket connection established successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      WebSocketMonitor.error('connection', `Connection setup error: ${msg}`, error);

      // Force cleanup on error
      this.disconnect();

      this.setConnectionState(ConnectionState.ERROR);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    WebSocketMonitor.info('lifecycle', 'Disconnecting...');

    this.manualDisconnect = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.clearSessionCreatedTimeout();
    this.clearPongTimer();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore errors during close
      }
      this.ws = null;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.reconnectAttempts = 0;
    this.messageQueue = [];
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      WebSocketMonitor.debug('message', `Sending message: ${message.type}`, {
        type: message.type,
        readyState: this.ws.readyState,
      });

      const envelope: MessageEnvelope = {
        type: message.type,
        sessionId: message.sessionId,
        data: message.data,
        timestamp: Date.now(),
      };

      try {
        this.ws.send(JSON.stringify(envelope));
      } catch (error) {
        WebSocketMonitor.error('message', `Failed to send message: ${message.type}`, error);
        this.queueMessage(message);
      }
    } else {
      // Queue message for later if disconnected
      WebSocketMonitor.info('message', `Queueing message: ${message.type}`, {
        type: message.type,
      });
      this.queueMessage(message);
    }
  }

  /**
   * Queue a message for later delivery
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      // Discard oldest message
      this.messageQueue.shift();
      WebSocketMonitor.warn('message', 'Message queue full, discarding oldest message');
    }
    this.messageQueue.push(message);
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
   * Handle authentication error from server
   */
  private async handleAuthError(error: unknown): Promise<void> {
    // Extract error details
    const errorData =
      error && typeof error === 'object'
        ? (error as { code?: string; message?: string; timestamp?: number })
        : {};

    const errorCode = errorData.code || 'UNKNOWN';
    const errorMessage = errorData.message || String(error);
    const tokenType = this.authToken ? (isGuestToken(this.authToken) ? 'Guest' : 'JWT') : 'None';

    // Log error with full context
    WebSocketMonitor.error('connection', `Auth failed: ${errorMessage}`, {
      code: errorCode,
      message: errorMessage,
      tokenType,
      timestamp: errorData.timestamp || Date.now(),
    });

    // Clear the session_created timeout
    this.clearSessionCreatedTimeout();

    // Emit auth_error event to listeners
    this.emit('auth_error', error);

    // Handle different error codes
    if (errorCode === 'AUTH_EXPIRED') {
      // Attempt token refresh before reconnecting
      WebSocketMonitor.info('connection', 'Token expired, attempting refresh...');

      try {
        const refreshToken = await SecureStorage.getRefreshToken();

        if (refreshToken) {
          // TODO: Implement token refresh API call
          // For now, we'll fall back to guest token
          WebSocketMonitor.warn('connection', 'Token refresh not implemented, using guest token');
          await this.useGuestToken();
        } else {
          WebSocketMonitor.warn('connection', 'No refresh token available, using guest token');
          await this.useGuestToken();
        }
      } catch (err) {
        WebSocketMonitor.error('connection', 'Token refresh failed, using guest token', err);
        await this.useGuestToken();
      }
    } else if (errorCode === 'AUTH_REQUIRED' || errorCode === 'AUTH_INVALID') {
      // Fall back to guest token
      WebSocketMonitor.info('connection', `${errorCode}, falling back to guest token`);
      await this.useGuestToken();
    } else {
      // Unknown error, use guest token as fallback
      WebSocketMonitor.warn('connection', `Unknown auth error: ${errorCode}, using guest token`);
      await this.useGuestToken();
    }

    // Transition to ERROR state
    this.setConnectionState(ConnectionState.ERROR);

    // Disconnect and schedule reconnection
    this.disconnect();
    this.scheduleReconnect();
  }

  /**
   * Use guest token for authentication
   */
  private async useGuestToken(): Promise<void> {
    try {
      const guestToken = generateGuestToken();
      await SecureStorage.setAccessToken(guestToken);
      this.authToken = guestToken;

      WebSocketMonitor.info('connection', 'Generated and stored guest token', {
        tokenType: 'Guest',
      });
    } catch (err) {
      WebSocketMonitor.error('connection', 'Failed to generate guest token', err);
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.ws) return;

    // Connection opened
    this.ws.onopen = () => {
      const ms = Date.now() - this.connectionStartTime;
      WebSocketMonitor.info(
        'connection',
        `WebSocket opened (${ms}ms), waiting for authentication`,
        {
          duration: ms,
        }
      );
      this.setConnectionState(ConnectionState.AUTHENTICATING);
    };

    // Connection closed
    this.ws.onclose = (event: WebSocketCloseEvent) => {
      const reason = event.reason || 'Unknown';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wasClean = (event as any).wasClean;
      const msSinceStart = Date.now() - this.connectionStartTime;

      WebSocketMonitor.warn('connection', `WebSocket closed: ${reason}`, {
        code: event.code,
        reason,
        wasClean,
        msSinceStart,
        manualDisconnect: this.manualDisconnect,
        connectionId: this.connectionId,
      });

      this.clearPongTimer();
      this.setConnectionState(ConnectionState.DISCONNECTED);

      // Schedule reconnection if not manually disconnected
      if (!this.manualDisconnect) {
        this.scheduleReconnect();
      }
    };

    // Connection error
    this.ws.onerror = (event: Event) => {
      WebSocketMonitor.error('connection', `WebSocket error: ${event.type}`);
      this.setConnectionState(ConnectionState.ERROR);

      if (!this.manualDisconnect) {
        this.scheduleReconnect();
      }
    };

    // Message received
    this.ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        const envelope = JSON.parse(event.data) as MessageEnvelope;

        // Handle ping/pong
        if (envelope.type === 'ping') {
          this.handlePing(envelope);
          return;
        }

        if (envelope.type === 'pong') {
          this.handlePong(envelope);
          return;
        }

        // Handle session_created
        if (envelope.type === 'session_created') {
          this.handleSessionCreated(envelope);
          return;
        }

        // Handle auth_error
        if (envelope.type === 'auth_error') {
          this.handleAuthError(envelope.data);
          return;
        }

        // Route to event handlers
        this.emit(envelope.type, envelope.data);
      } catch (error) {
        WebSocketMonitor.error('message', `Failed to parse message: ${event.data}`, error);
      }
    };
  }

  /**
   * Handle ping from server
   */
  private handlePing(envelope: MessageEnvelope): void {
    WebSocketMonitor.debug('message', 'Received ping');

    // Send pong response
    const pongEnvelope: MessageEnvelope = {
      type: 'pong',
      sessionId: envelope.sessionId,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(pongEnvelope));
      } catch (error) {
        WebSocketMonitor.error('message', 'Failed to send pong', error);
      }
    }
  }

  /**
   * Handle pong from server
   */
  private handlePong(_envelope: MessageEnvelope): void {
    this.latency = Date.now() - this.lastPingTime;
    WebSocketMonitor.debug('message', `Received pong (latency: ${this.latency}ms)`);

    // Clear pong timeout
    this.clearPongTimer();
  }

  /**
   * Handle session_created event
   */
  private handleSessionCreated(envelope: MessageEnvelope): void {
    const ms = Date.now() - this.connectionStartTime;
    const sessionData = envelope.data as Record<string, unknown> | undefined;
    WebSocketMonitor.info(
      'lifecycle',
      `Session created: ${sessionData?.sessionId} (total ${ms}ms)`,
      {
        ...(sessionData || {}),
        totalDuration: ms,
      }
    );

    // Clear the session_created timeout
    this.clearSessionCreatedTimeout();

    this.setConnectionState(ConnectionState.CONNECTED);
    this.reconnectAttempts = 0;
    this.processMessageQueue();
    this.emit('session_created', envelope.data);
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
          WebSocketMonitor.error('error', `Error in event handler for ${event}`, error);
        }
      });
    }
  }

  /**
   * Set connection state and notify handlers
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      const previousState = this.connectionState;
      this.connectionState = state;

      // Log state transition with context
      WebSocketMonitor.info('lifecycle', `State transition: ${previousState} → ${state}`, {
        from: previousState,
        to: state,
        connectionId: this.connectionId,
      });

      this.stateHandlers.forEach((handler) => {
        try {
          handler(state);
        } catch (error) {
          WebSocketMonitor.error('error', 'Error in state handler', error);
        }
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.manualDisconnect) {
      return;
    }

    this.clearReconnectTimer();

    const delayIndex = Math.min(this.reconnectAttempts, RECONNECTION_DELAYS.length - 1);
    const delay = RECONNECTION_DELAYS[delayIndex];

    WebSocketMonitor.info(
      'connection',
      `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`
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
   * Start timeout for session_created event
   */
  private startSessionCreatedTimeout(): void {
    this.clearSessionCreatedTimeout();

    WebSocketMonitor.info(
      'connection',
      `Starting session_created timeout (${SESSION_CREATED_TIMEOUT}ms)`
    );

    this.sessionCreatedTimer = setTimeout(() => {
      WebSocketMonitor.error(
        'connection',
        `Timeout waiting for session_created after ${SESSION_CREATED_TIMEOUT}ms`
      );

      this.setConnectionState(ConnectionState.ERROR);
      this.disconnect();
      this.scheduleReconnect();
    }, SESSION_CREATED_TIMEOUT);
  }

  /**
   * Clear session_created timeout
   */
  private clearSessionCreatedTimeout(): void {
    if (this.sessionCreatedTimer) {
      clearTimeout(this.sessionCreatedTimer);
      this.sessionCreatedTimer = null;
    }
  }

  /**
   * Start heartbeat/ping-pong mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();

        const pingEnvelope: MessageEnvelope = {
          type: 'ping',
          timestamp: this.lastPingTime,
        };

        try {
          this.ws.send(JSON.stringify(pingEnvelope));

          // Set timeout for pong response
          this.startPongTimeout();
        } catch (error) {
          WebSocketMonitor.error('message', 'Failed to send ping', error);
        }
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
   * Start timeout for pong response
   */
  private startPongTimeout(): void {
    this.clearPongTimer();

    this.pongTimer = setTimeout(() => {
      WebSocketMonitor.error('connection', `Timeout waiting for pong after ${PONG_TIMEOUT}ms`);

      // Close connection and reconnect
      if (this.ws) {
        this.ws.close();
      }
    }, PONG_TIMEOUT);
  }

  /**
   * Clear pong timeout
   */
  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  /**
   * Process queued messages after reconnection
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    WebSocketMonitor.info('lifecycle', `Processing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach((message) => {
      this.send(message);
    });
  }
}

// Singleton instance
let instance: NativeWebSocketClient | null = null;

export const getWebSocketClient = (): NativeWebSocketClient => {
  if (!instance) {
    instance = new NativeWebSocketClient();
  }
  return instance;
};
