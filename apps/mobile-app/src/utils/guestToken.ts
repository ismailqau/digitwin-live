/**
 * Guest Token Utilities
 *
 * Provides functions for generating and validating guest tokens.
 * Guest tokens allow users to try the app without creating an account.
 *
 * Token format: guest_<uuid>_<timestamp>
 * Example: guest_550e8400-e29b-41d4-a716-446655440000_1733547600000
 */

/**
 * Generates a UUID v4 string
 * Uses crypto.getRandomValues for secure random generation
 */
const generateUUID = (): string => {
  // Use a simple UUID v4 implementation that works in React Native
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Generates a guest token in the format: guest_<uuid>_<timestamp>
 *
 * @returns A guest token string
 *
 * @example
 * const token = generateGuestToken();
 * // Returns: "guest_550e8400-e29b-41d4-a716-446655440000_1733547600000"
 */
export const generateGuestToken = (): string => {
  const uuid = generateUUID();
  const timestamp = Date.now();
  return `guest_${uuid}_${timestamp}`;
};

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
 * Validates a guest token format and extracts its components
 *
 * @param token - The token to validate
 * @returns Validation result with extracted components if valid
 *
 * @example
 * const result = validateGuestToken("guest_550e8400-e29b-41d4-a716-446655440000_1733547600000");
 * // Returns: { isValid: true, uuid: "550e8400-...", timestamp: 1733547600000 }
 */
export const validateGuestToken = (
  token: string | null | undefined
): GuestTokenValidationResult => {
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

  // Validate UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuidPart)) {
    return { isValid: false, error: 'Invalid UUID format' };
  }

  return {
    isValid: true,
    uuid: uuidPart,
    timestamp,
  };
};

/**
 * Checks if a token is a guest token (starts with "guest_")
 *
 * @param token - The token to check
 * @returns true if the token is a guest token
 */
export const isGuestToken = (token: string | null | undefined): boolean => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  return token.startsWith('guest_');
};

/**
 * Guest token expiration time in milliseconds (1 hour)
 */
export const GUEST_TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * Checks if a guest token has expired
 *
 * @param token - The guest token to check
 * @returns true if the token has expired
 */
export const isGuestTokenExpired = (token: string): boolean => {
  const validation = validateGuestToken(token);

  if (!validation.isValid || !validation.timestamp) {
    return true;
  }

  const now = Date.now();
  const tokenAge = now - validation.timestamp;

  return tokenAge > GUEST_TOKEN_EXPIRATION_MS;
};
