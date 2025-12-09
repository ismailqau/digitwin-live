// WebSocket Server test setup
import 'reflect-metadata';
import '../../jest.setup.base';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock uuid to avoid ESM issues
// Mock uuid to avoid ESM issues
jest.mock('uuid', () => {
  const generator = () => `test-uuid-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return {
    __esModule: true,
    v4: jest.fn(generator),
    default: { v4: jest.fn(generator) },
  };
});

// Mock logger
jest.mock('@clone/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
