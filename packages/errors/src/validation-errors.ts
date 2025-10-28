import { BaseError } from './base-error';

export class ValidationError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, false, details);
  }
}

export class InvalidInputError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_INPUT', 400, false, details);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', 404, false, details);
  }
}

export class AlreadyExistsError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ALREADY_EXISTS', 409, false, details);
  }
}
