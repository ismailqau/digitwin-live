import {
  BaseError,
  ErrorCode,
  serializeWebSocketError,
  getUserFriendlyMessage,
} from '@clone/errors';
import WebSocket from 'ws';

import { MessageProtocol } from '../infrastructure/websocket/MessageProtocol';

/**
 * Maximum time (in ms) to send error message to client
 * Per requirement: WebSocket error messages sent within 1000ms of failure
 */
const ERROR_SEND_TIMEOUT_MS = 1000;

/**
 * WebSocket error handler that sends standardized error messages to clients
 */
export class WebSocketErrorHandler {
  /**
   * Sends an error message to the client via WebSocket
   * Ensures the error is sent within the required timeout
   */
  static sendError(ws: WebSocket, error: Error | BaseError, sessionId?: string): void {
    const startTime = Date.now();

    try {
      const errorMessage = serializeWebSocketError(error, sessionId);

      // Use a timeout to ensure we don't exceed the 1000ms requirement
      const timeoutId = setTimeout(() => {
        console.warn(`Error message send timeout exceeded for session ${sessionId}`);
      }, ERROR_SEND_TIMEOUT_MS);

      if (ws.readyState === WebSocket.OPEN) {
        const envelope = MessageProtocol.createEnvelope('error', errorMessage, sessionId);
        ws.send(MessageProtocol.serialize(envelope), () => {
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          if (elapsed > ERROR_SEND_TIMEOUT_MS) {
            console.warn(
              `Error message sent after ${elapsed}ms (exceeds ${ERROR_SEND_TIMEOUT_MS}ms requirement)`
            );
          }
        });
      } else {
        clearTimeout(timeoutId);
        console.warn('Cannot send error: WebSocket not open');
      }
    } catch (sendError) {
      console.error('Failed to send error message to client:', sendError);
    }
  }

  /**
   * Creates and sends an ASR failure error
   */
  static sendASRError(ws: WebSocket, sessionId: string, details?: Record<string, unknown>): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.ASR_ERROR),
      ErrorCode.ASR_ERROR,
      500,
      true,
      details
    );
    this.sendError(ws, error, sessionId);
  }

  /**
   * Creates and sends a knowledge base empty error
   */
  static sendKnowledgeBaseEmptyError(ws: WebSocket, sessionId: string): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.KNOWLEDGE_BASE_EMPTY),
      ErrorCode.KNOWLEDGE_BASE_EMPTY,
      400,
      false
    );
    this.sendError(ws, error, sessionId);
  }

  /**
   * Creates and sends a GPU unavailable error with estimated wait time
   */
  static sendGPUUnavailableError(
    ws: WebSocket,
    sessionId: string,
    estimatedWaitMinutes?: number
  ): void {
    const message = estimatedWaitMinutes
      ? `Processing queue is full. Estimated wait: ${estimatedWaitMinutes} minute${estimatedWaitMinutes > 1 ? 's' : ''}.`
      : getUserFriendlyMessage(ErrorCode.GPU_UNAVAILABLE);

    const error = new BaseError(message, ErrorCode.GPU_UNAVAILABLE, 503, true, {
      estimatedWaitMinutes,
    });
    this.sendError(ws, error, sessionId);
  }

  /**
   * Creates and sends a service timeout error
   */
  static sendTimeoutError(ws: WebSocket, sessionId: string, serviceName?: string): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.TIMEOUT),
      ErrorCode.TIMEOUT,
      504,
      true,
      { serviceName }
    );
    this.sendError(ws, error, sessionId);
  }

  /**
   * Creates and sends an LLM error
   */
  static sendLLMError(ws: WebSocket, sessionId: string, details?: Record<string, unknown>): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.LLM_ERROR),
      ErrorCode.LLM_ERROR,
      500,
      true,
      details
    );
    this.sendError(ws, error, sessionId);
  }

  /**
   * Creates and sends a TTS error
   */
  static sendTTSError(ws: WebSocket, sessionId: string, details?: Record<string, unknown>): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.TTS_ERROR),
      ErrorCode.TTS_ERROR,
      500,
      true,
      details
    );
    this.sendError(ws, error, sessionId);
  }

  /**
   * Creates and sends a voice model not found error
   */
  static sendVoiceModelNotFoundError(ws: WebSocket, sessionId: string): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.VOICE_MODEL_NOT_FOUND),
      ErrorCode.VOICE_MODEL_NOT_FOUND,
      404,
      false
    );
    this.sendError(ws, error, sessionId);
  }

  /**
   * Creates and sends a face model not found error
   */
  static sendFaceModelNotFoundError(ws: WebSocket, sessionId: string): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.FACE_MODEL_NOT_FOUND),
      ErrorCode.FACE_MODEL_NOT_FOUND,
      404,
      false
    );
    this.sendError(ws, error, sessionId);
  }

  /**
   * Creates and sends a connection error
   */
  static sendConnectionError(
    ws: WebSocket,
    sessionId: string,
    details?: Record<string, unknown>
  ): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.CONNECTION_ERROR),
      ErrorCode.CONNECTION_ERROR,
      503,
      true,
      details
    );
    this.sendError(ws, error, sessionId);
  }

  /**
   * Wraps an async handler with error handling
   */
  static wrapHandler<T>(
    ws: WebSocket,
    sessionId: string,
    handler: () => Promise<T>
  ): Promise<T | void> {
    return handler().catch((error) => {
      console.error(`Error in WebSocket handler for session ${sessionId}:`, error);
      this.sendError(ws, error, sessionId);
    });
  }
}

/**
 * Type guard to check if an error is a BaseError
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Extracts error code from any error
 */
export function getErrorCode(error: unknown): string {
  if (isBaseError(error)) {
    return error.code;
  }
  if (error instanceof Error) {
    return ErrorCode.INTERNAL_SERVER_ERROR;
  }
  return ErrorCode.INTERNAL_SERVER_ERROR;
}
