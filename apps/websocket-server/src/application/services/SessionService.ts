import { ConversationState, ConversationTurn } from '@clone/shared-types';
import { injectable, inject } from 'tsyringe';

import { ConversationStateMachine } from '../../domain/models/ConversationStateMachine';
import { Session } from '../../domain/models/Session';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';

export interface StateTransitionResult {
  success: boolean;
  previousState: ConversationState;
  currentState: ConversationState;
  error?: string;
}

@injectable()
export class SessionService {
  constructor(@inject('ISessionRepository') private sessionRepository: ISessionRepository) {}

  async createSession(userId: string, connectionId: string): Promise<Session> {
    return await this.sessionRepository.create(userId, connectionId);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return await this.sessionRepository.findById(sessionId);
  }

  async getSessionByConnectionId(connectionId: string): Promise<Session | null> {
    return await this.sessionRepository.findByConnectionId(connectionId);
  }

  /**
   * Transition session state with validation
   * @throws Error if transition is invalid
   */
  async transitionState(
    sessionId: string,
    newState: ConversationState
  ): Promise<StateTransitionResult> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const previousState = session.state;

    // Validate state transition
    if (!ConversationStateMachine.canTransition(previousState, newState)) {
      const validTransitions = ConversationStateMachine.getValidNextStates(previousState);
      return {
        success: false,
        previousState,
        currentState: previousState,
        error: `Invalid state transition: ${previousState} → ${newState}. Valid transitions: ${validTransitions.join(', ')}`,
      };
    }

    // Perform transition
    session.state = newState;
    session.lastActivityAt = new Date();
    await this.sessionRepository.update(session);

    return {
      success: true,
      previousState,
      currentState: newState,
    };
  }

  /**
   * Update session state without validation (for backward compatibility)
   * @deprecated Use transitionState instead
   */
  async updateSessionState(sessionId: string, state: ConversationState): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.state = state;
    session.lastActivityAt = new Date();
    await this.sessionRepository.update(session);
  }

  async addConversationTurn(sessionId: string, turn: ConversationTurn): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.conversationHistory.push(turn);
    session.lastActivityAt = new Date();
    await this.sessionRepository.update(session);
  }

  /**
   * Get last N conversation turns for context
   */
  async getConversationHistory(sessionId: string, limit: number = 5): Promise<ConversationTurn[]> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Return last N turns
    return session.conversationHistory.slice(-limit);
  }

  async endSession(sessionId: string): Promise<void> {
    await this.sessionRepository.delete(sessionId);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return await this.sessionRepository.findByUserId(userId);
  }

  /**
   * Update session activity timestamp
   */
  async updateActivity(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.lastActivityAt = new Date();
    await this.sessionRepository.update(session);
  }
}
