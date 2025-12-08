import { injectable, inject } from 'tsyringe';

import { AuthService, AuthErrorCode } from '../../application/services/AuthService';
import { ConnectionService } from '../../application/services/ConnectionService';
import { MessageRouterService } from '../../application/services/MessageRouterService';
import { ClientMessage } from '../../domain/models/Message';
import logger from '../../infrastructure/logging/logger';
import { WebSocketConnection } from '../../infrastructure/websocket/ConnectionManager';
import { MessageEnvelope } from '../../infrastructure/websocket/MessageProtocol';

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

@injectable()
export class WebSocketController {
  constructor(
    @inject(ConnectionService) private connectionService: ConnectionService,
    @inject(MessageRouterService) private messageRouter: MessageRouterService,
    @inject(AuthService) private authService: AuthService
  ) {}

  /**
   * Handles a new authenticated WebSocket connection
   * Called by NativeWebSocketServer after successful authentication
   *
   * @param connectionId - Unique connection identifier
   * @param connection - WebSocket connection info
   */
  handleConnection(connectionId: string, connection: WebSocketConnection): void {
    const { ws, sessionId, userId } = connection;

    if (!sessionId) {
      logger.error('[WebSocketController] Connection missing sessionId', { connectionId });
      return;
    }

    // Register connection with ConnectionService
    this.connectionService.registerConnection(sessionId, ws, connectionId);

    logger.info('[WebSocketController] Connection registered', {
      connectionId,
      sessionId,
      userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handles incoming messages from a connection
   * Called by NativeWebSocketServer when a message is received
   *
   * @param connectionId - Connection identifier
   * @param message - Parsed message envelope
   * @param sessionId - Session identifier
   */
  async handleMessage(
    connectionId: string,
    message: MessageEnvelope,
    sessionId: string
  ): Promise<void> {
    try {
      // Handle different message types
      switch (message.type) {
        case 'message':
          // Route client messages to the message router
          if (message.data) {
            await this.messageRouter.routeClientMessage(sessionId, message.data as ClientMessage);
          }
          break;

        case 'audio_chunk':
        case 'interruption':
        case 'end_utterance':
          // Route directly as client message
          await this.messageRouter.routeClientMessage(sessionId, {
            type: message.type,
            sessionId,
            timestamp: message.timestamp,
            ...((message.data as object) || {}),
          } as ClientMessage);
          break;

        case 'retry_asr':
          // Handle retry requests from mobile app
          this.sendToClient(sessionId, 'asr_retry_acknowledged', {
            sessionId,
            timestamp: Date.now(),
            message: 'Ready to receive audio. Please speak again.',
          });
          break;

        default:
          logger.debug('[WebSocketController] Unhandled message type', {
            connectionId,
            type: message.type,
          });
      }
    } catch (error) {
      logger.error('[WebSocketController] Message handling error', {
        connectionId,
        sessionId,
        type: message.type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Send error to client
      this.sendError(
        sessionId,
        error instanceof Error ? error : new Error('Message handling failed')
      );
    }
  }

  /**
   * Handles client disconnection
   * Called by NativeWebSocketServer when a connection closes
   *
   * @param connectionId - Connection identifier
   * @param code - Close code
   * @param reason - Close reason
   */
  handleDisconnection(connectionId: string, code: number, reason: string): void {
    logger.info('[WebSocketController] Handling disconnection', {
      connectionId,
      code,
      reason,
      timestamp: Date.now(),
      event: 'disconnect',
    });

    // Note: Connection cleanup is handled by NativeWebSocketServer
    // Session cleanup can be done here if needed
  }

  /**
   * Sends a message to a client
   */
  private sendToClient(sessionId: string, event: string, data: unknown): void {
    this.connectionService.emit(sessionId, event, data);
  }

  /**
   * Sends an error to a client
   */
  private sendError(sessionId: string, error: Error): void {
    const errorData = {
      type: 'error',
      errorCode: 'INTERNAL_ERROR',
      errorMessage: error.message,
      recoverable: true,
      timestamp: Date.now(),
    };

    this.connectionService.emit(sessionId, 'error', errorData);
  }

  /**
   * Determines the type of token for logging purposes
   */
  getTokenType(token: string | null | undefined): string {
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
}
