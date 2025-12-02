import {
  BaseError,
  ErrorCode,
  ErrorCategory,
  serializeApiError,
  getHttpStatusCode,
} from '@clone/errors';
import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  recoverable?: boolean;
  details?: Record<string, unknown>;
}

/**
 * Centralized error handler middleware for API Gateway
 * Handles all errors and returns consistent API responses
 */
export const errorHandler = (
  err: ApiError | BaseError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Get request ID for tracking
  const requestId =
    (req as Request & { id?: string }).id || (req.headers['x-request-id'] as string);

  // Serialize the error to standard format
  const errorResponse = serializeApiError(err, requestId);

  // Get HTTP status code
  const statusCode = getHttpStatusCode(err);

  // Log the error with appropriate level based on category
  const category = errorResponse.error.category;
  logError(err, category, requestId, req);

  // Send response
  res.status(statusCode).json(errorResponse);
};

/**
 * Logs errors with appropriate level based on category
 */
function logError(
  err: Error,
  category: ErrorCategory,
  requestId: string | undefined,
  req: Request
): void {
  const logData = {
    requestId,
    method: req.method,
    path: req.path,
    category,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
  };

  // Log client errors at info level, server errors at error level
  if (category === ErrorCategory.CLIENT) {
    console.info('Client error:', logData);
  } else if (category === ErrorCategory.EXTERNAL) {
    console.warn('External service error:', logData);
  } else {
    console.error('Server error:', logData);
  }
}

/**
 * Not found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId =
    (req as Request & { id?: string }).id || (req.headers['x-request-id'] as string);

  res.status(404).json({
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
      userMessage: 'The requested resource was not found.',
      category: ErrorCategory.CLIENT,
      recoverable: false,
      timestamp: new Date().toISOString(),
      requestId,
    },
  });
};

/**
 * Async handler wrapper to catch async errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Creates a standardized error for common scenarios
 */
export function createApiError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): BaseError {
  const statusCodeMap: Partial<Record<ErrorCode, number>> = {
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.INVALID_INPUT]: 400,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.ALREADY_EXISTS]: 409,
    [ErrorCode.UNAUTHORIZED]: 401,
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.INVALID_TOKEN]: 401,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [ErrorCode.TIMEOUT]: 504,
    [ErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ErrorCode.GPU_UNAVAILABLE]: 503,
    [ErrorCode.QUEUE_FULL]: 503,
  };

  const recoverableErrors = [
    ErrorCode.RATE_LIMIT_EXCEEDED,
    ErrorCode.TIMEOUT,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.GPU_UNAVAILABLE,
    ErrorCode.QUEUE_FULL,
    ErrorCode.ASR_ERROR,
    ErrorCode.LLM_ERROR,
    ErrorCode.TTS_ERROR,
  ];

  const statusCode = statusCodeMap[code] || 500;
  const recoverable = recoverableErrors.includes(code);

  return new BaseError(message, code, statusCode, recoverable, details);
}
