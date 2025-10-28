import { injectable, inject } from 'tsyringe';
import { ClientMessage, ServerMessage, ErrorMessage } from '../../domain/models/Message';
import { ConnectionService } from './ConnectionService';
import { SessionService } from './SessionService';
import { ConversationState } from '@clone/shared-types';

@injectable()
export class MessageRouterService {
  constructor(
    @inject(ConnectionService) private connectionService: ConnectionService,
    @inject(SessionService) private sessionService: SessionService
  ) {}

  async routeClientMessage(sessionId: string, message: ClientMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'audio_chunk':
          await this.handleAudioChunk(sessionId, message);
          break;
        case 'interruption':
          await this.handleInterruption(sessionId, message);
          break;
        case 'end_utterance':
          await this.handleEndUtterance(sessionId, message);
          break;
        default:
          throw new Error(`Unknown message type: ${(message as any).type}`);
      }
    } catch (error) {
      await this.sendError(sessionId, error as Error);
    }
  }

  private async handleAudioChunk(sessionId: string, _message: ClientMessage): Promise<void> {
    // Update session state to listening if idle
    const session = await this.sessionService.getSession(sessionId);
    if (session?.state === ConversationState.IDLE) {
      await this.sessionService.updateSessionState(sessionId, ConversationState.LISTENING);
    }

    // TODO: Forward to ASR service
    console.log(`Received audio chunk for session ${sessionId}`);
  }

  private async handleInterruption(sessionId: string, _message: ClientMessage): Promise<void> {
    await this.sessionService.updateSessionState(sessionId, ConversationState.INTERRUPTED);
    
    // TODO: Cancel ongoing response generation
    console.log(`Interruption received for session ${sessionId}`);
  }

  private async handleEndUtterance(sessionId: string, _message: ClientMessage): Promise<void> {
    await this.sessionService.updateSessionState(sessionId, ConversationState.PROCESSING);
    
    // TODO: Signal ASR service to finalize transcript
    console.log(`End utterance for session ${sessionId}`);
  }

  sendToClient(sessionId: string, message: ServerMessage): void {
    const sent = this.connectionService.sendToClient(sessionId, message);
    if (!sent) {
      console.error(`Failed to send message to session ${sessionId}: connection not found`);
    }
  }

  private async sendError(sessionId: string, error: Error): Promise<void> {
    const errorMessage: ErrorMessage = {
      type: 'error',
      sessionId,
      timestamp: Date.now(),
      errorCode: 'INTERNAL_ERROR',
      errorMessage: error.message,
      recoverable: true
    };

    this.sendToClient(sessionId, errorMessage);
  }
}
