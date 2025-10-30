import jwt from 'jsonwebtoken';
import { injectable } from 'tsyringe';

export interface JWTPayload {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  roles: string[];
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
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  generateToken(
    userId: string,
    email: string,
    subscriptionTier: 'free' | 'pro' | 'enterprise' = 'free',
    roles: string[] = ['user']
  ): string {
    const permissions = this.getPermissionsForTier(subscriptionTier, roles);

    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      email,
      subscriptionTier,
      permissions,
      roles,
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: '24h',
    });
  }

  private getPermissionsForTier(tier: 'free' | 'pro' | 'enterprise', roles: string[]): string[] {
    const permissions: string[] = ['conversation:create', 'conversation:read', 'knowledge:read'];

    if (tier === 'pro' || tier === 'enterprise') {
      permissions.push('knowledge:write', 'voice:create', 'face:create');
    }

    if (tier === 'enterprise') {
      permissions.push('analytics:read', 'team:manage');
    }

    if (roles.includes('admin')) {
      permissions.push('admin:all', 'user:manage', 'system:manage');
    }

    return permissions;
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
