/**
 * Biometric Authentication Service
 *
 * Handles Face ID/Touch ID authentication using expo-local-authentication.
 * - Checks biometric availability
 * - Prompts for biometric authentication
 * - Handles fallback to passcode/pin where applicable via system fallback
 */

import * as LocalAuthentication from 'expo-local-authentication';

export class BiometricAuth {
  /**
   * Check if biometric authentication is available on the device
   */
  static async isBiometricAvailable(): Promise<boolean> {
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
  static async getBiometricType(): Promise<LocalAuthentication.AuthenticationType[] | null> {
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

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris Scan';
    }

    return 'Biometric Authentication';
  }
}
