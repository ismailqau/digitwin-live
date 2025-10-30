import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  id?: string;
}

// Add correlation ID to each request
export const correlationIdMiddleware = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void => {
  req.id = (req.headers['x-correlation-id'] as string) || uuidv4();
  res.setHeader('X-Correlation-ID', req.id);
  next();
};

// Morgan logger with custom format
morgan.token('correlation-id', (req: RequestWithId) => req.id || '');

export const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms [correlation-id: :correlation-id]',
  {
    skip: (req) => req.url === '/health', // Skip health check logs
  }
);
