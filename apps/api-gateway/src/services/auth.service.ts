import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface JWTPayload {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  roles: string[];
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';
  private readonly REFRESH_SECRET = process.env.REFRESH_SECRET || 'development-refresh-secret';

  // In-memory storage for demo - replace with database in production
  private users: Map<string, User> = new Map();
  private refreshTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();

  constructor() {
    // Initialize with a demo user
    const demoUser: User = {
      id: uuidv4(),
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash: 'hashed_password', // In production, use bcrypt
      subscriptionTier: 'free',
      roles: ['user'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(demoUser.email, demoUser);
  }

  async register(
    email: string,
    password: string,
    name: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    // Check if user already exists
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }

    // In production, hash password with bcrypt
    const passwordHash = `hashed_${password}`;

    const user: User = {
      id: uuidv4(),
      email,
      name,
      passwordHash,
      subscriptionTier: 'free',
      roles: ['user'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(email, user);

    const tokens = this.generateTokenPair(user);

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, tokens };
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: TokenPair }> {
    const user = this.users.get(email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // In production, use bcrypt.compare
    const isValidPassword = user.passwordHash === `hashed_${password}`;

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const tokens = this.generateTokenPair(user);

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, tokens };
  }

  async loginWithOAuth(
    provider: 'google' | 'apple',
    oauthToken: string
  ): Promise<{ user: User; tokens: TokenPair }> {
    // In production, verify OAuth token with provider
    // For now, mock the OAuth flow
    const oauthUser = await this.verifyOAuthToken(provider, oauthToken);

    let user = Array.from(this.users.values()).find((u) => u.email === oauthUser.email);

    if (!user) {
      // Create new user from OAuth data
      user = {
        id: uuidv4(),
        email: oauthUser.email,
        name: oauthUser.name,
        subscriptionTier: 'free',
        roles: ['user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(user.email, user);
    }

    const tokens = this.generateTokenPair(user);

    return { user, tokens };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshToken, this.REFRESH_SECRET) as RefreshTokenPayload;

      // Check if refresh token is still valid in storage
      const storedToken = this.refreshTokens.get(decoded.tokenId);

      if (!storedToken || storedToken.userId !== decoded.userId) {
        throw new Error('Invalid refresh token');
      }

      if (storedToken.expiresAt < new Date()) {
        this.refreshTokens.delete(decoded.tokenId);
        throw new Error('Refresh token expired');
      }

      // Get user
      const user = Array.from(this.users.values()).find((u) => u.id === decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Revoke old refresh token
      this.refreshTokens.delete(decoded.tokenId);

      // Generate new token pair
      return this.generateTokenPair(user);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const decoded = jwt.verify(refreshToken, this.REFRESH_SECRET) as RefreshTokenPayload;
      this.refreshTokens.delete(decoded.tokenId);
    } catch {
      // Token already invalid, nothing to revoke
    }
  }

  hasPermission(user: JWTPayload, permission: string): boolean {
    return user.permissions.includes(permission) || user.roles.includes('admin');
  }

  hasRole(user: JWTPayload, role: string): boolean {
    return user.roles.includes(role);
  }

  private generateTokenPair(user: User): TokenPair {
    const permissions = this.getPermissionsForUser(user);

    const accessTokenPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
      permissions,
      roles: user.roles,
    };

    const accessToken = jwt.sign(accessTokenPayload, this.JWT_SECRET);

    const tokenId = uuidv4();
    const refreshTokenPayload: RefreshTokenPayload = {
      userId: user.id,
      tokenId,
    };

    const refreshToken = jwt.sign(refreshTokenPayload, this.REFRESH_SECRET);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    this.refreshTokens.set(tokenId, { userId: user.id, expiresAt });

    // Calculate expiry in seconds (15 minutes default)
    const expiresIn = 900;

    return { accessToken, refreshToken, expiresIn };
  }

  private getPermissionsForUser(user: User): string[] {
    const permissions: string[] = [];

    // Base permissions for all users
    permissions.push('conversation:create', 'conversation:read', 'knowledge:read');

    // Tier-based permissions
    if (user.subscriptionTier === 'pro' || user.subscriptionTier === 'enterprise') {
      permissions.push('knowledge:write', 'voice:create', 'face:create');
    }

    if (user.subscriptionTier === 'enterprise') {
      permissions.push('analytics:read', 'team:manage');
    }

    // Role-based permissions
    if (user.roles.includes('admin')) {
      permissions.push('admin:all', 'user:manage', 'system:manage');
    }

    return permissions;
  }

  private async verifyOAuthToken(
    provider: 'google' | 'apple',
    token: string
  ): Promise<{ email: string; name: string }> {
    // In production, verify token with OAuth provider
    // For Google: https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=TOKEN
    // For Apple: Verify JWT with Apple's public keys

    // Mock implementation
    if (provider === 'google') {
      return {
        email: `google_${token}@example.com`,
        name: 'Google User',
      };
    } else {
      return {
        email: `apple_${token}@example.com`,
        name: 'Apple User',
      };
    }
  }
}

// Singleton instance
export const authService = new AuthService();
