// asr service test setup
import '../../jest.setup.base';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock Google Cloud Speech Client - use manual mock
jest.mock('@google-cloud/speech');

// Mock logger
jest.mock('@clone/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Ensure all timers and async operations are cleaned up
afterEach(() => {
  jest.clearAllTimers();
});
