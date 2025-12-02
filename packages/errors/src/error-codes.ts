/**
 * Centralized error codes for the Conversational Clone System
 * These codes are used for consistent error identification across all services
 */

export enum ErrorCode {
  // Client Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Service Errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  ASR_ERROR = 'ASR_ERROR',
  ASR_AUDIO_QUALITY_ERROR = 'ASR_AUDIO_QUALITY_ERROR',
  RAG_ERROR = 'RAG_ERROR',
  KNOWLEDGE_BASE_EMPTY = 'KNOWLEDGE_BASE_EMPTY',
  LLM_ERROR = 'LLM_ERROR',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  TTS_ERROR = 'TTS_ERROR',
  VOICE_MODEL_NOT_FOUND = 'VOICE_MODEL_NOT_FOUND',
  LIPSYNC_ERROR = 'LIPSYNC_ERROR',
  FACE_PROCESSING_ERROR = 'FACE_PROCESSING_ERROR',
  FACE_DETECTION_ERROR = 'FACE_DETECTION_ERROR',
  FACE_QUALITY_ERROR = 'FACE_QUALITY_ERROR',
  FACE_MODEL_NOT_FOUND = 'FACE_MODEL_NOT_FOUND',

  // Connection Errors
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Resource Errors
  GPU_UNAVAILABLE = 'GPU_UNAVAILABLE',
  QUEUE_FULL = 'QUEUE_FULL',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',

  // External Service Errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  GOOGLE_API_ERROR = 'GOOGLE_API_ERROR',
  OPENAI_API_ERROR = 'OPENAI_API_ERROR',
  VERTEX_AI_ERROR = 'VERTEX_AI_ERROR',
}

export enum ErrorCategory {
  CLIENT = 'client',
  SERVER = 'server',
  EXTERNAL = 'external',
  NETWORK = 'network',
  RESOURCE = 'resource',
}

/**
 * Maps error codes to their categories
 */
export function getErrorCategory(code: ErrorCode): ErrorCategory {
  const clientErrors = [
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.INVALID_INPUT,
    ErrorCode.NOT_FOUND,
    ErrorCode.ALREADY_EXISTS,
    ErrorCode.UNAUTHORIZED,
    ErrorCode.FORBIDDEN,
    ErrorCode.INVALID_TOKEN,
    ErrorCode.RATE_LIMIT_EXCEEDED,
    ErrorCode.FACE_DETECTION_ERROR,
    ErrorCode.FACE_QUALITY_ERROR,
    ErrorCode.ASR_AUDIO_QUALITY_ERROR,
  ];

  const externalErrors = [
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    ErrorCode.GOOGLE_API_ERROR,
    ErrorCode.OPENAI_API_ERROR,
    ErrorCode.VERTEX_AI_ERROR,
  ];

  const networkErrors = [
    ErrorCode.CONNECTION_ERROR,
    ErrorCode.WEBSOCKET_ERROR,
    ErrorCode.TIMEOUT,
    ErrorCode.SERVICE_UNAVAILABLE,
  ];

  const resourceErrors = [
    ErrorCode.GPU_UNAVAILABLE,
    ErrorCode.QUEUE_FULL,
    ErrorCode.RESOURCE_EXHAUSTED,
  ];

  if (clientErrors.includes(code)) return ErrorCategory.CLIENT;
  if (externalErrors.includes(code)) return ErrorCategory.EXTERNAL;
  if (networkErrors.includes(code)) return ErrorCategory.NETWORK;
  if (resourceErrors.includes(code)) return ErrorCategory.RESOURCE;
  return ErrorCategory.SERVER;
}
