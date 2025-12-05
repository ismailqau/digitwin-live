/**
 * Secure Storage Service
 *
 * Manages secure storage of sensitive data using react-native-keychain.
 * - Stores JWT access token and refresh token securely
 * - Provides methods for token management
 * - Handles token clearing on logout
 */

import * as Keychain from 'react-native-keychain';

const ACCESS_TOKEN_KEY = 'digitwin_access_token';
const REFRESH_TOKEN_KEY = 'digitwin_refresh_token';
const BIOMETRIC_ENABLED_KEY = 'digitwin_biometric_enabled';

export class SecureStorage {
  /**
   * Store access token securely
   */
  static async setAccessToken(token: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(ACCESS_TOKEN_KEY, token, {
        service: ACCESS_TOKEN_KEY,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
    } catch (error) {
      console.error('[SecureStorage] Error storing access token:', error);
      throw error;
    }
  }

  /**
   * Get access token from secure storage
   */
  static async getAccessToken(): Promise<string | null> {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 2000);
      });

      const credentialsPromise = Keychain.getGenericPassword({
        service: ACCESS_TOKEN_KEY,
      });

      const credentials = await Promise.race([credentialsPromise, timeoutPromise]);

      if (credentials && typeof credentials !== 'boolean') {
        return credentials.password;
      }

      return null;
    } catch (error) {
      console.error('[SecureStorage] Error retrieving access token:', error);
      return null;
    }
  }

  /**
   * Store refresh token securely
   */
  static async setRefreshToken(token: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(REFRESH_TOKEN_KEY, token, {
        service: REFRESH_TOKEN_KEY,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
    } catch (error) {
      console.error('[SecureStorage] Error storing refresh token:', error);
      throw error;
    }
  }

  /**
   * Get refresh token from secure storage
   */
  static async getRefreshToken(): Promise<string | null> {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 2000);
      });

      const credentialsPromise = Keychain.getGenericPassword({
        service: REFRESH_TOKEN_KEY,
      });

      const credentials = await Promise.race([credentialsPromise, timeoutPromise]);

      if (credentials && typeof credentials !== 'boolean') {
        return credentials.password;
      }

      return null;
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
    try {
      await Promise.all([
        Keychain.resetGenericPassword({ service: ACCESS_TOKEN_KEY }),
        Keychain.resetGenericPassword({ service: REFRESH_TOKEN_KEY }),
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
    try {
      await Keychain.setGenericPassword(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false', {
        service: BIOMETRIC_ENABLED_KEY,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
    } catch (error) {
      console.error('[SecureStorage] Error storing biometric preference:', error);
      throw error;
    }
  }

  /**
   * Get biometric authentication preference
   */
  static async getBiometricEnabled(): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: BIOMETRIC_ENABLED_KEY,
      });

      if (credentials && typeof credentials !== 'boolean') {
        return credentials.password === 'true';
      }

      return false;
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
