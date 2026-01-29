/**
 * Biometric Authentication Service
 *
 * Handles Face ID/Touch ID authentication using expo-local-authentication.
 * - Checks biometric availability
 * - Prompts for biometric authentication
 * - Handles fallback to passcode/pin where applicable via system fallback
 */

import type * as LocalAuthType from 'expo-local-authentication';

// Safely import expo-local-authentication to prevent crash if native module is missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let LocalAuthentication: any = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch (error) {
  console.warn('[BiometricAuth] Failed to load expo-local-authentication:', error);
}

export class BiometricAuth {
  /**
   * Internal check for native module availability
   */
  private static isModuleAvailable(): boolean {
    if (!LocalAuthentication) return false;
    // Check for some essential methods that should exist if the native module is linked
    return typeof LocalAuthentication.hasHardwareAsync === 'function';
  }

  /**
   * Check if biometric authentication is available on the device
   */
  static async isBiometricAvailable(): Promise<boolean> {
    if (!BiometricAuth.isModuleAvailable()) {
      console.warn('[BiometricAuth] Native module LocalAuthentication not found.');
      return false;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        console.log('[BiometricAuth] Biometric hardware available and enrolled.');
        return true;
      }

      console.log('[BiometricAuth] Biometrics unavailable:', { hasHardware, isEnrolled });
      return false;
    } catch (error) {
      console.error('[BiometricAuth] Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Get the type of biometric authentication available
   */
  static async getBiometricType(): Promise<LocalAuthType.AuthenticationType[] | null> {
    if (!BiometricAuth.isModuleAvailable()) return null;
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types.length > 0 ? types : null;
    } catch (error) {
      console.error('[BiometricAuth] Error getting biometric type:', error);
      return null;
    }
  }

  /**
   * Prompt for biometric authentication
   */
  static async authenticate(promptMessage: string = 'Authenticate'): Promise<boolean> {
    if (!BiometricAuth.isModuleAvailable()) {
      console.warn('[BiometricAuth] Native module LocalAuthentication not found.');
      return false;
    }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        return true;
      }

      console.warn('[BiometricAuth] Authentication failed or cancelled', result);
      return false;
    } catch (error) {
      console.error('[BiometricAuth] Authentication error:', error);
      return false;
    }
  }

  /**
   * Get user-friendly biometric type name
   */
  static async getBiometricTypeName(): Promise<string> {
    const types = await BiometricAuth.getBiometricType();

    if (!types || types.length === 0) {
      return 'Biometric Authentication';
    }

    const authTypes = LocalAuthentication?.AuthenticationType;
    if (authTypes) {
      if (types.includes(authTypes.FACIAL_RECOGNITION)) {
        return 'Face ID';
      }
      if (types.includes(authTypes.FINGERPRINT)) {
        return 'Touch ID';
      }
      if (types.includes(authTypes.IRIS)) {
        return 'Iris Scan';
      }
    }

    return 'Biometric Authentication';
  }
}
