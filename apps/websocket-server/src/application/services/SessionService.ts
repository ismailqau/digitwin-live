import { ConversationState, ConversationTurn } from '@clone/shared-types';
import { injectable, inject } from 'tsyringe';

import { Session } from '../../domain/models/Session';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';

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

  async endSession(sessionId: string): Promise<void> {
    await this.sessionRepository.delete(sessionId);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return await this.sessionRepository.findByUserId(userId);
  }
}
