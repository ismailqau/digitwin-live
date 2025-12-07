import jwt from 'jsonwebtoken';
import { injectable } from 'tsyringe';

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
}

/**
 * Authentication error messages
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.AUTH_REQUIRED]: 'Authentication token required',
  [AuthErrorCode.AUTH_INVALID]: 'Invalid authentication token',
  [AuthErrorCode.AUTH_EXPIRED]: 'Authentication token expired',
};

/**
 * Authentication error with code and message
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message?: string
  ) {
    super(message || AUTH_ERROR_MESSAGES[code]);
    this.name = 'AuthError';
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  roles: string[];
  iat: number;
  exp: number;
}

/**
 * Token payload returned from verification
 */
export interface TokenPayload {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  roles: string[];
  isGuest: boolean;
  iat: number;
  exp: number;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  payload?: TokenPayload;
  error?: {
    code: AuthErrorCode;
    message: string;
  };
}

/**
 * Guest token validation result
 */
export interface GuestTokenValidationResult {
  isValid: boolean;
  uuid?: string;
  timestamp?: number;
  error?: string;
}

/**
 * Guest token expiration time in milliseconds (1 hour)
 */
export const GUEST_TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

@injectable()
export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

  /**
   * Checks if a token is a guest token (starts with "guest_")
   */
  isGuestToken(token: string | null | undefined): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    return token.startsWith('guest_');
  }

  /**
   * Validates a guest token format and extracts its components
   *
   * Guest token format: guest_<uuid>_<timestamp>
   * Example: guest_550e8400-e29b-41d4-a716-446655440000_1733547600000
   */
  verifyGuestToken(token: string | null | undefined): GuestTokenValidationResult {
    if (!token) {
      return { isValid: false, error: 'Token is required' };
    }

    if (typeof token !== 'string') {
      return { isValid: false, error: 'Token must be a string' };
    }

    // Check if token starts with "guest_"
    if (!token.startsWith('guest_')) {
      return { isValid: false, error: 'Token must start with "guest_"' };
    }

    // Split token into parts
    const parts = token.split('_');

    // Expected format: guest_<uuid>_<timestamp>
    // UUID contains hyphens, so we need to handle that
    // Format: guest_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx_timestamp
    if (parts.length < 3) {
      return { isValid: false, error: 'Invalid token format' };
    }

    // Extract timestamp (last part)
    const timestampStr = parts[parts.length - 1];
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp) || timestamp <= 0) {
      return { isValid: false, error: 'Invalid timestamp' };
    }

    // Extract UUID (everything between "guest_" and the last "_timestamp")
    // Remove "guest_" prefix and "_timestamp" suffix
    const uuidPart = token.slice(6, -(timestampStr.length + 1));

    // Validate UUID format (basic check for UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuidPart)) {
      return { isValid: false, error: 'Invalid UUID format' };
    }

    // Check if token has expired
    const now = Date.now();
    const tokenAge = now - timestamp;
    if (tokenAge > GUEST_TOKEN_EXPIRATION_MS) {
      return { isValid: false, error: 'Guest token expired' };
    }

    return {
      isValid: true,
      uuid: uuidPart,
      timestamp,
    };
  }

  /**
   * Verifies a token and returns the payload
   * Supports both JWT tokens and guest tokens
   *
   * @throws AuthError if token is invalid, expired, or missing
   */
  verifyToken(token: string | null | undefined): TokenPayload {
    // Check for missing token
    if (!token) {
      throw new AuthError(AuthErrorCode.AUTH_REQUIRED);
    }

    // Support guest tokens
    if (this.isGuestToken(token)) {
      const guestValidation = this.verifyGuestToken(token);

      if (!guestValidation.isValid) {
        // Check if it's an expiration error
        if (guestValidation.error === 'Guest token expired') {
          throw new AuthError(AuthErrorCode.AUTH_EXPIRED);
        }
        throw new AuthError(AuthErrorCode.AUTH_INVALID);
      }

      // Return guest payload
      return {
        userId: `guest-${guestValidation.uuid}`,
        email: 'guest@digitwin.local',
        subscriptionTier: 'free',
        permissions: ['conversation:create', 'conversation:read'],
        roles: ['guest'],
        isGuest: true,
        iat: Math.floor((guestValidation.timestamp || Date.now()) / 1000),
        exp: Math.floor(
          ((guestValidation.timestamp || Date.now()) + GUEST_TOKEN_EXPIRATION_MS) / 1000
        ),
      };
    }

    // Support mock tokens for development and testing
    if (token === 'mock-guest-token' || token.startsWith('mock-')) {
      return {
        userId: 'guest-user',
        email: 'guest@digitwin.local',
        subscriptionTier: 'free',
        permissions: ['conversation:create', 'conversation:read'],
        roles: ['guest'],
        isGuest: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      };
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      return {
        ...decoded,
        isGuest: false,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError(AuthErrorCode.AUTH_EXPIRED);
      }
      throw new AuthError(AuthErrorCode.AUTH_INVALID);
    }
  }

  /**
   * Verifies a token and returns an AuthResult (non-throwing version)
   */
  verifyTokenSafe(token: string | null | undefined): AuthResult {
    try {
      const payload = this.verifyToken(token);
      return {
        success: true,
        payload,
      };
    } catch (error) {
      if (error instanceof AuthError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        };
      }
      return {
        success: false,
        error: {
          code: AuthErrorCode.AUTH_INVALID,
          message: 'Unknown authentication error',
        },
      };
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
