export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Service errors
  ASR_ERROR = 'ASR_ERROR',
  RAG_ERROR = 'RAG_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  TTS_ERROR = 'TTS_ERROR',
  LIPSYNC_ERROR = 'LIPSYNC_ERROR',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',

  // Network errors
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT = 'TIMEOUT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Internal errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}
