// Client -> Server Messages
export interface AudioChunkMessage {
  type: 'audio_chunk';
  sessionId: string;
  sequenceNumber: number;
  audioData: string;
  timestamp: number;
}

export interface InterruptionMessage {
  type: 'interruption';
  sessionId: string;
  timestamp: number;
  turnIndex?: number; // Current turn index being interrupted
}

export interface EndUtteranceMessage {
  type: 'end_utterance';
  sessionId: string;
  timestamp: number;
}

// Server -> Client Messages
export interface TranscriptMessage {
  type: 'transcript';
  sessionId: string;
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface SourceMetadata {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  relevanceScore: number;
  sourceType: 'document' | 'faq' | 'conversation';
  contentSnippet: string;
}

export interface ResponseStartMessage {
  type: 'response_start';
  sessionId: string;
  turnId: string;
  sources?: SourceMetadata[];
}

export interface ResponseAudioMessage {
  type: 'response_audio';
  sessionId: string;
  turnId: string;
  audioData: string;
  sequenceNumber: number;
  timestamp: number;
}

export interface ResponseVideoMessage {
  type: 'response_video';
  sessionId: string;
  turnId: string;
  frameData: string;
  sequenceNumber: number;
  timestamp: number;
  format: 'jpeg' | 'h264';
}

export interface ResponseEndMessage {
  type: 'response_end';
  sessionId: string;
  turnId: string;
  sources?: SourceMetadata[];
  metrics: {
    totalLatencyMs: number;
    asrLatencyMs: number;
    ragLatencyMs: number;
    llmLatencyMs: number;
    ttsLatencyMs: number;
  };
}

export interface ErrorMessage {
  type: 'error';
  sessionId: string;
  errorCode: string;
  errorMessage: string;
  recoverable: boolean;
}

// State Management Messages
export interface StateChangedMessage {
  type: 'state:changed';
  sessionId: string;
  previousState: string;
  currentState: string;
  timestamp: number;
}

export interface StateErrorMessage {
  type: 'state:error';
  sessionId: string;
  attemptedTransition: {
    from: string;
    to: string;
  };
  errorMessage: string;
  timestamp: number;
}

export interface SessionExpiredMessage {
  type: 'session:expired';
  sessionId: string;
  reason: string;
  timestamp: number;
}

export interface ConversationInterruptedMessage {
  type: 'conversation:interrupted';
  sessionId: string;
  turnIndex: number;
  timestamp: number;
}

export type ClientMessage = AudioChunkMessage | InterruptionMessage | EndUtteranceMessage;

export type ServerMessage =
  | TranscriptMessage
  | ResponseStartMessage
  | ResponseAudioMessage
  | ResponseVideoMessage
  | ResponseEndMessage
  | ErrorMessage
  | StateChangedMessage
  | StateErrorMessage
  | SessionExpiredMessage
  | ConversationInterruptedMessage;
