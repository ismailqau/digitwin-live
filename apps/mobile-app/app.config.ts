import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: config.name || 'DigiTwin Live',
    plugins: [
      ...(config.plugins || []),
      'expo-audio',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'Allow $(PRODUCT_NAME) to use Face ID for secure login.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera to capture your face.',
          microphonePermission:
            'Allow $(PRODUCT_NAME) to access your microphone to record your voice.',
          recordAudioAndroid: true,
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission: 'Allow $(PRODUCT_NAME) to access your photos.',
          savePhotosPermission: 'Allow $(PRODUCT_NAME) to save photos.',
          isAccessMediaLocationEnabled: true,
        },
      ],
    ],
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
