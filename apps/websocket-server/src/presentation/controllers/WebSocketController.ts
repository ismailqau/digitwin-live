import { injectable, inject } from 'tsyringe';
import { Socket } from 'socket.io';
import { SessionService } from '../../application/services/SessionService';
import { ConnectionService } from '../../application/services/ConnectionService';
import { MessageRouterService } from '../../application/services/MessageRouterService';
import { AuthService } from '../../application/services/AuthService';
import { ClientMessage } from '../../domain/models/Message';

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
        userId: session.userId
      });

      console.log(`Client connected: ${socket.id}, Session: ${session.id}, User: ${payload.userId}`);

      // Set up message handlers
      this.setupMessageHandlers(socket, session.id);

      // Handle disconnection
      socket.on('disconnect', () => this.handleDisconnection(session.id, socket.id));

    } catch (error) {
      console.error('Connection error:', error);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  }

  private setupMessageHandlers(socket: Socket, sessionId: string): void {
    socket.on('message', async (message: ClientMessage) => {
      try {
        await this.messageRouter.routeClientMessage(sessionId, message);
      } catch (error) {
        console.error(`Error handling message for session ${sessionId}:`, error);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  }

  private async handleDisconnection(sessionId: string, socketId: string): Promise<void> {
    console.log(`Client disconnected: ${socketId}, Session: ${sessionId}`);
    
    this.connectionService.unregisterConnection(sessionId);
    
    // Optionally end session or keep it for reconnection
    // await this.sessionService.endSession(sessionId);
  }
}
