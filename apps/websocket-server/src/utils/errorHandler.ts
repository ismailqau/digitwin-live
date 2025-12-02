import {
  BaseError,
  ErrorCode,
  serializeWebSocketError,
  getUserFriendlyMessage,
} from '@clone/errors';
import { Socket } from 'socket.io';

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
  static sendError(socket: Socket, error: Error | BaseError, sessionId?: string): void {
    const startTime = Date.now();

    try {
      const errorMessage = serializeWebSocketError(error, sessionId);

      // Use a timeout to ensure we don't exceed the 1000ms requirement
      const timeoutId = setTimeout(() => {
        console.warn(`Error message send timeout exceeded for session ${sessionId}`);
      }, ERROR_SEND_TIMEOUT_MS);

      socket.emit('error', errorMessage, () => {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        if (elapsed > ERROR_SEND_TIMEOUT_MS) {
          console.warn(
            `Error message sent after ${elapsed}ms (exceeds ${ERROR_SEND_TIMEOUT_MS}ms requirement)`
          );
        }
      });
    } catch (sendError) {
      console.error('Failed to send error message to client:', sendError);
    }
  }

  /**
   * Creates and sends an ASR failure error
   */
  static sendASRError(socket: Socket, sessionId: string, details?: Record<string, unknown>): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.ASR_ERROR),
      ErrorCode.ASR_ERROR,
      500,
      true,
      details
    );
    this.sendError(socket, error, sessionId);
  }

  /**
   * Creates and sends a knowledge base empty error
   */
  static sendKnowledgeBaseEmptyError(socket: Socket, sessionId: string): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.KNOWLEDGE_BASE_EMPTY),
      ErrorCode.KNOWLEDGE_BASE_EMPTY,
      400,
      false
    );
    this.sendError(socket, error, sessionId);
  }

  /**
   * Creates and sends a GPU unavailable error with estimated wait time
   */
  static sendGPUUnavailableError(
    socket: Socket,
    sessionId: string,
    estimatedWaitMinutes?: number
  ): void {
    const message = estimatedWaitMinutes
      ? `Processing queue is full. Estimated wait: ${estimatedWaitMinutes} minute${estimatedWaitMinutes > 1 ? 's' : ''}.`
      : getUserFriendlyMessage(ErrorCode.GPU_UNAVAILABLE);

    const error = new BaseError(message, ErrorCode.GPU_UNAVAILABLE, 503, true, {
      estimatedWaitMinutes,
    });
    this.sendError(socket, error, sessionId);
  }

  /**
   * Creates and sends a service timeout error
   */
  static sendTimeoutError(socket: Socket, sessionId: string, serviceName?: string): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.TIMEOUT),
      ErrorCode.TIMEOUT,
      504,
      true,
      { serviceName }
    );
    this.sendError(socket, error, sessionId);
  }

  /**
   * Creates and sends an LLM error
   */
  static sendLLMError(socket: Socket, sessionId: string, details?: Record<string, unknown>): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.LLM_ERROR),
      ErrorCode.LLM_ERROR,
      500,
      true,
      details
    );
    this.sendError(socket, error, sessionId);
  }

  /**
   * Creates and sends a TTS error
   */
  static sendTTSError(socket: Socket, sessionId: string, details?: Record<string, unknown>): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.TTS_ERROR),
      ErrorCode.TTS_ERROR,
      500,
      true,
      details
    );
    this.sendError(socket, error, sessionId);
  }

  /**
   * Creates and sends a voice model not found error
   */
  static sendVoiceModelNotFoundError(socket: Socket, sessionId: string): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.VOICE_MODEL_NOT_FOUND),
      ErrorCode.VOICE_MODEL_NOT_FOUND,
      404,
      false
    );
    this.sendError(socket, error, sessionId);
  }

  /**
   * Creates and sends a face model not found error
   */
  static sendFaceModelNotFoundError(socket: Socket, sessionId: string): void {
    const error = new BaseError(
      getUserFriendlyMessage(ErrorCode.FACE_MODEL_NOT_FOUND),
      ErrorCode.FACE_MODEL_NOT_FOUND,
      404,
      false
    );
    this.sendError(socket, error, sessionId);
  }

  /**
   * Creates and sends a connection error
   */
  static sendConnectionError(
    socket: Socket,
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
    this.sendError(socket, error, sessionId);
  }

  /**
   * Wraps an async handler with error handling
   */
  static wrapHandler<T>(
    socket: Socket,
    sessionId: string,
    handler: () => Promise<T>
  ): Promise<T | void> {
    return handler().catch((error) => {
      console.error(`Error in WebSocket handler for session ${sessionId}:`, error);
      this.sendError(socket, error, sessionId);
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
