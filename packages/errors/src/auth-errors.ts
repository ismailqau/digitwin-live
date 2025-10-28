import { BaseError } from './base-error';

export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Unauthorized', details?: Record<string, unknown>) {
    super(message, 'UNAUTHORIZED', 401, false, details);
  }
}

export class ForbiddenError extends BaseError {
  constructor(message: string = 'Forbidden', details?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', 403, false, details);
  }
}

export class InvalidTokenError extends BaseError {
  constructor(message: string = 'Invalid token', details?: Record<string, unknown>) {
    super(message, 'INVALID_TOKEN', 401, false, details);
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded', details?: Record<string, unknown>) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true, details);
  }
}
