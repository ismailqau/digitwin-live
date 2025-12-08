/**
 * Environment Configuration
 *
 * Provides access to environment variables in Expo/React Native
 */

import Constants from 'expo-constants';

// Get environment variables from expo-constants
const expoConfig = Constants.expoConfig;
const extra = expoConfig?.extra || {};

// Native WebSocket uses wss:// for secure connections
const getWebSocketUrl = () => {
  return (
    extra.WEBSOCKET_URL ||
    process.env.WEBSOCKET_URL ||
    'https://websocket-server-yrzc7r3fcq-uc.a.run.app'
  );
};

export const ENV = {
  API_URL: extra.API_URL || process.env.API_URL || 'https://api-gateway-yrzc7r3fcq-uc.a.run.app',
  WEBSOCKET_URL: getWebSocketUrl(),
  FACE_PROCESSING_URL:
    extra.FACE_PROCESSING_URL ||
    process.env.FACE_PROCESSING_URL ||
    'https://face-processing-service-yrzc7r3fcq-uc.a.run.app',
  LIPSYNC_SERVICE_URL:
    extra.LIPSYNC_SERVICE_URL ||
    process.env.LIPSYNC_SERVICE_URL ||
    'https://face-processing-service-yrzc7r3fcq-uc.a.run.app',
  ENVIRONMENT: extra.ENVIRONMENT || process.env.ENVIRONMENT || 'production',
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
  console.log('[ENV] Raw sources:', {
    'extra.WEBSOCKET_URL': extra.WEBSOCKET_URL,
    'process.env.WEBSOCKET_URL': process.env.WEBSOCKET_URL,
    'Constants.expoConfig': Constants.expoConfig?.extra,
  });
}

export default ENV;
