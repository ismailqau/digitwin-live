// Audio constants
export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_CHUNK_DURATION_MS = 100;
export const AUDIO_FORMAT = 'pcm16';

// Video constants
export const VIDEO_FPS = 20;
export const VIDEO_RESOLUTION = { width: 512, height: 512 };
export const VIDEO_FORMAT = 'h264';

// Latency targets (milliseconds)
export const LATENCY_TARGETS = {
  ASR: 300,
  RAG: 200,
  LLM_FIRST_TOKEN: 1000,
  TTS_FIRST_CHUNK: 500,
  LIPSYNC: 300,
  END_TO_END: 2000,
} as const;

// Rate limits
export const RATE_LIMITS = {
  FREE: {
    conversationMinutesPerDay: 60,
    documentsPerMonth: 10,
    voiceModelsPerAccount: 1,
    requestsPerMinute: 10,
  },
  PRO: {
    conversationMinutesPerDay: null,
    documentsPerMonth: 100,
    voiceModelsPerAccount: 5,
    requestsPerMinute: 60,
  },
  ENTERPRISE: {
    conversationMinutesPerDay: null,
    documentsPerMonth: null,
    voiceModelsPerAccount: null,
    requestsPerMinute: 300,
  },
} as const;

// Vector search constants
export const VECTOR_SEARCH = {
  TOP_K: 5,
  SIMILARITY_THRESHOLD: 0.7,
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 100,
} as const;

// Conversation constants
export const CONVERSATION = {
  HISTORY_LENGTH: 5,
  MAX_CONTEXT_TOKENS: 8000,
  SILENCE_TIMEOUT_MS: 500,
  MAX_SESSION_DURATION_HOURS: 2,
} as const;

// File upload limits
export const UPLOAD_LIMITS = {
  MAX_DOCUMENT_SIZE_MB: 50,
  MAX_VOICE_SAMPLE_SIZE_MB: 100,
  MAX_FACE_MEDIA_SIZE_MB: 200,
  SUPPORTED_DOCUMENT_TYPES: ['pdf', 'docx', 'txt', 'html', 'md'],
  SUPPORTED_IMAGE_TYPES: ['jpg', 'jpeg', 'png'],
  SUPPORTED_VIDEO_TYPES: ['mp4', 'mov'],
} as const;

// Quality thresholds
export const QUALITY_THRESHOLDS = {
  VOICE_SIMILARITY_MIN: 0.85,
  FACE_QUALITY_MIN: 70,
  TRANSCRIPT_CONFIDENCE_MIN: 0.8,
  AUDIO_SNR_MIN_DB: 20,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// Cache TTL (seconds)
export const CACHE_TTL = {
  EMBEDDINGS: 3600,
  COMMON_RESPONSES: 1800,
  VOICE_MODELS: 7200,
  FACE_MODELS: 7200,
  SEARCH_RESULTS: 600,
} as const;
