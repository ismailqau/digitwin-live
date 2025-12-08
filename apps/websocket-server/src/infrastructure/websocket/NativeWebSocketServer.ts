/**
 * Native WebSocket Server using the 'ws' library
 *
 * Implements Requirements:
 * - 1.1: Native WebSocket server using ws library
 * - 2.1: JWT authentication in initial handshake
 * - 2.2: Session creation and session_created event
 * - 3.1: Message envelope with type, sessionId, data, timestamp
 * - 3.2: JSON parsing and routing to event handlers
 * - 3.4: Heartbeat ping every 25 seconds
 * - 3.5: Connection timeout after 60 seconds without pong
 */

import { IncomingMessage } from 'http';
import { Server as HTTPServer } from 'http';

import { v4 as uuidv4 } from 'uuid';
import WebSocket, { WebSocketServer } from 'ws';

import { AuthService } from '../../application/services/AuthService';
import { MetricsService } from '../../application/services/MetricsService';
import { SessionService } from '../../application/services/SessionService';
import logger from '../logging/logger';

import { AuthenticationHandler } from './AuthenticationHandler';
import { ConnectionManager, WebSocketConnection } from './ConnectionManager';
import { MessageProtocol, MessageEnvelope } from './MessageProtocol';

/**
 * Heartbeat interval in milliseconds (25 seconds per Requirement 3.4)
 */
const HEARTBEAT_INTERVAL_MS = 25000;

/**
 * Connection timeout in milliseconds (60 seconds per Requirement 3.5)
 */
const CONNECTION_TIMEOUT_MS = 60000;

/**
 * Session creation timeout in milliseconds
 */
const SESSION_CREATE_TIMEOUT_MS = 2000;

/**
 * Event handler type
 */
export type MessageHandler = (
  connectionId: string,
  message: MessageEnvelope
) => void | Promise<void>;

/**
 * Connection event handler type
 */
export type ConnectionHandler = (connectionId: string, connection: WebSocketConnection) => void;

/**
 * Disconnection event handler type
 */
export type DisconnectionHandler = (connectionId: string, code: number, reason: string) => void;

/**
 * Native WebSocket Server implementation
 */
export class NativeWebSocketServer {
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;
  private authHandler: AuthenticationHandler;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<DisconnectionHandler> = new Set();

