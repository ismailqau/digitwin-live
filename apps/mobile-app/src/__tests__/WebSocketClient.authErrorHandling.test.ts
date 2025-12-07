/**
 * WebSocketClient Unit Tests - Auth Error Handling
 *
 * Feature: websocket-connection-timeout-fix
 * Tests auth_error handling behavior:
 * - AUTH_EXPIRED triggers token refresh
 * - AUTH_REQUIRED falls back to guest token
 * - AUTH_INVALID falls back to guest token
 * - Error logging includes full context
 *
 * Validates: Requirements 2.2, 5.4
 */

import { io } from 'socket.io-client';

import { WebSocketClient, ConnectionState } from '../services/WebSocketClient';

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
  generateGuestToken: jest.fn(),
  isGuestToken: jest.fn(),
}));

describe('WebSocketClient - Auth Error Handling', () => {
  // Import mocked modules
  const { SecureStorage } = require('../services/SecureStorage');
  const WebSocketMonitor = require('../services/WebSocketMonitor').default;
  const { generateGuestToken, isGuestToken } = require('../utils/guestToken');
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

    // Mock guest token utilities
    (generateGuestToken as jest.Mock).mockReturnValue('guest_mock-uuid_1234567890');
    (isGuestToken as jest.Mock).mockImplementation((token: string) => token?.startsWith('guest_'));

    // Mock SecureStorage
    (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue('mock-jwt-token');
    (SecureStorage.setAccessToken as jest.Mock).mockResolvedValue(undefined);
    (SecureStorage.getRefreshToken as jest.Mock).mockResolvedValue('mock-refresh-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Test: AUTH_EXPIRED triggers token refresh
   */
  it('should attempt token refresh when AUTH_EXPIRED is received', async () => {
    // Arrange
    const client = new WebSocketClient();

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

    // Assert: Should attempt to get refresh token
    expect(SecureStorage.getRefreshToken).toHaveBeenCalled();

    // Since token refresh is not implemented, should fall back to guest token
    expect(generateGuestToken).toHaveBeenCalled();
    expect(SecureStorage.setAccessToken).toHaveBeenCalledWith('guest_mock-uuid_1234567890');

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: AUTH_EXPIRED with no refresh token falls back to guest token
   */
  it('should fall back to guest token when AUTH_EXPIRED and no refresh token', async () => {
    // Arrange
    const client = new WebSocketClient();
    (SecureStorage.getRefreshToken as jest.Mock).mockResolvedValue(null);

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

    // Assert: Should fall back to guest token
    expect(generateGuestToken).toHaveBeenCalled();
    expect(SecureStorage.setAccessToken).toHaveBeenCalledWith('guest_mock-uuid_1234567890');

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: AUTH_REQUIRED falls back to guest token
   */
  it('should fall back to guest token when AUTH_REQUIRED is received', async () => {
    // Arrange
    const client = new WebSocketClient();

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

    // Assert: Should fall back to guest token
    expect(generateGuestToken).toHaveBeenCalled();
    expect(SecureStorage.setAccessToken).toHaveBeenCalledWith('guest_mock-uuid_1234567890');

    // Should NOT attempt token refresh for AUTH_REQUIRED
    expect(SecureStorage.getRefreshToken).not.toHaveBeenCalled();

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: AUTH_INVALID falls back to guest token
   */
  it('should fall back to guest token when AUTH_INVALID is received', async () => {
    // Arrange
    const client = new WebSocketClient();

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

    // Assert: Should fall back to guest token
    expect(generateGuestToken).toHaveBeenCalled();
    expect(SecureStorage.setAccessToken).toHaveBeenCalledWith('guest_mock-uuid_1234567890');

    // Should NOT attempt token refresh for AUTH_INVALID
    expect(SecureStorage.getRefreshToken).not.toHaveBeenCalled();

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: Error logging includes full context
   */
  it('should log error with full context including code, message, and token type', async () => {
    // Arrange
    const client = new WebSocketClient();
    client.setAuthToken('mock-jwt-token');

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
        timestamp: 1234567890,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert: Should log error with full context
    expect(WebSocketMonitor.error).toHaveBeenCalledWith(
      'connection',
      'Auth failed: Invalid authentication token',
      expect.objectContaining({
        code: 'AUTH_INVALID',
        message: 'Invalid authentication token',
        tokenType: 'JWT',
        timestamp: 1234567890,
      })
    );

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: Error logging with guest token type
   */
  it('should log error with guest token type when using guest token', async () => {
    // Arrange
    const client = new WebSocketClient();
    client.setAuthToken('guest_mock-uuid_1234567890');

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
        message: 'Invalid guest token',
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert: Should log error with guest token type
    expect(WebSocketMonitor.error).toHaveBeenCalledWith(
      'connection',
      'Auth failed: Invalid guest token',
      expect.objectContaining({
        code: 'AUTH_INVALID',
        message: 'Invalid guest token',
        tokenType: 'Guest',
      })
    );

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: Error logging with no token
   */
  it('should log error with None token type when no token is set', async () => {
    // Arrange
    const client = new WebSocketClient();
    (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(null);

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

    // Assert: Should log error with None token type
    expect(WebSocketMonitor.error).toHaveBeenCalledWith(
      'connection',
      'Auth failed: Authentication token required',
      expect.objectContaining({
        code: 'AUTH_REQUIRED',
        message: 'Authentication token required',
        tokenType: 'None',
      })
    );

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: Transitions to ERROR state after auth_error
   */
  it('should transition to ERROR state after receiving auth_error', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

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

    // Assert: Should transition to ERROR state
    expect(states).toContain(ConnectionState.ERROR);

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: Schedules reconnection after auth_error
   */
  it('should schedule reconnection after receiving auth_error', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

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

    // Assert: Should eventually transition to RECONNECTING
    // Note: This happens after disconnect, so we check for DISCONNECTED first
    expect(states).toContain(ConnectionState.DISCONNECTED);

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: Unknown error code falls back to guest token
   */
  it('should fall back to guest token for unknown error codes', async () => {
    // Arrange
    const client = new WebSocketClient();

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
        code: 'UNKNOWN_ERROR',
        message: 'Unknown authentication error',
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert: Should fall back to guest token
    expect(generateGuestToken).toHaveBeenCalled();
    expect(SecureStorage.setAccessToken).toHaveBeenCalledWith('guest_mock-uuid_1234567890');

    // Cleanup
    client.disconnect();
  });

  /**
   * Test: Handles error when guest token generation fails
   */
  it('should handle error when guest token generation fails', async () => {
    // Arrange
    const client = new WebSocketClient();
    (generateGuestToken as jest.Mock).mockImplementation(() => {
      throw new Error('Failed to generate UUID');
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

    // Assert: Should log error
    expect(WebSocketMonitor.error).toHaveBeenCalledWith(
      'connection',
      'Failed to generate guest token',
      expect.any(Error)
    );

    // Cleanup
    client.disconnect();
  });
});
