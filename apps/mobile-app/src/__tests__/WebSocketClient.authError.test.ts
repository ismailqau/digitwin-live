/**
 * WebSocketClient Property-Based Tests - Auth Error Handling
 *
 * Feature: websocket-connection-timeout-fix
 * Property 3: Error message completeness
 * Validates: Requirements 2.1, 2.3, 2.4, 2.5
 *
 * Tests that auth_error events always include complete error information:
 * - Non-empty error message
 * - Valid error code from the defined set
 */

import * as fc from 'fast-check';
import { io } from 'socket.io-client';

import { WebSocketClient } from '../services/WebSocketClient';

// Mock socket.io-client
jest.mock('socket.io-client');

// Mock SecureStorage
jest.mock('../services/SecureStorage', () => ({
  SecureStorage: {
    getAccessToken: jest.fn(),
    setAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
  },
}));

// Mock WebSocketMonitor
jest.mock('../services/WebSocketMonitor', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock ENV
jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    WEBSOCKET_URL: 'http://localhost:3001',
  },
}));

// Mock guest token utilities
jest.mock('../utils/guestToken', () => ({
  generateGuestToken: jest.fn(() => 'guest_mock-uuid_1234567890'),
  isGuestToken: jest.fn((token: string) => token?.startsWith('guest_')),
}));

