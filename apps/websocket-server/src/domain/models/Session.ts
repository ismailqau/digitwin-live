import { ConversationState, ConversationTurn } from '@clone/shared-types';

export interface Session {
  id: string;
  userId: string;
  connectionId: string;
  state: ConversationState;
  conversationHistory: ConversationTurn[];
  createdAt: Date;
  lastActivityAt: Date;
}

export class SessionEntity implements Session {
  constructor(
    public id: string,
    public userId: string,
    public connectionId: string,
    public state: ConversationState,
    public conversationHistory: ConversationTurn[] = [],
    public createdAt: Date = new Date(),
    public lastActivityAt: Date = new Date()
  ) {}

  updateActivity(): void {
    this.lastActivityAt = new Date();
  }

  updateState(newState: ConversationState): void {
    this.state = newState;
    this.updateActivity();
  }

  addConversationTurn(turn: ConversationTurn): void {
    this.conversationHistory.push(turn);
    this.updateActivity();
  }
}
