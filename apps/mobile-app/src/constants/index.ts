/**
 * App Constants
 *
 * Application-wide constants and configuration values
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.API_URL || 'http://localhost:3000',
  WEBSOCKET_URL: process.env.WEBSOCKET_URL || 'ws://localhost:3001',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// Audio Configuration
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000, // 16 kHz
  CHANNELS: 1, // Mono
  BIT_DEPTH: 16,
  CHUNK_DURATION_MS: 100, // 100ms chunks
  VAD_SILENCE_THRESHOLD_MS: 500, // 500ms silence to end utterance
  MIN_RECORDING_DURATION_MS: 500, // Minimum recording duration
  MAX_RECORDING_DURATION_MS: 60000, // 1 minute max
  BUFFER_SIZE_MS: 500, // Playback buffer
};

// Voice Model Configuration
export const VOICE_MODEL_CONFIG = {
  MIN_SAMPLE_DURATION_SECONDS: 300, // 5 minutes minimum
  MAX_SAMPLE_DURATION_SECONDS: 1800, // 30 minutes maximum
  MIN_SNR_DB: 20, // Minimum signal-to-noise ratio
  SUPPORTED_FORMATS: ['wav', 'mp3', 'm4a', 'aac'],
};

// Face Model Configuration
export const FACE_MODEL_CONFIG = {
  MIN_PHOTOS: 3,
  MAX_PHOTOS: 10,
  MIN_VIDEO_DURATION_SECONDS: 30,
  MAX_VIDEO_DURATION_SECONDS: 60,
  MIN_RESOLUTION: { width: 256, height: 256 },
  PREFERRED_RESOLUTION: { width: 512, height: 512 },
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png'],
  SUPPORTED_VIDEO_FORMATS: ['mp4', 'mov'],
};

// Document Configuration
export const DOCUMENT_CONFIG = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  SUPPORTED_FORMATS: ['pdf', 'docx', 'txt', 'html', 'md'],
  MAX_DOCUMENTS_PER_USER: 100,
};

// Conversation Configuration
export const CONVERSATION_CONFIG = {
  MAX_HISTORY_TURNS: 5,
  MAX_SESSION_DURATION_MS: 2 * 60 * 60 * 1000, // 2 hours
  INTERRUPTION_DETECTION_DELAY_MS: 200,
  RESPONSE_TIMEOUT_MS: 30000, // 30 seconds
};

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION_MS: 300,
  TOAST_DURATION_MS: 3000,
  DEBOUNCE_DELAY_MS: 300,
  THROTTLE_DELAY_MS: 100,
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_PROFILE: 'user_profile',
  SETTINGS: 'settings',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  THEME_MODE: 'theme_mode',
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  AUTH_ERROR: 'Authentication failed. Please sign in again.',
  PERMISSION_DENIED: 'Permission denied. Please enable in settings.',
  RECORDING_ERROR: 'Failed to start recording. Please try again.',
  PLAYBACK_ERROR: 'Failed to play audio. Please try again.',
  UPLOAD_ERROR: 'Failed to upload. Please try again.',
  PROCESSING_ERROR: 'Processing failed. Please try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  REGISTER_SUCCESS: 'Account created successfully!',
  UPLOAD_SUCCESS: 'Upload completed successfully!',
  SAVE_SUCCESS: 'Changes saved successfully!',
  DELETE_SUCCESS: 'Deleted successfully!',
};
