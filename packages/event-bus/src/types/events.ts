/**
 * Base event interface that all domain events must implement
 */
export interface DomainEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  aggregateId: string;
  aggregateType: string;
  version: number;
  metadata?: Record<string, any>;
}

/**
 * User Created Event
 * Emitted when a new user registers in the system
 */
export interface UserCreatedEvent extends DomainEvent {
  eventType: 'user.created';
  aggregateType: 'user';
  payload: {
    userId: string;
    email: string;
    name: string;
    subscriptionTier: 'free' | 'pro' | 'enterprise';
  };
}

/**
 * Voice Model Trained Event
 * Emitted when a voice model training completes successfully
 */
export interface VoiceModelTrainedEvent extends DomainEvent {
  eventType: 'voice_model.trained';
  aggregateType: 'voice_model';
  payload: {
    voiceModelId: string;
    userId: string;
    provider: 'xtts-v2' | 'google-cloud-tts' | 'openai-tts';
    modelPath: string;
    qualityScore: number;
    sampleRate: number;
    trainingDurationMs: number;
  };
}

/**
 * Document Processed Event
 * Emitted when a knowledge document is successfully processed and indexed
 */
export interface DocumentProcessedEvent extends DomainEvent {
  eventType: 'document.processed';
  aggregateType: 'knowledge_document';
  payload: {
    documentId: string;
    userId: string;
    filename: string;
    contentType: string;
    chunkCount: number;
    vectorIds: string[];
    processingDurationMs: number;
  };
}

/**
 * Face Model Created Event
 * Emitted when a face model is successfully created from user media
 */
export interface FaceModelCreatedEvent extends DomainEvent {
  eventType: 'face_model.created';
  aggregateType: 'face_model';
  payload: {
    faceModelId: string;
    userId: string;
    modelPath: string;
    qualityScore: number;
    resolution: {
      width: number;
      height: number;
    };
    keypointCount: number;
    processingDurationMs: number;
  };
}

/**
 * Conversation Started Event
 * Emitted when a new conversation session begins
 */
export interface ConversationStartedEvent extends DomainEvent {
  eventType: 'conversation.started';
  aggregateType: 'conversation_session';
  payload: {
    sessionId: string;
    userId: string;
    voiceModelId: string;
    faceModelId?: string;
    llmProvider: string;
    ttsProvider: string;
  };
}

/**
 * Conversation Turn Completed Event
 * Emitted when a conversation turn (user query + system response) completes
 */
export interface ConversationTurnCompletedEvent extends DomainEvent {
  eventType: 'conversation.turn_completed';
  aggregateType: 'conversation_session';
  payload: {
    sessionId: string;
    turnId: string;
    userId: string;
    userTranscript: string;
    systemResponse: string;
    latencyMs: number;
    cost: number;
  };
}

/**
 * Conversation Ended Event
 * Emitted when a conversation session ends
 */
export interface ConversationEndedEvent extends DomainEvent {
  eventType: 'conversation.ended';
  aggregateType: 'conversation_session';
  payload: {
    sessionId: string;
    userId: string;
    durationSeconds: number;
    totalTurns: number;
    totalCost: number;
    averageLatencyMs: number;
  };
}

/**
 * Document Processing Failed Event
 * Emitted when document processing fails
 */
export interface DocumentProcessingFailedEvent extends DomainEvent {
  eventType: 'document.processing_failed';
  aggregateType: 'knowledge_document';
  payload: {
    documentId: string;
    userId: string;
    filename: string;
    errorMessage: string;
    errorCode: string;
  };
}

/**
 * Voice Model Training Failed Event
 * Emitted when voice model training fails
 */
export interface VoiceModelTrainingFailedEvent extends DomainEvent {
  eventType: 'voice_model.training_failed';
  aggregateType: 'voice_model';
  payload: {
    voiceModelId: string;
    userId: string;
    provider: string;
    errorMessage: string;
    errorCode: string;
  };
}

/**
 * Face Model Creation Failed Event
 * Emitted when face model creation fails
 */
export interface FaceModelCreationFailedEvent extends DomainEvent {
  eventType: 'face_model.creation_failed';
  aggregateType: 'face_model';
  payload: {
    faceModelId: string;
    userId: string;
    errorMessage: string;
    errorCode: string;
  };
}

/**
 * Union type of all domain events
 */
export type AllDomainEvents =
  | UserCreatedEvent
  | VoiceModelTrainedEvent
  | DocumentProcessedEvent
  | FaceModelCreatedEvent
  | ConversationStartedEvent
  | ConversationTurnCompletedEvent
  | ConversationEndedEvent
  | DocumentProcessingFailedEvent
  | VoiceModelTrainingFailedEvent
  | FaceModelCreationFailedEvent;

/**
 * Event type names for type-safe event handling
 */
export type EventType = AllDomainEvents['eventType'];
