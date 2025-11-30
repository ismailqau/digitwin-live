// face processing service test setup
import '../../jest.setup.base';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock logger
jest.mock('@clone/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock shared-types constants
jest.mock('@clone/shared-types', () => ({
  FACE_QUALITY_THRESHOLDS: {
    MIN_CONFIDENCE: 0.8,
    MIN_FACE_SIZE: 100,
    MIN_RESOLUTION: 256,
    MAX_YAW: 30,
    MAX_PITCH: 25,
    MAX_ROLL: 20,
    MIN_BLUR_SCORE: 0.6,
    MIN_LIGHTING_SCORE: 0.5,
    MIN_OVERALL_QUALITY: 70,
  },
  FACE_LANDMARK_INDICES: {
    LEFT_EYE_CENTER: 468,
    RIGHT_EYE_CENTER: 473,
    LEFT_EYE_INNER: 133,
    LEFT_EYE_OUTER: 33,
    RIGHT_EYE_INNER: 362,
    RIGHT_EYE_OUTER: 263,
    LEFT_EYEBROW_INNER: 107,
    LEFT_EYEBROW_OUTER: 70,
    RIGHT_EYEBROW_INNER: 336,
    RIGHT_EYEBROW_OUTER: 300,
    NOSE_TIP: 1,
    NOSE_BRIDGE: 6,
    NOSE_LEFT: 129,
    NOSE_RIGHT: 358,
    MOUTH_LEFT: 61,
    MOUTH_RIGHT: 291,
    MOUTH_TOP: 13,
    MOUTH_BOTTOM: 14,
    UPPER_LIP_TOP: 0,
    LOWER_LIP_BOTTOM: 17,
    CHIN: 152,
    LEFT_CHEEK: 234,
    RIGHT_CHEEK: 454,
    FOREHEAD: 10,
    JAW_LEFT: 172,
    JAW_RIGHT: 397,
  },
}));
