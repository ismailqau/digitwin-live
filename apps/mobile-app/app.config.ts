import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: config.name || 'DigiTwin Live',
    plugins: [...(config.plugins || []), 'expo-audio'],
    slug: config.slug || 'digitwin-live',
    extra: {
      ...config.extra,
      // Use process.env if set, otherwise fall back to config.extra (from app.json)
      API_URL: process.env.API_URL || config.extra?.API_URL,
      WEBSOCKET_URL: process.env.WEBSOCKET_URL || config.extra?.WEBSOCKET_URL,
      FACE_PROCESSING_URL: process.env.FACE_PROCESSING_URL || config.extra?.FACE_PROCESSING_URL,
      LIPSYNC_SERVICE_URL: process.env.LIPSYNC_SERVICE_URL || config.extra?.LIPSYNC_SERVICE_URL,
      ENVIRONMENT: process.env.ENVIRONMENT || config.extra?.ENVIRONMENT || 'development',
      DEBUG: process.env.DEBUG || config.extra?.DEBUG || 'false',
    },
  };
};
