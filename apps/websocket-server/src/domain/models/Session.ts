import { ConversationState, ConversationTurn } from '@clone/shared-types';

export interface InterruptionEvent {
  interrupted: boolean;
  interruptedAt: number;
  turnIndex?: number;
  timestamp: number;
}

export interface InterruptionStats {
  totalInterruptions: number;
  earlyInterruptions: number; // Interrupted in first 25% of response
  midInterruptions: number; // Interrupted in middle 50% of response
  lateInterruptions: number; // Interrupted in last 25% of response
}

export interface SessionMetadata {
  interruptions?: InterruptionEvent[];
  interruptionStats?: InterruptionStats;
  [key: string]: unknown;
}

export interface Session {
  id: string;
  userId: string;
  connectionId: string;
  state: ConversationState;
  conversationHistory: ConversationTurn[];
  createdAt: Date;
  lastActivityAt: Date;
  metadata?: SessionMetadata;
}

export class SessionEntity implements Session {
  constructor(
    public id: string,
    public userId: string,
    public connectionId: string,
    public state: ConversationState,
    public conversationHistory: ConversationTurn[] = [],
    public createdAt: Date = new Date(),
    public lastActivityAt: Date = new Date(),
    public metadata: SessionMetadata = {}
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