  constructor(
    httpServer: HTTPServer,
    authService: AuthService,
    private sessionService: SessionService,
    private metricsService: MetricsService
  ) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/socket.io/', // Keep same path for compatibility
    });

    this.connectionManager = new ConnectionManager();
    this.authHandler = new AuthenticationHandler(authService);
  }

  /**
   * Starts the WebSocket server
   */
  start(): void {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request).catch((error) => {
        logger.error('[NativeWebSocketServer] Connection handler error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
    });

    this.wss.on('error', (error) => {
      logger.error('[NativeWebSocketServer] Server error', {
        error: error.message,
        stack: error.stack,
      });
    });

    this.startHeartbeat();

    logger.info('[NativeWebSocketServer] WebSocket server started');
  }

  /**
   * Handles a new WebSocket connection
   */
  async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const connectionId = uuidv4();
    const connectionStartTime = Date.now();

    // Record connection attempt
    this.metricsService.recordConnectionAttempt(connectionId);

    // Extract token from request
    const token = this.authHandler.extractTokenFromRequest(request);

    logger.info('[NativeWebSocketServer] New connection attempt', {
      connectionId,
      hasToken: !!token,
      clientIp: request.socket.remoteAddress,
      timestamp: connectionStartTime,
      event: 'connection',
    });

    try {
      // Authenticate the connection
      const payload = await this.authHandler.authenticateConnection(token, connectionId);

      logger.debug('[NativeWebSocketServer] Token verified', {
        connectionId,
        userId: payload.userId,
        isGuest: payload.isGuest,
      });

      // Create session with timeout
      const session = await this.createSessionWithTimeout(payload.userId, connectionId);

      // Create and register connection
      const connection: WebSocketConnection = {
        id: connectionId,
        ws,
        userId: payload.userId,
        sessionId: session.id,
        isAuthenticated: true,
        lastPing: Date.now(),
        createdAt: connectionStartTime,
      };

      this.connectionManager.registerConnection(connectionId, connection);

      // Send session_created event
      this.authHandler.sendSessionCreated(ws, session.id, payload.userId, payload.isGuest);

      // Record successful connection
      this.metricsService.recordConnectionSuccess(connectionId);
      this.metricsService.setActiveConnections(this.connectionManager.getActiveConnectionCount());

      logger.info('[NativeWebSocketServer] Session created', {
        connectionId,
        sessionId: session.id,
        userId: payload.userId,
        isGuest: payload.isGuest,
        connectionDurationMs: Date.now() - connectionStartTime,
        timestamp: Date.now(),
        event: 'session_created',
      });

      // Notify connection handlers
      for (const handler of this.connectionHandlers) {
        try {
          handler(connectionId, connection);
        } catch (error) {
          logger.error('[NativeWebSocketServer] Connection handler error', {
            connectionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Set up message handling
      this.setupMessageHandling(ws, connectionId, session.id);

      // Handle close
      ws.on('close', (code, reason) => {
        this.handleClose(connectionId, code, reason.toString(), connectionStartTime);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('[NativeWebSocketServer] WebSocket error', {
          connectionId,
          error: error.message,
          stack: error.stack,
          event: 'connection_error',
        });
      });
    } catch (error) {
      // Handle authentication failure
      this.handleAuthenticationFailure(ws, connectionId, error, connectionStartTime);
    }
  }

  /**
   * Creates a session with timeout
   */
  private async createSessionWithTimeout(
    userId: string,
    connectionId: string
  ): Promise<{ id: string; userId: string }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Session creation timeout'));
      }, SESSION_CREATE_TIMEOUT_MS);

      this.sessionService
        .createSession(userId, connectionId)
        .then((session) => {
          clearTimeout(timeoutId);
          resolve(session);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handles authentication failure
   */
  private handleAuthenticationFailure(
    ws: WebSocket,
    connectionId: string,
    error: unknown,
    connectionStartTime: number
  ): void {
    const { code, message } = this.authHandler.mapAuthError(error);

    // Record failure
    this.metricsService.recordConnectionFailure(
      connectionId,
      code as 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'AUTH_EXPIRED' | 'SESSION_CREATE_FAILED'
    );

    logger.warn('[NativeWebSocketServer] Authentication failed', {
      connectionId,
      errorCode: code,
      errorMessage: message,
      connectionDurationMs: Date.now() - connectionStartTime,
      timestamp: Date.now(),
      event: 'auth_error',
    });

    // Send auth error and close
    this.authHandler.sendAuthError(ws, code, message);
    ws.close(4001, message);
  }

  /**
   * Sets up message handling for a connection
   */
  private setupMessageHandling(ws: WebSocket, connectionId: string, sessionId: string): void {
    ws.on('message', async (data) => {
      try {
        const messageStr = data.toString();
        const result = MessageProtocol.deserialize(messageStr);

        if (!result.success || !result.message) {
          logger.warn('[NativeWebSocketServer] Invalid message received', {
            connectionId,
            error: result.error,
            event: 'message_error',
          });

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

        // Handle ping/pong
        if (message.type === 'ping') {
          const pongEnvelope = MessageProtocol.createEnvelope(
            'pong',
            { timestamp: Date.now() },
            sessionId
          );
          ws.send(MessageProtocol.serialize(pongEnvelope));

          // Update last ping time
          this.connectionManager.updateConnection(connectionId, { lastPing: Date.now() });
          return;
        }

        // Route to message handlers
        await this.handleMessage(connectionId, message);
      } catch (error) {
        logger.error('[NativeWebSocketServer] Message handling error', {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          event: 'message_error',
        });
      }
    });
  }

  /**
   * Handles an incoming message
   */
  async handleMessage(connectionId: string, message: MessageEnvelope): Promise<void> {
    const handlers = this.messageHandlers.get(message.type);

    if (!handlers || handlers.size === 0) {
      logger.debug('[NativeWebSocketServer] No handlers for message type', {
        connectionId,
        type: message.type,
      });
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(connectionId, message);
      } catch (error) {
        logger.error('[NativeWebSocketServer] Message handler error', {
          connectionId,
          type: message.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Handles connection close
   */
  handleClose(
    connectionId: string,
    code: number,
    reason: string,
    connectionStartTime: number
  ): void {
    const connection = this.connectionManager.getConnection(connectionId);

    logger.info('[NativeWebSocketServer] Connection closed', {
      connectionId,
      sessionId: connection?.sessionId,
      code,
      reason,
      connectionDurationMs: Date.now() - connectionStartTime,
      timestamp: Date.now(),
      event: 'disconnect',
    });

    // Record disconnection
    this.metricsService.recordDisconnection(connectionId);

    // Unregister connection
    this.connectionManager.unregisterConnection(connectionId);
    this.metricsService.setActiveConnections(this.connectionManager.getActiveConnectionCount());

    // Notify disconnection handlers
    for (const handler of this.disconnectionHandlers) {
      try {
        handler(connectionId, code, reason);
      } catch (error) {
        logger.error('[NativeWebSocketServer] Disconnection handler error', {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Sends a message to a specific connection
   */
  sendMessage(connectionId: string, message: MessageEnvelope): boolean {
    const connection = this.connectionManager.getConnection(connectionId);

    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(MessageProtocol.serialize(message));
      return true;
    } catch (error) {
      logger.error('[NativeWebSocketServer] Failed to send message', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Broadcasts a message to all connections in a session
   */
  broadcast(sessionId: string, message: MessageEnvelope): void {
    const connections = this.connectionManager.getConnectionsBySession(sessionId);

    for (const connection of connections) {
      this.sendMessage(connection.id, message);
    }
  }

  /**
   * Registers a message handler for a specific message type
   */
  onMessage(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }

    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  /**
   * Registers a connection handler
   */
  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Registers a disconnection handler
   */
  onDisconnection(handler: DisconnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => {
      this.disconnectionHandlers.delete(handler);
    };
  }

  /**
   * Starts the heartbeat mechanism
   */
  startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const connections = this.connectionManager.getAllConnections();

      for (const connection of connections) {
        // Check for timeout (no pong received within 60 seconds)
        if (now - connection.lastPing > CONNECTION_TIMEOUT_MS) {
          logger.warn('[NativeWebSocketServer] Connection timeout', {
            connectionId: connection.id,
            lastPing: connection.lastPing,
            timeout: CONNECTION_TIMEOUT_MS,
          });
          connection.ws.close(4002, 'Connection timeout');
          continue;
        }

        // Send ping
        if (connection.ws.readyState === WebSocket.OPEN) {
          try {
            const pingEnvelope = MessageProtocol.createEnvelope('ping', { timestamp: now });
            connection.ws.send(MessageProtocol.serialize(pingEnvelope));
          } catch (error) {
            logger.error('[NativeWebSocketServer] Failed to send ping', {
              connectionId: connection.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stops the heartbeat mechanism
   */
  stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Gets the connection manager
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Gets the active connection count
   */
  getActiveConnectionCount(): number {
    return this.connectionManager.getActiveConnectionCount();
  }

  /**
   * Closes the WebSocket server
   */
  async close(): Promise<void> {
    this.stopHeartbeat();

    // Close all connections
    const connections = this.connectionManager.getAllConnections();
    for (const connection of connections) {
      connection.ws.close(1001, 'Server shutting down');
    }

    // Close the server
    return new Promise((resolve, reject) => {
      this.wss.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
