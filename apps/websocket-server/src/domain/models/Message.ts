export interface BaseMessage {
  type: string;
  sessionId: string;
  timestamp: number;
}

export interface AudioChunkMessage extends BaseMessage {
  type: 'audio_chunk';
  sequenceNumber: number;
  audioData: string; // base64 encoded
}

export interface InterruptionMessage extends BaseMessage {
  type: 'interruption';
  turnIndex?: number;
}

export interface EndUtteranceMessage extends BaseMessage {
  type: 'end_utterance';
}

export interface TranscriptMessage extends BaseMessage {
  type: 'transcript';
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface ResponseStartMessage extends BaseMessage {
  type: 'response_start';
  turnId: string;
}

export interface ResponseAudioMessage extends BaseMessage {
  type: 'response_audio';
  turnId: string;
  audioData: string;
  sequenceNumber: number;
}

export interface ResponseVideoMessage extends BaseMessage {
  type: 'response_video';
  turnId: string;
  frameData: string;
  sequenceNumber: number;
  format: 'jpeg' | 'h264';
}

export interface ResponseEndMessage extends BaseMessage {
  type: 'response_end';
  turnId: string;
  metrics: TurnMetrics;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  errorCode: string;
  errorMessage: string;
  recoverable: boolean;
}

export interface ConversationInterruptedMessage extends BaseMessage {
  type: 'conversation:interrupted';
  turnIndex: number;
}

export interface TurnMetrics {
  totalLatencyMs: number;
  asrLatencyMs: number;
  ragLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
}

export type ClientMessage = AudioChunkMessage | InterruptionMessage | EndUtteranceMessage;
export type ServerMessage =
  | TranscriptMessage
  | ResponseStartMessage
  | ResponseAudioMessage
  | ResponseVideoMessage
  | ResponseEndMessage
  | ErrorMessage
  | ConversationInterruptedMessage;
