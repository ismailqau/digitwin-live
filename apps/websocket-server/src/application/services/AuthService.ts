import { injectable } from 'tsyringe';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  subscriptionTier: string;
  permissions: string[];
  iat: number;
  exp: number;
}

@injectable()
export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  generateToken(userId: string, email: string, subscriptionTier: string = 'free'): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      email,
      subscriptionTier,
      permissions: []
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: '24h'
    });
  }

  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}
