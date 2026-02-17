/**
 * Environment Configuration
 *
 * Provides access to environment variables in Expo/React Native.
 * In __DEV__ mode, defaults point to local services on the LAN IP
 * so a physical device can reach the dev machine.
 */

import Constants from 'expo-constants';

// Get environment variables from expo-constants
const expoConfig = Constants.expoConfig;
const extra = expoConfig?.extra || {};

// LAN IP of the dev machine — update if your network changes
const LOCAL_HOST = '192.168.20.208';

// Production (GCP Cloud Run) defaults
const PROD_API_URL = 'https://api-gateway-yrzc7r3fcq-uc.a.run.app';
const PROD_WS_URL = 'wss://websocket-server-yrzc7r3fcq-uc.a.run.app';
const PROD_FACE_URL = 'https://face-processing-service-yrzc7r3fcq-uc.a.run.app';

// Local development defaults (Docker containers on dev machine)
const LOCAL_API_URL = `http://${LOCAL_HOST}:3000`;
const LOCAL_WS_URL = `ws://${LOCAL_HOST}:3001`;
const LOCAL_FACE_URL = `http://${LOCAL_HOST}:8001`;
const LOCAL_LIPSYNC_URL = `http://${LOCAL_HOST}:8001`;

const isLocal = __DEV__;

const getWebSocketUrl = (): string => {
  return extra.WEBSOCKET_URL || process.env.WEBSOCKET_URL || (isLocal ? LOCAL_WS_URL : PROD_WS_URL);
};

export const ENV = {
  API_URL: extra.API_URL || process.env.API_URL || (isLocal ? LOCAL_API_URL : PROD_API_URL),
  WEBSOCKET_URL: getWebSocketUrl(),
  FACE_PROCESSING_URL:
    extra.FACE_PROCESSING_URL ||
    process.env.FACE_PROCESSING_URL ||
    (isLocal ? LOCAL_FACE_URL : PROD_FACE_URL),
  LIPSYNC_SERVICE_URL:
    extra.LIPSYNC_SERVICE_URL ||
    process.env.LIPSYNC_SERVICE_URL ||
    (isLocal ? LOCAL_LIPSYNC_URL : PROD_FACE_URL),
  ENVIRONMENT:
    extra.ENVIRONMENT || process.env.ENVIRONMENT || (isLocal ? 'development' : 'production'),
  DEBUG: extra.DEBUG === 'true' || process.env.DEBUG === 'true' || isLocal,
};

// Log configuration in development
if (__DEV__) {
  console.log('[ENV] Configuration loaded:', {
    API_URL: ENV.API_URL,
    WEBSOCKET_URL: ENV.WEBSOCKET_URL,
    FACE_PROCESSING_URL: ENV.FACE_PROCESSING_URL,
    LIPSYNC_SERVICE_URL: ENV.LIPSYNC_SERVICE_URL,
    ENVIRONMENT: ENV.ENVIRONMENT,
    DEBUG: ENV.DEBUG,
  });
}

export default ENV;