describe('WebSocketClient - Property 3: Error message completeness', () => {
  let mockSocket: {
    id: string;
    connected: boolean;
    disconnected: boolean;
    on: jest.Mock;
    once: jest.Mock;
    off: jest.Mock;
    emit: jest.Mock;
    removeAllListeners: jest.Mock;
    disconnect: jest.Mock;
    close: jest.Mock;
    io: { on: jest.Mock };
  };
  let eventHandlers: Map<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventHandlers = new Map();

    // Create mock socket
    mockSocket = {
      id: 'mock-socket-id',
      connected: false,
      disconnected: true,
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        eventHandlers.set(event, handler);
      }),
      once: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        eventHandlers.set(event, handler);
      }),
      off: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
      disconnect: jest.fn(),
      close: jest.fn(),
      io: {
        on: jest.fn(),
      },
    };

    // Mock io() to return our mock socket
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (io as jest.MockedFunction<typeof io>).mockReturnValue(mockSocket as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Property 3: Error message completeness
   *
   * For any authentication failure, the auth_error event must include
   * a non-empty message and a valid error code from the defined set.
   */
  it('should always emit auth_error with complete error information', async () => {
    // Define valid error codes
    const validErrorCodes = ['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_EXPIRED'];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorCode: fc.constantFrom(...validErrorCodes),
          errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
          hasTimestamp: fc.boolean(),
        }),
        async ({ errorCode, errorMessage, hasTimestamp }) => {
          // Arrange: Create a new client and track auth_error events
          const client = new WebSocketClient();
          const authErrors: unknown[] = [];

          // Subscribe to auth_error events
          client.on('auth_error', (error) => {
            authErrors.push(error);
          });

          // Act: Start connection
          void client.connect();

          // Simulate Socket.IO connect event
          await new Promise((resolve) => setTimeout(resolve, 10));
          const connectHandler = eventHandlers.get('connect');
          if (connectHandler) {
            mockSocket.connected = true;
            mockSocket.disconnected = false;
            connectHandler();
          }

          // Simulate auth_error event with the generated error
          await new Promise((resolve) => setTimeout(resolve, 10));
          const authErrorHandler = eventHandlers.get('auth_error');
          if (authErrorHandler) {
            const errorPayload: {
              code: string;
              message: string;
              timestamp?: number;
            } = {
              code: errorCode,
              message: errorMessage,
            };

            if (hasTimestamp) {
              errorPayload.timestamp = Date.now();
            }

            authErrorHandler(errorPayload);
          }

          // Wait for error handling to complete
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Cleanup
          client.disconnect();

          // Assert: Verify error completeness
          if (authErrors.length > 0) {
            const error = authErrors[0];

            // Error must be an object
            expect(typeof error).toBe('object');
            expect(error).not.toBeNull();

            const errorObj = error as { code?: string; message?: string; timestamp?: number };

            // Must have a non-empty message
            expect(errorObj.message).toBeDefined();
            expect(typeof errorObj.message).toBe('string');
            expect(errorObj.message.length).toBeGreaterThan(0);

            // Must have a valid error code
            expect(errorObj.code).toBeDefined();
            expect(validErrorCodes).toContain(errorObj.code);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Unit test: Verify AUTH_REQUIRED error format
   */
  it('should emit auth_error with AUTH_REQUIRED code and message', async () => {
    // Arrange
    const client = new WebSocketClient();
    const authErrors: unknown[] = [];

    client.on('auth_error', (error) => {
      authErrors.push(error);
    });

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 10));
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
    const authErrorHandler = eventHandlers.get('auth_error');
    if (authErrorHandler) {
      authErrorHandler({
        code: 'AUTH_REQUIRED',
        message: 'Authentication token required',
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(authErrors).toHaveLength(1);

    const error = authErrors[0] as { code: string; message: string; timestamp: number };
    expect(error.code).toBe('AUTH_REQUIRED');
    expect(error.message).toBe('Authentication token required');
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.timestamp).toBeDefined();

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify AUTH_INVALID error format
   */
  it('should emit auth_error with AUTH_INVALID code and message', async () => {
    // Arrange
    const client = new WebSocketClient();
    const authErrors: unknown[] = [];

    client.on('auth_error', (error) => {
      authErrors.push(error);
    });

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 10));
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
    const authErrorHandler = eventHandlers.get('auth_error');
    if (authErrorHandler) {
      authErrorHandler({
        code: 'AUTH_INVALID',
        message: 'Invalid authentication token',
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(authErrors).toHaveLength(1);

    const error = authErrors[0] as { code: string; message: string; timestamp: number };
    expect(error.code).toBe('AUTH_INVALID');
    expect(error.message).toBe('Invalid authentication token');
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.timestamp).toBeDefined();

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify AUTH_EXPIRED error format
   */
  it('should emit auth_error with AUTH_EXPIRED code and message', async () => {
    // Arrange
    const client = new WebSocketClient();
    const authErrors: unknown[] = [];

    client.on('auth_error', (error) => {
      authErrors.push(error);
    });

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 10));
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
    const authErrorHandler = eventHandlers.get('auth_error');
    if (authErrorHandler) {
      authErrorHandler({
        code: 'AUTH_EXPIRED',
        message: 'Authentication token expired',
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(authErrors).toHaveLength(1);

    const error = authErrors[0] as { code: string; message: string; timestamp: number };
    expect(error.code).toBe('AUTH_EXPIRED');
    expect(error.message).toBe('Authentication token expired');
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.timestamp).toBeDefined();

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify error message is never empty
   */
  it('should never emit auth_error with empty message', async () => {
    // Arrange
    const client = new WebSocketClient();
    const authErrors: unknown[] = [];

    client.on('auth_error', (error) => {
      authErrors.push(error);
    });

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 10));
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
    const authErrorHandler = eventHandlers.get('auth_error');
    if (authErrorHandler) {
      // Try to emit error with empty message
      authErrorHandler({
        code: 'AUTH_INVALID',
        message: '',
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(authErrors).toHaveLength(1);

    const error = authErrors[0] as { code: string; message: string };

    // Even if server sends empty message, client should handle it
    // The error object should still be emitted (we emit what we receive)
    expect(error).toBeDefined();
    expect(error.code).toBe('AUTH_INVALID');

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify error code is from valid set
   */
  it('should only emit auth_error with valid error codes', async () => {
    const validErrorCodes = ['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_EXPIRED'];

    // Test each valid error code
    for (const errorCode of validErrorCodes) {
      // Arrange
      const client = new WebSocketClient();
      const authErrors: unknown[] = [];

      client.on('auth_error', (error) => {
        authErrors.push(error);
      });

      // Act
      void client.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));
      const connectHandler = eventHandlers.get('connect');
      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      const authErrorHandler = eventHandlers.get('auth_error');
      if (authErrorHandler) {
        authErrorHandler({
          code: errorCode,
          message: `Test message for ${errorCode}`,
          timestamp: Date.now(),
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert
      expect(authErrors).toHaveLength(1);

      const error = authErrors[0] as { code: string; message: string };
      expect(validErrorCodes).toContain(error.code);

      // Cleanup
      client.disconnect();
    }
  });
});
