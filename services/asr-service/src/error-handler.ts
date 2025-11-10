import { createLogger } from '@clone/logger';

import { asrConfig } from './config';

const logger = createLogger('asr-error-handler');

export enum ASRErrorCode {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_AUDIO = 'INVALID_AUDIO',
  UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  STREAM_ERROR = 'STREAM_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class ASRError extends Error {
  constructor(
    public code: ASRErrorCode,
    message: string,
    public recoverable: boolean = true,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'ASRError';
  }
}

/**
 * ASR Error Handler with retry logic
 */
export class ASRErrorHandler {
  /**
   * Handle ASR error and determine if retry is appropriate
   */
  handleError(error: Error & { code?: number }, attemptCount: number = 0): ASRError {
    // Parse Google Cloud error
    if (error.code) {
      switch (error.code) {
        case 8: // RESOURCE_EXHAUSTED
          return new ASRError(
            ASRErrorCode.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded. Please try again later.',
            true,
            true
          );

        case 3: // INVALID_ARGUMENT
          return new ASRError(
            ASRErrorCode.INVALID_AUDIO,
            'Invalid audio format or configuration.',
            false,
            false
          );

        case 14: // UNAVAILABLE
          return new ASRError(
            ASRErrorCode.SERVICE_UNAVAILABLE,
            'ASR service temporarily unavailable.',
            true,
            true
          );

        case 16: // UNAUTHENTICATED
          return new ASRError(
            ASRErrorCode.AUTHENTICATION_ERROR,
            'Authentication failed. Check credentials.',
            false,
            false
          );

        case 4: // DEADLINE_EXCEEDED
          return new ASRError(ASRErrorCode.TIMEOUT, 'Request timeout.', true, true);

        default:
          logger.warn('Unknown Google Cloud error code', {
            code: error.code,
            message: error.message,
          });
      }
    }

    // Check for specific error messages
    if (error.message) {
      if (error.message.includes('quota')) {
        return new ASRError(ASRErrorCode.QUOTA_EXCEEDED, 'Daily quota exceeded.', true, false);
      }

      if (error.message.includes('language')) {
        return new ASRError(
          ASRErrorCode.UNSUPPORTED_LANGUAGE,
          'Unsupported language code.',
          false,
          false
        );
      }

      if (error.message.includes('stream')) {
        return new ASRError(ASRErrorCode.STREAM_ERROR, 'Stream error occurred.', true, true);
      }
    }

    // Default unknown error
    return new ASRError(
      ASRErrorCode.UNKNOWN_ERROR,
      error.message || 'Unknown error occurred.',
      true,
      attemptCount < asrConfig.retryConfig.maxRetries
    );
  }

  /**
   * Determine if error should be retried
   */
  shouldRetry(error: ASRError, attemptCount: number): boolean {
    if (!error.retryable) {
      return false;
    }

    if (attemptCount >= asrConfig.retryConfig.maxRetries) {
      logger.warn('Max retry attempts reached', {
        errorCode: error.code,
        attemptCount,
      });
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  getRetryDelay(attemptCount: number): number {
    const { initialDelayMs, maxDelayMs, backoffMultiplier } = asrConfig.retryConfig;

    const delay = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attemptCount), maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;

    return Math.floor(delay + jitter);
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    attemptCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const asrError = this.handleError(error as Error & { code?: number }, attemptCount);

      logger.error('ASR operation failed', {
        context,
        errorCode: asrError.code,
        attemptCount,
        recoverable: asrError.recoverable,
        retryable: asrError.retryable,
        message: asrError.message,
      });

      if (this.shouldRetry(asrError, attemptCount)) {
        const delay = this.getRetryDelay(attemptCount);

        logger.info('Retrying ASR operation', {
          context,
          attemptCount: attemptCount + 1,
          delayMs: delay,
        });

        await this.sleep(delay);
        return this.withRetry(operation, context, attemptCount + 1);
      }

      throw asrError;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: ASRError): string {
    switch (error.code) {
      case ASRErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many requests. Please wait a moment and try again.';

      case ASRErrorCode.QUOTA_EXCEEDED:
        return 'Daily usage limit reached. Please try again tomorrow or upgrade your plan.';

      case ASRErrorCode.INVALID_AUDIO:
        return 'Audio format not supported. Please check your microphone settings.';

      case ASRErrorCode.UNSUPPORTED_LANGUAGE:
        return 'Selected language is not supported. Please choose a different language.';

      case ASRErrorCode.SERVICE_UNAVAILABLE:
        return 'Speech recognition service is temporarily unavailable. Please try again.';

      case ASRErrorCode.STREAM_ERROR:
        return 'Connection error occurred. Please check your internet connection.';

      case ASRErrorCode.AUTHENTICATION_ERROR:
        return 'Authentication failed. Please contact support.';

      case ASRErrorCode.TIMEOUT:
        return 'Request timed out. Please try again.';

      default:
        return 'An error occurred. Please try again.';
    }
  }
}
