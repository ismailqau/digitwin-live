import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  subscriptionTier: string;
  permissions: string[];
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authorization header provided'
        }
      });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Authorization header must be in format: Bearer <token>'
        }
      });
      return;
    }

    const token = parts[1];
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      });
      return;
    }

    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
      }
    });
  }
};

export const optionalAuthMiddleware = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};
