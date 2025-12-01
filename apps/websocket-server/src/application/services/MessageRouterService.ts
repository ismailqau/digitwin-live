import {
  ConversationState,
  ConversationInterruptedMessage,
  InterruptionMessage,
} from '@clone/shared-types';
import { injectable, inject } from 'tsyringe';

import { ClientMessage, ServerMessage, ErrorMessage } from '../../domain/models/Message';

import { ConnectionService } from './ConnectionService';
import { SessionService } from './SessionService';

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
          throw new Error(`Unknown message type: ${(message as { type?: string }).type}`);
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

  private async handleInterruption(sessionId: string, message: ClientMessage): Promise<void> {
    const interruptionMsg = message as InterruptionMessage;

    // Transition state: speaking → interrupted → listening
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update session state to interrupted
    await this.sessionService.updateSessionState(sessionId, ConversationState.INTERRUPTED);

    // Log interruption event in session metadata
    await this.sessionService.logInterruption(sessionId, {
      interrupted: true,
      interruptedAt: interruptionMsg.timestamp,
      turnIndex: interruptionMsg.turnIndex,
    });

    // TODO: Cancel ongoing LLM streaming request
    // TODO: Cancel ongoing TTS generation jobs
    // TODO: Cancel ongoing lip-sync generation jobs
    // TODO: Clear response buffers and queues

    console.log(
      `Interruption received for session ${sessionId}, turn ${interruptionMsg.turnIndex}`
    );

    // Acknowledge interruption with conversation:interrupted message
    const acknowledgeMessage: ConversationInterruptedMessage = {
      type: 'conversation:interrupted',
      sessionId,
      turnIndex: interruptionMsg.turnIndex || 0,
      timestamp: Date.now(),
    };
    this.sendToClient(sessionId, acknowledgeMessage);

    // Transition to listening state within 200ms (as per Requirement 8)
    setTimeout(async () => {
      await this.sessionService.updateSessionState(sessionId, ConversationState.LISTENING);
    }, 50); // Transition quickly, well under 200ms target
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
      recoverable: true,
    };

    this.sendToClient(sessionId, errorMessage);
  }
}
