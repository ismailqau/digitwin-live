/**
 * Guest Token Tests
 *
 * Tests for guest token generation and validation utilities
 */

import {
  generateGuestToken,
  validateGuestToken,
  isGuestToken,
  isGuestTokenExpired,
  GUEST_TOKEN_EXPIRATION_MS,
} from '../utils/guestToken';

describe('generateGuestToken', () => {
  it('should generate a token in the correct format', () => {
    const token = generateGuestToken();

    expect(token).toMatch(
      /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_\d+$/i
    );
  });

  it('should generate unique tokens', () => {
    const token1 = generateGuestToken();
    const token2 = generateGuestToken();

    expect(token1).not.toBe(token2);
  });

  it('should include a valid timestamp', () => {
    const before = Date.now();
    const token = generateGuestToken();
    const after = Date.now();

    const parts = token.split('_');
    const timestamp = parseInt(parts[parts.length - 1], 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should start with "guest_"', () => {
    const token = generateGuestToken();
    expect(token.startsWith('guest_')).toBe(true);
  });
});

describe('validateGuestToken', () => {
  it('should validate a correctly formatted token', () => {
    const token = generateGuestToken();
    const result = validateGuestToken(token);

    expect(result.isValid).toBe(true);
    expect(result.uuid).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should reject null token', () => {
    const result = validateGuestToken(null);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Token is required');
  });

  it('should reject undefined token', () => {
    const result = validateGuestToken(undefined);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Token is required');
  });

  it('should reject empty string', () => {
    const result = validateGuestToken('');

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Token is required');
  });

  it('should reject token without guest_ prefix', () => {
    const result = validateGuestToken('invalid_550e8400-e29b-41d4-a716-446655440000_1733547600000');

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Token must start with "guest_"');
  });

  it('should reject token with invalid UUID', () => {
    const result = validateGuestToken('guest_invalid-uuid_1733547600000');

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid UUID format');
  });

  it('should reject token with invalid timestamp', () => {
    const result = validateGuestToken('guest_550e8400-e29b-41d4-a716-446655440000_invalid');

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid timestamp');
  });

  it('should reject token with negative timestamp', () => {
    const result = validateGuestToken('guest_550e8400-e29b-41d4-a716-446655440000_-1');

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid timestamp');
  });

  it('should extract correct UUID from token', () => {
    const token = 'guest_550e8400-e29b-41d4-a716-446655440000_1733547600000';
    const result = validateGuestToken(token);

    expect(result.isValid).toBe(true);
    expect(result.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should extract correct timestamp from token', () => {
    const token = 'guest_550e8400-e29b-41d4-a716-446655440000_1733547600000';
    const result = validateGuestToken(token);

    expect(result.isValid).toBe(true);
    expect(result.timestamp).toBe(1733547600000);
  });
});

describe('isGuestToken', () => {
  it('should return true for guest tokens', () => {
    const token = generateGuestToken();
    expect(isGuestToken(token)).toBe(true);
  });

  it('should return true for any string starting with guest_', () => {
    expect(isGuestToken('guest_anything')).toBe(true);
  });

  it('should return false for JWT tokens', () => {
    expect(
      isGuestToken(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      )
    ).toBe(false);
  });

  it('should return false for null', () => {
    expect(isGuestToken(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isGuestToken(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isGuestToken('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    // @ts-expect-error Testing invalid input
    expect(isGuestToken(123)).toBe(false);
    // @ts-expect-error Testing invalid input
    expect(isGuestToken({})).toBe(false);
  });
});

describe('isGuestTokenExpired', () => {
  it('should return false for a freshly generated token', () => {
    const token = generateGuestToken();
    expect(isGuestTokenExpired(token)).toBe(false);
  });

  it('should return true for an expired token', () => {
    // Create a token with a timestamp from 2 hours ago
    const expiredTimestamp = Date.now() - 2 * 60 * 60 * 1000;
    const token = `guest_550e8400-e29b-41d4-a716-446655440000_${expiredTimestamp}`;

    expect(isGuestTokenExpired(token)).toBe(true);
  });

  it('should return true for invalid tokens', () => {
    expect(isGuestTokenExpired('invalid-token')).toBe(true);
    expect(isGuestTokenExpired('')).toBe(true);
  });

  it('should use correct expiration time', () => {
    // Token just under expiration time should be valid
    const justUnderExpiration = Date.now() - (GUEST_TOKEN_EXPIRATION_MS - 1000);
    const validToken = `guest_550e8400-e29b-41d4-a716-446655440000_${justUnderExpiration}`;
    expect(isGuestTokenExpired(validToken)).toBe(false);

    // Token just over expiration time should be expired
    const justOverExpiration = Date.now() - (GUEST_TOKEN_EXPIRATION_MS + 1000);
    const expiredToken = `guest_550e8400-e29b-41d4-a716-446655440000_${justOverExpiration}`;
    expect(isGuestTokenExpired(expiredToken)).toBe(true);
  });
});

describe('GUEST_TOKEN_EXPIRATION_MS', () => {
  it('should be 1 hour in milliseconds', () => {
    expect(GUEST_TOKEN_EXPIRATION_MS).toBe(60 * 60 * 1000);
  });
});
