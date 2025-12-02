/**
 * Conversation-specific error classes for the Real-Time Conversational Clone System
 * These errors are designed for the conversation flow with user-friendly messages
 */

import { BaseError } from './base-error';
import { ErrorCode } from './error-codes';
import { getUserFriendlyMessage, getQueueMessage } from './user-messages';

/**
 * ASR (Automatic Speech Recognition) specific errors
 */
export class ASRFailureError extends BaseError {
  constructor(details?: Record<string, unknown>) {
    super(
      getUserFriendlyMessage(ErrorCode.ASR_ERROR),
      ErrorCode.ASR_ERROR,
      500,
      true, // recoverable - user can retry
      details
    );
  }
}

export class ASRAudioQualityError extends BaseError {
  constructor(details?: Record<string, unknown>) {
    super(
      getUserFriendlyMessage(ErrorCode.ASR_AUDIO_QUALITY_ERROR),
      ErrorCode.ASR_AUDIO_QUALITY_ERROR,
      400,
      true,
      details
    );
  }
}

/**
 * Knowledge Base errors
 */
export class KnowledgeBaseEmptyError extends BaseError {
  constructor(details?: Record<string, unknown>) {
    super(
      getUserFriendlyMessage(ErrorCode.KNOWLEDGE_BASE_EMPTY),
      ErrorCode.KNOWLEDGE_BASE_EMPTY,
      400,
      false, // not recoverable without user action
      details
    );
  }
}

/**
 * GPU/Resource availability errors
 */
export class GPUUnavailableError extends BaseError {
  public readonly estimatedWaitMinutes?: number;

  constructor(estimatedWaitMinutes?: number, details?: Record<string, unknown>) {
    super(getQueueMessage(estimatedWaitMinutes), ErrorCode.GPU_UNAVAILABLE, 503, true, {
      ...details,
      estimatedWaitMinutes,
    });
    this.estimatedWaitMinutes = estimatedWaitMinutes;
  }
}

export class QueueFullError extends BaseError {
  public readonly queuePosition?: number;
  public readonly estimatedWaitMinutes?: number;

  constructor(
    queuePosition?: number,
    estimatedWaitMinutes?: number,
    details?: Record<string, unknown>
  ) {
    super(getQueueMessage(estimatedWaitMinutes), ErrorCode.QUEUE_FULL, 503, true, {
      ...details,
      queuePosition,
      estimatedWaitMinutes,
    });
    this.queuePosition = queuePosition;
    this.estimatedWaitMinutes = estimatedWaitMinutes;
  }
}

/**
 * Service timeout errors
 */
export class ServiceTimeoutError extends BaseError {
  public readonly serviceName: string;

  constructor(serviceName: string, details?: Record<string, unknown>) {
    super(getUserFriendlyMessage(ErrorCode.TIMEOUT), ErrorCode.TIMEOUT, 504, true, {
      ...details,
      serviceName,
    });
    this.serviceName = serviceName;
  }
}

/**
 * Voice model errors
 */
export class VoiceModelNotFoundError extends BaseError {
  constructor(userId?: string, details?: Record<string, unknown>) {
    super(
      getUserFriendlyMessage(ErrorCode.VOICE_MODEL_NOT_FOUND),
      ErrorCode.VOICE_MODEL_NOT_FOUND,
      404,
      false,
      { ...details, userId }
    );
  }
}

/**
 * Face model errors
 */
export class FaceModelNotFoundError extends BaseError {
  constructor(userId?: string, details?: Record<string, unknown>) {
    super(
      getUserFriendlyMessage(ErrorCode.FACE_MODEL_NOT_FOUND),
      ErrorCode.FACE_MODEL_NOT_FOUND,
      404,
      false,
      { ...details, userId }
    );
  }
}

/**
 * External service errors
 */
export class GoogleAPIError extends BaseError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || getUserFriendlyMessage(ErrorCode.GOOGLE_API_ERROR),
      ErrorCode.GOOGLE_API_ERROR,
      502,
      true,
      details
    );
  }
}

export class OpenAIAPIError extends BaseError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || getUserFriendlyMessage(ErrorCode.OPENAI_API_ERROR),
      ErrorCode.OPENAI_API_ERROR,
      502,
      true,
      details
    );
  }
}

export class VertexAIError extends BaseError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || getUserFriendlyMessage(ErrorCode.VERTEX_AI_ERROR),
      ErrorCode.VERTEX_AI_ERROR,
      502,
      true,
      details
    );
  }
}

/**
 * WebSocket specific errors
 */
export class WebSocketError extends BaseError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || getUserFriendlyMessage(ErrorCode.WEBSOCKET_ERROR),
      ErrorCode.WEBSOCKET_ERROR,
      500,
      true,
      details
    );
  }
}
