/**
 * AuthService Tests
 *
 * Tests for authentication service including guest token support.
 */

import 'reflect-metadata';
import * as fc from 'fast-check';

import {
  AuthService,
  AuthErrorCode,
  AuthError,
  GUEST_TOKEN_EXPIRATION_MS,
} from '../application/services/AuthService';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('isGuestToken', () => {
    it('should return true for tokens starting with "guest_"', () => {
      expect(authService.isGuestToken('guest_abc_123')).toBe(true);
      expect(
        authService.isGuestToken('guest_550e8400-e29b-41d4-a716-446655440000_1733547600000')
      ).toBe(true);
    });

    it('should return false for non-guest tokens', () => {
      expect(authService.isGuestToken('jwt-token')).toBe(false);
      expect(authService.isGuestToken('mock-token')).toBe(false);
      expect(authService.isGuestToken('')).toBe(false);
      expect(authService.isGuestToken(null)).toBe(false);
      expect(authService.isGuestToken(undefined)).toBe(false);
    });
  });

  describe('verifyGuestToken', () => {
    it('should validate a properly formatted guest token', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const timestamp = Date.now();
      const token = `guest_${uuid}_${timestamp}`;

      const result = authService.verifyGuestToken(token);

      expect(result.isValid).toBe(true);
      expect(result.uuid).toBe(uuid);
      expect(result.timestamp).toBe(timestamp);
    });

    it('should reject null or undefined tokens', () => {
      expect(authService.verifyGuestToken(null).isValid).toBe(false);
      expect(authService.verifyGuestToken(undefined).isValid).toBe(false);
    });

    it('should reject tokens not starting with "guest_"', () => {
      const result = authService.verifyGuestToken('invalid_token');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token must start with "guest_"');
    });

    it('should reject tokens with invalid UUID format', () => {
      const result = authService.verifyGuestToken('guest_invalid-uuid_1733547600000');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid UUID format');
    });

    it('should reject tokens with invalid timestamp', () => {
      const result = authService.verifyGuestToken(
        'guest_550e8400-e29b-41d4-a716-446655440000_invalid'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid timestamp');
    });

    it('should reject expired guest tokens', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const expiredTimestamp = Date.now() - GUEST_TOKEN_EXPIRATION_MS - 1000;
      const token = `guest_${uuid}_${expiredTimestamp}`;

      const result = authService.verifyGuestToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Guest token expired');
    });
  });

  describe('verifyToken', () => {
    it('should throw AUTH_REQUIRED for missing token', () => {
      expect(() => authService.verifyToken(null)).toThrow(AuthError);
      expect(() => authService.verifyToken(undefined)).toThrow(AuthError);

      try {
        authService.verifyToken(null);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe(AuthErrorCode.AUTH_REQUIRED);
      }
    });

    it('should return guest payload for valid guest token', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const timestamp = Date.now();
      const token = `guest_${uuid}_${timestamp}`;

      const payload = authService.verifyToken(token);

      expect(payload.isGuest).toBe(true);
      expect(payload.userId).toBe(`guest-${uuid}`);
      expect(payload.roles).toContain('guest');
      expect(payload.subscriptionTier).toBe('free');
    });

    it('should throw AUTH_EXPIRED for expired guest token', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const expiredTimestamp = Date.now() - GUEST_TOKEN_EXPIRATION_MS - 1000;
      const token = `guest_${uuid}_${expiredTimestamp}`;

      expect(() => authService.verifyToken(token)).toThrow(AuthError);

      try {
        authService.verifyToken(token);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe(AuthErrorCode.AUTH_EXPIRED);
      }
    });

    it('should throw AUTH_INVALID for invalid guest token format', () => {
      expect(() => authService.verifyToken('guest_invalid')).toThrow(AuthError);

      try {
        authService.verifyToken('guest_invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe(AuthErrorCode.AUTH_INVALID);
      }
    });

    it('should return guest payload for mock tokens', () => {
      const payload = authService.verifyToken('mock-guest-token');

      expect(payload.isGuest).toBe(true);
      expect(payload.userId).toBe('guest-user');
    });

    it('should throw AUTH_INVALID for invalid JWT token', () => {
      expect(() => authService.verifyToken('invalid-jwt-token')).toThrow(AuthError);

      try {
        authService.verifyToken('invalid-jwt-token');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe(AuthErrorCode.AUTH_INVALID);
      }
    });

    it('should verify valid JWT token', () => {
      const token = authService.generateToken('user-123', 'test@example.com', 'free', ['user']);
      const payload = authService.verifyToken(token);

      expect(payload.isGuest).toBe(false);
      expect(payload.userId).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
    });
  });

  describe('verifyTokenSafe', () => {
    it('should return success for valid token', () => {
      const token = authService.generateToken('user-123', 'test@example.com');
      const result = authService.verifyTokenSafe(token);

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid token', () => {
      const result = authService.verifyTokenSafe('invalid-token');

      expect(result.success).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(AuthErrorCode.AUTH_INVALID);
    });

    it('should return error for missing token', () => {
      const result = authService.verifyTokenSafe(null);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AuthErrorCode.AUTH_REQUIRED);
    });
  });

  /**
   * Property-Based Tests
   *
   * **Feature: websocket-connection-timeout-fix, Property 4: Guest session creation**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * For any connection with a guest token, the server must create a session
   * with `isGuest: true` and emit `session_created`.
   */
  describe('Property 4: Guest session creation', () => {
    /**
     * Generator for valid UUID v4 strings
     */
    const uuidV4Arb = fc
      .tuple(
        fc.hexaString({ minLength: 8, maxLength: 8 }),
        fc.hexaString({ minLength: 4, maxLength: 4 }),
        fc.hexaString({ minLength: 3, maxLength: 3 }),
        fc.hexaString({ minLength: 3, maxLength: 3 }),
        fc.hexaString({ minLength: 12, maxLength: 12 })
      )
      .map(([a, b, c, d, e]) => {
        // Ensure UUID v4 format: 4xxx for version, [89ab]xxx for variant
        const version = '4' + c.slice(0, 3);
        const variant = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)] + d.slice(0, 3);
        return `${a}-${b}-${version}-${variant}-${e}`;
      });

    /**
     * Generator for valid guest tokens (non-expired)
     */
    const validGuestTokenArb = fc
      .tuple(uuidV4Arb, fc.integer({ min: 0, max: GUEST_TOKEN_EXPIRATION_MS - 1000 }))
      .map(([uuid, ageMs]) => {
        const timestamp = Date.now() - ageMs;
        return `guest_${uuid}_${timestamp}`;
      });

    /**
     * Generator for expired guest tokens
     */
    const expiredGuestTokenArb = fc
      .tuple(
        uuidV4Arb,
        fc.integer({ min: GUEST_TOKEN_EXPIRATION_MS + 1000, max: GUEST_TOKEN_EXPIRATION_MS * 10 })
      )
      .map(([uuid, ageMs]) => {
        const timestamp = Date.now() - ageMs;
        return `guest_${uuid}_${timestamp}`;
      });

    it('should create guest session with isGuest: true for any valid guest token', () => {
      fc.assert(
        fc.property(validGuestTokenArb, (token) => {
          const result = authService.verifyTokenSafe(token);

          // Must succeed
          if (!result.success) {
            return false;
          }

          // Must have isGuest: true
          if (!result.payload?.isGuest) {
            return false;
          }

          // Must have guest role
          if (!result.payload.roles.includes('guest')) {
            return false;
          }

          // Must have free subscription tier
          if (result.payload.subscriptionTier !== 'free') {
            return false;
          }

          // Must have limited permissions
          const hasConversationCreate = result.payload.permissions.includes('conversation:create');
          const hasConversationRead = result.payload.permissions.includes('conversation:read');

          return hasConversationCreate && hasConversationRead;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject expired guest tokens with AUTH_EXPIRED error', () => {
      fc.assert(
        fc.property(expiredGuestTokenArb, (token) => {
          const result = authService.verifyTokenSafe(token);

          // Must fail
          if (result.success) {
            return false;
          }

          // Must have AUTH_EXPIRED error code
          return result.error?.code === AuthErrorCode.AUTH_EXPIRED;
        }),
        { numRuns: 100 }
      );
    });

    it('should always return isGuest: true for guest tokens and isGuest: false for JWT tokens', () => {
      // Test with guest tokens
      fc.assert(
        fc.property(validGuestTokenArb, (guestToken) => {
          const result = authService.verifyTokenSafe(guestToken);
          return result.success && result.payload?.isGuest === true;
        }),
        { numRuns: 50 }
      );

      // Test with JWT tokens
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.emailAddress(),
          (userId, email) => {
            const jwtToken = authService.generateToken(userId, email);
            const result = authService.verifyTokenSafe(jwtToken);
            return result.success && result.payload?.isGuest === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should extract correct UUID from guest token', () => {
      fc.assert(
        fc.property(validGuestTokenArb, (token) => {
          const result = authService.verifyTokenSafe(token);

          if (!result.success || !result.payload) {
            return false;
          }

          // Extract UUID from token
          const parts = token.split('_');
          const timestampStr = parts[parts.length - 1];
          const expectedUuid = token.slice(6, -(timestampStr.length + 1));

          // User ID should be guest-<uuid>
          return result.payload.userId === `guest-${expectedUuid}`;
        }),
        { numRuns: 100 }
      );
    });
  });
});
