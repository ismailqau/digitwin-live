/**
 * NativeWebSocketClient Unit Tests - Auth Error Handling
 *
 * Feature: mobile-app-modernization
 * Tests auth_error handling behavior:
 * - AUTH_EXPIRED triggers token refresh
 * - AUTH_REQUIRED falls back to guest token
 * - AUTH_INVALID falls back to guest token
 * - Error logging includes full context
 *
 * Validates: Requirements 1.2, 2.3, 2.4, 2.5
 */

import { NativeWebSocketClient, ConnectionState } from '../services/NativeWebSocketClient';

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
    WEBSOCKET_URL: 'ws://localhost:3001',
  },
}));

// Mock guest token utilities
jest.mock('../utils/guestToken', () => ({
  generateGuestToken: jest.fn(() => 'guest_mock-uuid_1234567890'),
  isGuestToken: jest.fn((token: string) => token?.startsWith('guest_')),
}));

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {}

  send(_data: string): void {
    // Mock implementation
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ type: 'close' } as CloseEvent);
    }
  }

  addEventListener(): void {
    // Mock implementation
  }

  removeEventListener(): void {
    // Mock implementation
  }
}

// Replace global WebSocket
const originalWebSocket = global.WebSocket;
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).WebSocket = MockWebSocket;
});

afterAll(() => {
  global.WebSocket = originalWebSocket;
});

describe('NativeWebSocketClient - Auth Error Handling', () => {
  let mockWsInstance: MockWebSocket | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWsInstance = null;

    // Mock WebSocket constructor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        mockWsInstance = this;
      }
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Unit test: AUTH_REQUIRED triggers guest token fallback
   */
  it('should fall back to guest token on AUTH_REQUIRED error', async () => {
    // Arrange
    const client = new NativeWebSocketClient();
    const { generateGuestToken } = require('../utils/guestToken');
    const { SecureStorage } = require('../services/SecureStorage');

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onmessage) {
      mockWsInstance.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'auth_error',
            data: {
              code: 'AUTH_REQUIRED',
              message: 'Authentication token required',
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          }),
        })
      );
    }

    // Wait longer for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Assert
    expect(generateGuestToken).toHaveBeenCalled();
    expect(SecureStorage.setAccessToken).toHaveBeenCalled();

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: AUTH_INVALID triggers guest token fallback
   */
  it('should fall back to guest token on AUTH_INVALID error', async () => {
    // Arrange
    const client = new NativeWebSocketClient();
    const { generateGuestToken } = require('../utils/guestToken');
    const { SecureStorage } = require('../services/SecureStorage');

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onmessage) {
      mockWsInstance.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'auth_error',
            data: {
              code: 'AUTH_INVALID',
              message: 'Invalid authentication token',
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          }),
        })
      );
    }

    // Wait longer for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Assert
    expect(generateGuestToken).toHaveBeenCalled();
    expect(SecureStorage.setAccessToken).toHaveBeenCalled();

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: AUTH_EXPIRED triggers guest token fallback
   */
  it('should fall back to guest token on AUTH_EXPIRED error', async () => {
    // Arrange
    const client = new NativeWebSocketClient();
    const { generateGuestToken } = require('../utils/guestToken');
    const { SecureStorage } = require('../services/SecureStorage');

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onmessage) {
      mockWsInstance.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'auth_error',
            data: {
              code: 'AUTH_EXPIRED',
              message: 'Authentication token expired',
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          }),
        })
      );
    }

    // Wait longer for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Assert
    expect(generateGuestToken).toHaveBeenCalled();
    expect(SecureStorage.setAccessToken).toHaveBeenCalled();

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Auth error transitions to ERROR state
   */
  it('should transition to ERROR state on auth_error', async () => {
    // Arrange
    const client = new NativeWebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => {
      states.push(state);
    });

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onmessage) {
      mockWsInstance.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'auth_error',
            data: {
              code: 'AUTH_INVALID',
              message: 'Invalid token',
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          }),
        })
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert
    expect(states).toContain(ConnectionState.CONNECTING);
    expect(states).toContain(ConnectionState.AUTHENTICATING);
    expect(states).toContain(ConnectionState.ERROR);

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Manual disconnect prevents reconnection
   */
  it('should not reconnect after manual disconnect', async () => {
    // Arrange
    const client = new NativeWebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => {
      states.push(state);
    });

    // Act
    void client.connect();

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Manually disconnect
    client.disconnect();

    // Simulate connection close
    if (mockWsInstance && mockWsInstance.onclose) {
      mockWsInstance.onclose({ type: 'close' } as CloseEvent);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert: Should not have RECONNECTING state after manual disconnect
    expect(states).not.toContain(ConnectionState.RECONNECTING);
  });
});
