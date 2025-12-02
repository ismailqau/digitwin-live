/**
 * User-friendly error messages for common error scenarios
 * These messages are designed to be shown to end users
 */

import { ErrorCode } from './error-codes';

/**
 * Maps error codes to user-friendly messages
 */
export const USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  // Client Errors
  [ErrorCode.VALIDATION_ERROR]:
    'The provided data is invalid. Please check your input and try again.',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided. Please check your data and try again.',
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.ALREADY_EXISTS]: 'This resource already exists.',
  [ErrorCode.UNAUTHORIZED]: 'Please sign in to continue.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.INVALID_TOKEN]: 'Your session has expired. Please sign in again.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment and try again.',

  // ASR Errors
  [ErrorCode.ASR_ERROR]: 'Could not understand audio. Please try again.',
  [ErrorCode.ASR_AUDIO_QUALITY_ERROR]:
    'Audio quality is too low. Please speak more clearly or check your microphone.',

  // RAG Errors
  [ErrorCode.RAG_ERROR]: 'Failed to search knowledge base. Please try again.',
  [ErrorCode.KNOWLEDGE_BASE_EMPTY]: 'Please upload documents to your knowledge base first.',

  // LLM Errors
  [ErrorCode.LLM_ERROR]: 'Failed to generate response. Please try again.',
  [ErrorCode.LLM_TIMEOUT]: 'Response generation took too long. Please try again.',

  // TTS Errors
  [ErrorCode.TTS_ERROR]: 'Failed to generate audio. Please try again.',
  [ErrorCode.VOICE_MODEL_NOT_FOUND]: 'Voice model not found. Please train your voice model first.',

  // Lip-sync Errors
  [ErrorCode.LIPSYNC_ERROR]: 'Failed to generate video. Audio-only mode will be used.',

  // Face Processing Errors
  [ErrorCode.FACE_PROCESSING_ERROR]: 'Failed to process face model. Please try again.',
  [ErrorCode.FACE_DETECTION_ERROR]:
    'No face detected in the image. Please upload a clear photo of your face.',
  [ErrorCode.FACE_QUALITY_ERROR]:
    'Image quality is too low. Please upload a clearer photo with good lighting.',
  [ErrorCode.FACE_MODEL_NOT_FOUND]: 'Face model not found. Please create your face model first.',

  // Connection Errors
  [ErrorCode.CONNECTION_ERROR]: 'Connection lost. Attempting to reconnect...',
  [ErrorCode.WEBSOCKET_ERROR]: 'Real-time connection failed. Please refresh the page.',
  [ErrorCode.TIMEOUT]: 'Request took too long. Please try again.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',

  // Resource Errors
  [ErrorCode.GPU_UNAVAILABLE]: 'Processing queue is full. Please wait a moment.',
  [ErrorCode.QUEUE_FULL]: 'System is busy. Your request has been queued.',
  [ErrorCode.RESOURCE_EXHAUSTED]:
    'System resources are temporarily exhausted. Please try again later.',

  // External Service Errors
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'An external service is unavailable. Please try again later.',
  [ErrorCode.GOOGLE_API_ERROR]: 'Google service is temporarily unavailable. Please try again.',
  [ErrorCode.OPENAI_API_ERROR]: 'OpenAI service is temporarily unavailable. Please try again.',
  [ErrorCode.VERTEX_AI_ERROR]: 'AI service is temporarily unavailable. Please try again.',

  // Server Errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred. Please try again.',
};

/**
 * Gets a user-friendly message for an error code
 */
export function getUserFriendlyMessage(code: ErrorCode | string): string {
  if (code in USER_FRIENDLY_MESSAGES) {
    return USER_FRIENDLY_MESSAGES[code as ErrorCode];
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Gets a user-friendly message with estimated wait time for queue errors
 */
export function getQueueMessage(estimatedWaitMinutes?: number): string {
  if (estimatedWaitMinutes !== undefined && estimatedWaitMinutes > 0) {
    return `Processing queue is full. Estimated wait: ${estimatedWaitMinutes} minute${estimatedWaitMinutes > 1 ? 's' : ''}.`;
  }
  return USER_FRIENDLY_MESSAGES[ErrorCode.GPU_UNAVAILABLE];
}
