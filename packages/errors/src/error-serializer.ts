/**
 * Error serialization utilities for consistent API responses
 */

import { BaseError } from './base-error';
import { ErrorCode, ErrorCategory, getErrorCategory } from './error-codes';
import { getUserFriendlyMessage } from './user-messages';

/**
 * Standardized API error response format
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    userMessage: string;
    category: ErrorCategory;
    recoverable: boolean;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * WebSocket error message format
 */
export interface WebSocketErrorMessage {
  type: 'error';
  sessionId?: string;
  errorCode: string;
  errorMessage: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  details?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Serializes an error to a standardized API response format
 */
export function serializeApiError(error: Error | BaseError, requestId?: string): ApiErrorResponse {
  const isBaseError = error instanceof BaseError;

  const code = isBaseError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
  const statusCode = isBaseError ? error.statusCode : 500;
  const recoverable = isBaseError ? error.recoverable : false;
  const details = isBaseError ? error.details : undefined;

  // Get user-friendly message
  const userMessage = getUserFriendlyMessage(code);

  // Determine category
  const category = getErrorCategory(code as ErrorCode);

  // For client errors, use the actual error message
  // For server errors, use a generic message in production
  const message =
    statusCode < 500 || process.env.NODE_ENV !== 'production'
      ? error.message
      : 'An internal error occurred';

  return {
    error: {
      code,
      message,
      userMessage,
      category,
      recoverable,
      details: process.env.NODE_ENV !== 'production' ? details : undefined,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

/**
 * Serializes an error to a WebSocket error message format
 */
export function serializeWebSocketError(
  error: Error | BaseError,
  sessionId?: string
): WebSocketErrorMessage {
  const isBaseError = error instanceof BaseError;

  const code = isBaseError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
  const recoverable = isBaseError ? error.recoverable : false;
  const details = isBaseError ? error.details : undefined;

  // Get user-friendly message
  const userMessage = getUserFriendlyMessage(code);

  // Determine if the error is retryable (user can retry the action)
  const retryable = isRetryableError(code);

  return {
    type: 'error',
    sessionId,
    errorCode: code,
    errorMessage: error.message,
    userMessage,
    recoverable,
    retryable,
    details: process.env.NODE_ENV !== 'production' ? details : undefined,
    timestamp: Date.now(),
  };
}

/**
 * Determines if an error is retryable by the user
 */
function isRetryableError(code: string): boolean {
  const retryableCodes = [
    ErrorCode.ASR_ERROR,
    ErrorCode.ASR_AUDIO_QUALITY_ERROR,
    ErrorCode.RAG_ERROR,
    ErrorCode.LLM_ERROR,
    ErrorCode.LLM_TIMEOUT,
    ErrorCode.TTS_ERROR,
    ErrorCode.LIPSYNC_ERROR,
    ErrorCode.CONNECTION_ERROR,
    ErrorCode.TIMEOUT,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.GPU_UNAVAILABLE,
    ErrorCode.QUEUE_FULL,
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    ErrorCode.GOOGLE_API_ERROR,
    ErrorCode.OPENAI_API_ERROR,
    ErrorCode.VERTEX_AI_ERROR,
  ];

  return retryableCodes.includes(code as ErrorCode);
}

/**
 * Extracts HTTP status code from an error
 */
export function getHttpStatusCode(error: Error | BaseError): number {
  if (error instanceof BaseError) {
    return error.statusCode;
  }

  // Check for common error patterns
  const message = error.message.toLowerCase();
  if (message.includes('not found')) return 404;
  if (message.includes('unauthorized') || message.includes('authentication')) return 401;
  if (message.includes('forbidden') || message.includes('permission')) return 403;
  if (message.includes('validation') || message.includes('invalid')) return 400;
  if (message.includes('timeout')) return 504;
  if (message.includes('rate limit')) return 429;

  return 500;
}

/**
 * Creates a simple error response for quick error handling
 */
export function createErrorResponse(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  const userMessage = getUserFriendlyMessage(code);
  const category = getErrorCategory(code);

  return {
    error: {
      code,
      message: message || userMessage,
      userMessage,
      category,
      recoverable: isRetryableError(code),
      details,
      timestamp: new Date().toISOString(),
    },
  };
}
