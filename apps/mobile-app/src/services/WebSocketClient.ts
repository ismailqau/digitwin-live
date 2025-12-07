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

import ENV from '../config/env';

import { SecureStorage } from './SecureStorage';
import WebSocketMonitor from './WebSocketMonitor';

// WebSocket server configuration
const WEBSOCKET_URL = ENV.WEBSOCKET_URL;
const RECONNECTION_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]; // Exponential backoff
const HEARTBEAT_INTERVAL = 25000; // 25 seconds (match server pingInterval)
const SESSION_CREATED_TIMEOUT = 10000; // 10 seconds to wait for session_created (Cloud Run cold start)
const CONNECT_TIMEOUT = 30000; // 30 seconds for Socket.IO connection (Cloud Run cold start)

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
  private connectionStartTime: number = 0;
  private connectionId: number = 0;
  private sessionCreatedTimer: NodeJS.Timeout | null = null;

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
      WebSocketMonitor.info('connection', 'Already connected');
      return;
    }

    try {
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

      // Quick health check (non-blocking) - just for monitoring
      this.checkHealth().catch(() => {});

      // Always ensure we start with a clean state if not connected
      if (this.socket && this.socket.disconnected) {
        WebSocketMonitor.info('connection', 'Cleaning up disconnected socket before reconnecting');
        this.socket.removeAllListeners();
        this.socket.close();
        this.socket = null;
      }

      // Create socket connection with auth
      if (!this.socket) {
        WebSocketMonitor.info('connection', 'Initializing new socket instance');

        this.socket = io(WEBSOCKET_URL, {
          auth: accessToken ? { token: accessToken } : {},
          transports: ['polling', 'websocket'], // Polling first for Cloud Run compatibility
          reconnection: false, // We handle reconnection manually
          timeout: CONNECT_TIMEOUT, // Increased for Cloud Run cold start
          upgrade: true, // Allow upgrade to websocket after polling connects
          forceNew: true, // Ensure a new Manager provider
        });

        this.setupEventListeners();
      } else {
        WebSocketMonitor.info('connection', 'Reusing active socket instance');
      }

      WebSocketMonitor.info('connection', 'Connecting socket...');
      this.startHeartbeat();

      // Monitor socket internal events for debugging
      if (this.socket.io) {
        this.socket.io.on('packet', (packet) => {
          WebSocketMonitor.debug('connection', `Packet received: ${packet.type}`);
        });
        this.socket.io.on('close', (reason) => {
          WebSocketMonitor.info('connection', `Transport closed: ${reason}`);
        });
        this.socket.io.on('error', (err) => {
          WebSocketMonitor.error('connection', `Transport error: ${err}`);
        });
        this.socket.io.on('reconnect_attempt', (attempt) => {
          WebSocketMonitor.info('connection', `Reconnect attempt: ${attempt}`);
        });
      }

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) return reject(new Error('Socket not initialized'));

        const onConnect = () => {
          cleanup();
          resolve();
        };

        const onConnectError = (err: Error) => {
          cleanup();
          reject(err);
        };

        const cleanup = () => {
          this.socket?.off('connect', onConnect);
          this.socket?.off('connect_error', onConnectError);
        };

        this.socket.once('connect', onConnect);
        this.socket.once('connect_error', onConnectError);
      });

      WebSocketMonitor.info('connection', 'Connection established successfully');

      // Verify bidirectional communication
      this.socket.emit('client_ready', { timestamp: Date.now() });
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

    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.clearSessionCreatedTimeout();

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
      WebSocketMonitor.debug('message', `Sending message: ${message.type}`, {
        type: message.type,
      });
      this.socket.emit(message.type, message.data);
    } else {
      // Queue message for later if disconnected
      WebSocketMonitor.info('message', `Queueing message: ${message.type}`, {
        type: message.type,
      });
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
    if (!this.socket) return;

    // Connection established - transition to AUTHENTICATING state
    this.socket.on('connect', () => {
      const ms = Date.now() - this.connectionStartTime;
      WebSocketMonitor.info(
        'connection',
        `Socket.IO connected (${ms}ms), waiting for authentication`,
        {
          socketId: this.socket?.id,
          duration: ms,
        }
      );
      this.setConnectionState(ConnectionState.AUTHENTICATING);

      // Start timeout for session_created event (accounts for Cloud Run cold start)
      this.startSessionCreatedTimeout();
    });

    // Connection lost
    this.socket.on('disconnect', (reason) => {
      WebSocketMonitor.warn('connection', `Disconnected: ${reason}`);
      this.setConnectionState(ConnectionState.DISCONNECTED);
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      // If we are already connected, this might be a spurious timeout from an old attempt
      if (this.connectionState === ConnectionState.CONNECTED) {
        WebSocketMonitor.warn('connection', 'Ignored connect_error while connected', error);
        return;
      }
      const msg = error instanceof Error ? error.message : String(error);
      WebSocketMonitor.error('connection', `Connection error: ${msg}`, error);
      this.setConnectionState(ConnectionState.ERROR);
      this.scheduleReconnect();
    });

    // Session created - transition to CONNECTED state
    this.socket.on('session_created', (data) => {
      const ms = Date.now() - this.connectionStartTime;
      WebSocketMonitor.info('lifecycle', `Session created: ${data?.sessionId} (total ${ms}ms)`, {
        ...data,
        totalDuration: ms,
      });

      // Clear the session_created timeout
      this.clearSessionCreatedTimeout();

      this.setConnectionState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.processMessageQueue();
      this.emit('session_created', data);
    });

    // Auth events
    this.socket.on('authenticated', (data) => {
      WebSocketMonitor.info('connection', 'Authenticated');
      this.emit('authenticated', data);
    });

    this.socket.on('auth_error', (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      WebSocketMonitor.error('connection', `Auth failed: ${msg}`, error);

      // Clear the session_created timeout
      this.clearSessionCreatedTimeout();

      this.emit('auth_error', error);
      this.setConnectionState(ConnectionState.ERROR);
      this.disconnect();
      this.scheduleReconnect();
    });

    // Latency
    this.socket.on('pong', () => {
      this.latency = Date.now() - this.lastPingTime;
    });

    // Errors
    this.socket.on('error', (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      WebSocketMonitor.error('error', `Socket error: ${msg}`, error);
      this.emit('error', error);
    });

    // Forward events
    this.socket.onAny((event, ...args) => {
      this.emit(event, args[0]);
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
        socketId: this.socket?.id,
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
    WebSocketMonitor.info('lifecycle', `Processing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach((message) => {
      this.send(message);
    });
  }

  /**
   * Perform a non-blocking health check
   */
  private async checkHealth(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(`${WEBSOCKET_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      WebSocketMonitor.debug('connection', `Health check: ${resp.status}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      WebSocketMonitor.warn('connection', `Health check failed: ${msg}`);
    }
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
