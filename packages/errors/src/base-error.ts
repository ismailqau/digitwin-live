export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly recoverable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    recoverable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.recoverable = recoverable;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}
