import { ConversationState, StateChangedMessage, StateErrorMessage } from '@clone/shared-types';
import { Server as SocketIOServer } from 'socket.io';
import { injectable, inject } from 'tsyringe';

import { ConversationStateMachine } from '../../domain/models/ConversationStateMachine';

import { SessionService } from './SessionService';

/**
 * Manages conversation state transitions and emits state change events
 */
@injectable()
export class StateManager {
  constructor(
    @inject('SessionService') private sessionService: SessionService,
    @inject('SocketIOServer') private io: SocketIOServer
  ) {}

  /**
   * Transition session state with validation and event emission
   */
  async transitionState(sessionId: string, newState: ConversationState): Promise<void> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const previousState = session.state;

    // Validate transition
    if (!ConversationStateMachine.canTransition(previousState, newState)) {
      const validTransitions = ConversationStateMachine.getValidNextStates(previousState);
      const errorMessage = `Invalid state transition: ${previousState} → ${newState}. Valid transitions: ${validTransitions.join(', ')}`;

      // Emit error message to client
      const errorMsg: StateErrorMessage = {
        type: 'state:error',
        sessionId,
        attemptedTransition: {
          from: previousState,
          to: newState,
        },
        errorMessage,
        timestamp: Date.now(),
      };

      this.io.to(session.connectionId).emit('message', errorMsg);

      throw new Error(errorMessage);
    }

    // Perform transition
    const result = await this.sessionService.transitionState(sessionId, newState);

    if (result.success) {
      // Emit state change message to client
      const stateMsg: StateChangedMessage = {
        type: 'state:changed',
        sessionId,
        previousState: result.previousState,
        currentState: result.currentState,
        timestamp: Date.now(),
      };

      this.io.to(session.connectionId).emit('message', stateMsg);

      console.log(
        `✅ State transition: ${sessionId} ${result.previousState} → ${result.currentState}`
      );
    }
  }

  /**
   * Get current state for a session
   */
  async getCurrentState(sessionId: string): Promise<ConversationState> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session.state;
  }

  /**
   * Check if a transition is valid
   */
  async canTransition(sessionId: string, newState: ConversationState): Promise<boolean> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      return false;
    }
    return ConversationStateMachine.canTransition(session.state, newState);
  }

  /**
   * Get valid next states for a session
   */
  async getValidNextStates(sessionId: string): Promise<ConversationState[]> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      return [];
    }
    return ConversationStateMachine.getValidNextStates(session.state);
  }

  /**
   * Get state description
   */
  getStateDescription(state: ConversationState): string {
    return ConversationStateMachine.getStateDescription(state);
  }
}
