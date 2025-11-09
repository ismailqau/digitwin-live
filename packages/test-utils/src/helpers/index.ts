// Test helper functions

/**
 * Wait for a condition to be true
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
};

/**
 * Sleep for a specified duration
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Create a mock function that resolves after a delay
 */
export const createDelayedMock = <T>(value: T, delay = 100) => {
  return jest
    .fn()
    .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(value), delay)));
};

/**
 * Create a mock function that rejects after a delay
 */
export const createDelayedReject = (error: Error, delay = 100) => {
  return jest
    .fn()
    .mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(error), delay)));
};

/**
 * Suppress console output during tests
 */
export const suppressConsole = () => {
  const originalConsole = { ...console };

  beforeAll(() => {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  afterAll(() => {
    global.console = originalConsole;
  });
};

/**
 * Mock environment variables
 */
export const mockEnv = (vars: Record<string, string>) => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    Object.assign(process.env, vars);
  });

  afterAll(() => {
    process.env = originalEnv;
  });
};
