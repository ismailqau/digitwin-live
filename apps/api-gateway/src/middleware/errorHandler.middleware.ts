import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  console.error('Error:', {
    code,
    message,
    stack: err.stack,
    details: err.details
  });

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(err.details && { details: err.details })
    }
  });
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found'
    }
  });
};
