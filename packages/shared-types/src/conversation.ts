export enum ConversationState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
  INTERRUPTED = 'interrupted',
  ERROR = 'error',
}

export interface ConversationSession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds: number;
  state: ConversationState;
  currentTurnId?: string;
  llmProvider: string;
  ttsProvider: string;
  voiceModelId: string;
  totalTurns: number;
  averageLatencyMs: number;
  totalCost: number;
  turns: ConversationTurn[];
}

export interface ConversationTurn {
  id: string;
  sessionId: string;
  timestamp: Date;
  userAudioDurationMs: number;
  userTranscript: string;
  transcriptConfidence: number;
  retrievedChunks: string[];
  llmResponse: string;
  responseAudioDurationMs: number;
  asrLatencyMs: number;
  ragLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
  totalLatencyMs: number;
  asrCost: number;
  llmCost: number;
  ttsCost: number;
  totalCost: number;
}

export interface TurnMetrics {
  totalLatencyMs: number;
  asrLatencyMs: number;
  ragLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
}
