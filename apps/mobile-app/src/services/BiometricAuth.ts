/**
 * Biometric Authentication Service
 *
 * Handles Face ID/Touch ID authentication using react-native-biometrics.
 * - Checks biometric availability
 * - Prompts for biometric authentication
 * - Handles fallback to password
 */

import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

export class BiometricAuth {
  /**
   * Check if biometric authentication is available on the device
   */
  static async isBiometricAvailable(): Promise<boolean> {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      if (available) {
        console.log('[BiometricAuth] Biometric type available:', biometryType);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[BiometricAuth] Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Get the type of biometric authentication available
   */
  static async getBiometricType(): Promise<
    (typeof BiometryTypes)[keyof typeof BiometryTypes] | null
  > {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      if (available && biometryType) {
        return biometryType;
      }

      return null;
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
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel',
      });

      return success;
    } catch (error) {
      console.error('[BiometricAuth] Authentication error:', error);
      return false;
    }
  }

  /**
   * Get user-friendly biometric type name
   */
  static async getBiometricTypeName(): Promise<string> {
    const biometryType = await BiometricAuth.getBiometricType();

    switch (biometryType) {
      case BiometryTypes.FaceID:
        return 'Face ID';
      case BiometryTypes.TouchID:
        return 'Touch ID';
      case BiometryTypes.Biometrics:
        return 'Biometrics';
      default:
        return 'Biometric Authentication';
    }
  }
}
