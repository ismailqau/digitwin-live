// lipsync service test setup
import '../../jest.setup.base';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('@clone/logger', () => ({
  createLogger: jest.fn(() => mockLogger),
  logger: mockLogger,
}));

// Mock Google Cloud Storage
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        exists: jest.fn().mockResolvedValue([false]),
        download: jest.fn().mockResolvedValue([Buffer.from('{}')]),
      }),
    }),
  })),
}));
