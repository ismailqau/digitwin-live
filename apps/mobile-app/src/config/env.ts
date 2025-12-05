/**
 * Environment Configuration
 *
 * Provides access to environment variables in Expo/React Native
 */

import Constants from 'expo-constants';

// Get environment variables from expo-constants
const expoConfig = Constants.expoConfig;
const extra = expoConfig?.extra || {};

export const ENV = {
  API_URL: extra.API_URL || process.env.API_URL || 'http://localhost:3000',
  WEBSOCKET_URL: extra.WEBSOCKET_URL || process.env.WEBSOCKET_URL || 'http://localhost:3001',
  FACE_PROCESSING_URL:
    extra.FACE_PROCESSING_URL || process.env.FACE_PROCESSING_URL || 'http://localhost:3002',
  LIPSYNC_SERVICE_URL:
    extra.LIPSYNC_SERVICE_URL || process.env.LIPSYNC_SERVICE_URL || 'http://localhost:3003',
  ENVIRONMENT: extra.ENVIRONMENT || process.env.ENVIRONMENT || 'development',
  DEBUG: extra.DEBUG === 'true' || process.env.DEBUG === 'true' || false,
};

// Log configuration in development
if (__DEV__) {
  console.log('[ENV] Configuration loaded:', {
    API_URL: ENV.API_URL,
    WEBSOCKET_URL: ENV.WEBSOCKET_URL,
    ENVIRONMENT: ENV.ENVIRONMENT,
    DEBUG: ENV.DEBUG,
  });
}

export default ENV;
