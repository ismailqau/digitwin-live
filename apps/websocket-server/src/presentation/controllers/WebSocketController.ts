import { Socket } from 'socket.io';
import { injectable, inject } from 'tsyringe';

import { AuthService } from '../../application/services/AuthService';
import { ConnectionService } from '../../application/services/ConnectionService';
import { MessageRouterService } from '../../application/services/MessageRouterService';
import { SessionService } from '../../application/services/SessionService';
import { ClientMessage } from '../../domain/models/Message';
import logger from '../../infrastructure/logging/logger';
import { WebSocketErrorHandler } from '../../utils/errorHandler';

@injectable()
export class WebSocketController {
  constructor(
    @inject(SessionService) private sessionService: SessionService,
    @inject(ConnectionService) private connectionService: ConnectionService,
    @inject(MessageRouterService) private messageRouter: MessageRouterService,
    @inject(AuthService) private authService: AuthService
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      // Extract and verify JWT token
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
      if (!token) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
      }

      const payload = this.authService.verifyToken(token);

      // Create session
      const session = await this.sessionService.createSession(payload.userId, socket.id);

      // Register connection
      this.connectionService.registerConnection(session.id, socket);

      // Send session info to client
      socket.emit('session_created', {
        sessionId: session.id,
        userId: session.userId,
      });

      logger.info(
        `[WebSocketController] Client connected: ${socket.id}, Session: ${session.id}, User: ${payload.userId}`,
        {
          socketId: socket.id,
          sessionId: session.id,
          userId: payload.userId,
        }
      );

      // Set up message handlers
      this.setupMessageHandlers(socket, session.id);

      // Handle disconnection
      socket.on('disconnect', () => this.handleDisconnection(session.id, socket.id));
    } catch (error) {
      logger.error(`[WebSocketController] Connection error: ${error}`, { error });
      WebSocketErrorHandler.sendError(
        socket,
        error instanceof Error ? error : new Error('Authentication failed')
      );
      socket.disconnect();
    }
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

  private async handleDisconnection(sessionId: string, socketId: string): Promise<void> {
    logger.info(`[WebSocketController] Client disconnected: ${socketId}, Session: ${sessionId}`, {
      socketId,
      sessionId,
    });

    this.connectionService.unregisterConnection(sessionId);

    // Optionally end session or keep it for reconnection
    // await this.sessionService.endSession(sessionId);
  }
}
