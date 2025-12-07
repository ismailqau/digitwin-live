import { Socket } from 'socket.io';
import { injectable, inject } from 'tsyringe';

import {
  AuthService,
  AuthError,
  AuthErrorCode,
  AUTH_ERROR_MESSAGES,
} from '../../application/services/AuthService';
import { ConnectionService } from '../../application/services/ConnectionService';
import { MessageRouterService } from '../../application/services/MessageRouterService';
import { SessionService } from '../../application/services/SessionService';
import { ClientMessage } from '../../domain/models/Message';
import logger from '../../infrastructure/logging/logger';
import { WebSocketErrorHandler } from '../../utils/errorHandler';

/**
 * Auth error payload sent to client
 */
export interface AuthErrorPayload {
  code: AuthErrorCode;
  message: string;
  timestamp: number;
}

/**
 * Session created payload sent to client
 */
export interface SessionCreatedPayload {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  timestamp: number;
}

/**
 * Session creation timeout in milliseconds
 */
const SESSION_CREATE_TIMEOUT_MS = 2000;

@injectable()
export class WebSocketController {
  constructor(
    @inject(SessionService) private sessionService: SessionService,
    @inject(ConnectionService) private connectionService: ConnectionService,
    @inject(MessageRouterService) private messageRouter: MessageRouterService,
    @inject(AuthService) private authService: AuthService
  ) {}

  /**
   * Handles a new WebSocket connection
   *
   * Always emits either `session_created` or `auth_error` before disconnecting.
   * This ensures the client always receives feedback about the connection attempt.
   */
  async handleConnection(socket: Socket): Promise<void> {
    const connectionStartTime = Date.now();
    const socketId = socket.id;

    // Log connection attempt
    logger.info('[WebSocketController] Connection attempt', {
      socketId,
      timestamp: connectionStartTime,
      hasToken: !!socket.handshake.auth.token,
      hasAuthHeader: !!socket.handshake.headers.authorization,
    });

    try {
      // Extract token from handshake
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
      const tokenType = this.getTokenType(token);

      // Log token type
      logger.debug('[WebSocketController] Token extracted', {
        socketId,
        tokenType,
        hasToken: !!token,
      });

      // Verify token (throws AuthError on failure)
      const payload = this.authService.verifyToken(token);

      // Create session with timeout
      const session = await this.createSessionWithTimeout(payload.userId, socketId);

      // Register connection
      this.connectionService.registerConnection(session.id, socket);

      // Emit session_created event with isGuest flag
      const sessionCreatedPayload: SessionCreatedPayload = {
        sessionId: session.id,
        userId: session.userId,
        isGuest: payload.isGuest,
        timestamp: Date.now(),
      };

      socket.emit('session_created', sessionCreatedPayload);

      // Log successful connection
      const connectionDuration = Date.now() - connectionStartTime;
      logger.info('[WebSocketController] Client connected successfully', {
        socketId,
        sessionId: session.id,
        userId: payload.userId,
        isGuest: payload.isGuest,
        tokenType,
        connectionDurationMs: connectionDuration,
        timestamp: Date.now(),
      });

      // Set up message handlers
      this.setupMessageHandlers(socket, session.id);

      // Handle disconnection
      socket.on('disconnect', (reason) =>
        this.handleDisconnection(session.id, socketId, connectionStartTime, reason)
      );
    } catch (error) {
      // Always emit auth_error before disconnecting
      this.handleConnectionError(socket, error, connectionStartTime);
    }
  }

  /**
   * Creates a session with a timeout to prevent hanging
   */
  private async createSessionWithTimeout(
    userId: string,
    socketId: string
  ): Promise<{ id: string; userId: string }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Session creation timeout'));
      }, SESSION_CREATE_TIMEOUT_MS);

      this.sessionService
        .createSession(userId, socketId)
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
   * Handles connection errors by emitting auth_error and disconnecting
   */
  private handleConnectionError(socket: Socket, error: unknown, connectionStartTime: number): void {
    const socketId = socket.id;
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    const tokenType = this.getTokenType(token);

    // Determine error code and message
    let errorCode: AuthErrorCode;
    let errorMessage: string;

    if (error instanceof AuthError) {
      errorCode = error.code;
      errorMessage = error.message;
    } else if (error instanceof Error && error.message === 'Session creation timeout') {
      // Session creation timeout - treat as internal error but report as auth error
      errorCode = AuthErrorCode.AUTH_INVALID;
      errorMessage = 'Session creation failed';
    } else {
      errorCode = AuthErrorCode.AUTH_INVALID;
      errorMessage = AUTH_ERROR_MESSAGES[AuthErrorCode.AUTH_INVALID];
    }

    // Create auth error payload
    const authErrorPayload: AuthErrorPayload = {
      code: errorCode,
      message: errorMessage,
      timestamp: Date.now(),
    };

    // Log authentication failure
    logger.warn('[WebSocketController] Authentication failed', {
      socketId,
      errorCode,
      errorMessage,
      tokenType,
      connectionDurationMs: Date.now() - connectionStartTime,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Emit auth_error event before disconnecting
    socket.emit('auth_error', authErrorPayload);

    // Also emit legacy error event for backward compatibility
    WebSocketErrorHandler.sendError(
      socket,
      error instanceof Error ? error : new Error(errorMessage)
    );

    // Disconnect the socket
    socket.disconnect();
  }

  /**
   * Determines the type of token for logging purposes
   */
  private getTokenType(token: string | null | undefined): string {
    if (!token) {
      return 'none';
    }
    if (this.authService.isGuestToken(token)) {
      return 'guest';
    }
    if (token.startsWith('mock-')) {
      return 'mock';
    }
    return 'jwt';
  }

  private setupMessageHandlers(socket: Socket, sessionId: string): void {
    socket.on('message', async (message: ClientMessage) => {
      await WebSocketErrorHandler.wrapHandler(socket, sessionId, async () => {
        await this.messageRouter.routeClientMessage(sessionId, message);
      });
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle retry requests from mobile app
    socket.on('retry_asr', async () => {
      socket.emit('asr_retry_acknowledged', {
        sessionId,
        timestamp: Date.now(),
        message: 'Ready to receive audio. Please speak again.',
      });
    });
  }

  private async handleDisconnection(
    sessionId: string,
    socketId: string,
    connectionStartTime: number,
    reason: string
  ): Promise<void> {
    const connectionDuration = Date.now() - connectionStartTime;

    logger.info('[WebSocketController] Client disconnected', {
      socketId,
      sessionId,
      reason,
      connectionDurationMs: connectionDuration,
      timestamp: Date.now(),
    });

    this.connectionService.unregisterConnection(sessionId);

    // Optionally end session or keep it for reconnection
    // await this.sessionService.endSession(sessionId);
  }
}
