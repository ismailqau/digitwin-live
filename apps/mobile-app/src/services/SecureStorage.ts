/**
 * Secure Storage Service
 *
 * Manages secure storage of sensitive data using expo-secure-store.
 * - Stores JWT access token and refresh token securely
 * - Provides methods for token management
 * - Handles token clearing on logout
 */

// Safely import expo-secure-store
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SecureStore: any = null;
try {
  SecureStore = require('expo-secure-store');
} catch (error) {
  console.warn('[SecureStorage] Failed to load expo-secure-store:', error);
}

const ACCESS_TOKEN_KEY = 'digitwin_access_token';
const REFRESH_TOKEN_KEY = 'digitwin_refresh_token';
const BIOMETRIC_ENABLED_KEY = 'digitwin_biometric_enabled';

export class SecureStorage {
  /**
   * Store access token securely
   */
  static async setAccessToken(token: string): Promise<void> {
    if (!SecureStore) return;
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    } catch (error) {
      console.error('[SecureStorage] Error storing access token:', error);
      throw error;
    }
  }

  /**
   * Get access token from secure storage
   */
  static async getAccessToken(): Promise<string | null> {
    if (!SecureStore) return null;
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('[SecureStorage] Error retrieving access token:', error);
      return null;
    }
  }

  /**
   * Store refresh token securely
   */
  static async setRefreshToken(token: string): Promise<void> {
    if (!SecureStore) return;
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error('[SecureStorage] Error storing refresh token:', error);
      throw error;
    }
  }

  /**
   * Get refresh token from secure storage
   */
  static async getRefreshToken(): Promise<string | null> {
    if (!SecureStore) return null;
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('[SecureStorage] Error retrieving refresh token:', error);
      return null;
    }
  }

  /**
   * Store both access and refresh tokens
   */
  static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStorage.setAccessToken(accessToken),
      SecureStorage.setRefreshToken(refreshToken),
    ]);
  }

  /**
   * Clear all tokens (on logout)
   */
  static async clearTokens(): Promise<void> {
    if (!SecureStore) return;
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      ]);
    } catch (error) {
      console.error('[SecureStorage] Error clearing tokens:', error);
      throw error;
    }
  }

  /**
   * Set biometric authentication preference
   */
  static async setBiometricEnabled(enabled: boolean): Promise<void> {
    if (!SecureStore) return;
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('[SecureStorage] Error storing biometric preference:', error);
      throw error;
    }
  }

  /**
   * Get biometric authentication preference
   */
  static async getBiometricEnabled(): Promise<boolean> {
    if (!SecureStore) return false;
    try {
      const result = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return result === 'true';
    } catch (error) {
      console.error('[SecureStorage] Error retrieving biometric preference:', error);
      return false;
    }
  }

  /**
   * Check if tokens exist
   */
  static async hasTokens(): Promise<boolean> {
    const accessToken = await SecureStorage.getAccessToken();
    const refreshToken = await SecureStorage.getRefreshToken();
    return !!(accessToken && refreshToken);
  }
}
