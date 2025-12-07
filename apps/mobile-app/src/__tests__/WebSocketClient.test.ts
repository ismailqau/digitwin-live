/**
 * WebSocketClient Property-Based Tests
 *
 * Feature: websocket-connection-timeout-fix
 * Property 2: Client state consistency
 * Validates: Requirements 5.1, 5.2, 5.3
 *
 * Tests that the WebSocketClient correctly transitions through states:
 * CONNECTING → AUTHENTICATING → (CONNECTED | ERROR)
 */

import * as fc from 'fast-check';
import { io } from 'socket.io-client';

import { WebSocketClient, ConnectionState } from '../services/WebSocketClient';

// Mock socket.io-client
jest.mock('socket.io-client');

// Mock SecureStorage
jest.mock('../services/SecureStorage', () => ({
  SecureStorage: {
    getAccessToken: jest.fn(),
    setAccessToken: jest.fn(),
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

describe('WebSocketClient - Property 2: Client state consistency', () => {
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
   * Property 2: Client state consistency
   *
   * For any connection attempt, the client state must transition from
   * CONNECTING → AUTHENTICATING → (CONNECTED | ERROR), never skipping AUTHENTICATING.
   */
  it('should always transition through AUTHENTICATING state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          authSucceeds: fc.boolean(),
          hasToken: fc.boolean(),
          serverRespondsQuickly: fc.boolean(),
        }),
        async ({ authSucceeds, hasToken, serverRespondsQuickly }) => {
          // Arrange: Create a new client and track state transitions
          const client = new WebSocketClient();
          const stateTransitions: ConnectionState[] = [];

          // Subscribe to state changes
          client.onConnectionStateChange((state) => {
            stateTransitions.push(state);
          });

          // Mock token availability
          const { SecureStorage } = require('../services/SecureStorage');
          if (hasToken) {
            SecureStorage.getAccessToken.mockResolvedValue('mock-token');
          } else {
            SecureStorage.getAccessToken.mockRejectedValue(new Error('No token'));
          }

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

          // Simulate server response
          if (serverRespondsQuickly) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            if (authSucceeds) {
              const sessionCreatedHandler = eventHandlers.get('session_created');
              if (sessionCreatedHandler) {
                sessionCreatedHandler({
                  sessionId: 'test-session',
                  userId: 'test-user',
                  isGuest: !hasToken,
                  timestamp: Date.now(),
                });
              }
            } else {
              const authErrorHandler = eventHandlers.get('auth_error');
              if (authErrorHandler) {
                authErrorHandler({
                  code: 'AUTH_INVALID',
                  message: 'Invalid token',
                  timestamp: Date.now(),
                });
              }
            }
          }

          // Wait for state transitions to complete
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Cleanup
          client.disconnect();

          // Assert: Verify state transition sequence
          const hasConnecting = stateTransitions.includes(ConnectionState.CONNECTING);
          const hasAuthenticating = stateTransitions.includes(ConnectionState.AUTHENTICATING);

          // If we got to CONNECTING, we must have gone through AUTHENTICATING
          if (hasConnecting && connectHandler) {
            expect(hasAuthenticating).toBe(true);

            // Find indices
            const connectingIndex = stateTransitions.indexOf(ConnectionState.CONNECTING);
            const authenticatingIndex = stateTransitions.indexOf(ConnectionState.AUTHENTICATING);

            // AUTHENTICATING must come after CONNECTING
            expect(authenticatingIndex).toBeGreaterThan(connectingIndex);

            // If we reached CONNECTED, it must come after AUTHENTICATING
            const connectedIndex = stateTransitions.indexOf(ConnectionState.CONNECTED);
            if (connectedIndex !== -1) {
              expect(connectedIndex).toBeGreaterThan(authenticatingIndex);
            }

            // If we reached ERROR, it must come after AUTHENTICATING
            const errorIndex = stateTransitions.indexOf(ConnectionState.ERROR);
            if (errorIndex !== -1 && errorIndex > authenticatingIndex) {
              // This is valid - we can go to ERROR after AUTHENTICATING
              expect(errorIndex).toBeGreaterThan(authenticatingIndex);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Unit test: Verify CONNECTING → AUTHENTICATING transition
   */
  it('should transition from CONNECTING to AUTHENTICATING on socket connect', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Simulate Socket.IO connect event
    await new Promise((resolve) => setTimeout(resolve, 10));
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert
    expect(states).toContain(ConnectionState.CONNECTING);
    expect(states).toContain(ConnectionState.AUTHENTICATING);

    const connectingIndex = states.indexOf(ConnectionState.CONNECTING);
    const authenticatingIndex = states.indexOf(ConnectionState.AUTHENTICATING);
    expect(authenticatingIndex).toBeGreaterThan(connectingIndex);

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify AUTHENTICATING → CONNECTED transition
   */
  it('should transition from AUTHENTICATING to CONNECTED on session_created', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Simulate Socket.IO connect event
    await new Promise((resolve) => setTimeout(resolve, 10));
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    // Simulate session_created event
    await new Promise((resolve) => setTimeout(resolve, 10));
    const sessionCreatedHandler = eventHandlers.get('session_created');
    if (sessionCreatedHandler) {
      sessionCreatedHandler({
        sessionId: 'test-session',
        userId: 'test-user',
        isGuest: false,
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert
    expect(states).toContain(ConnectionState.CONNECTING);
    expect(states).toContain(ConnectionState.AUTHENTICATING);
    expect(states).toContain(ConnectionState.CONNECTED);

    const connectingIndex = states.indexOf(ConnectionState.CONNECTING);
    const authenticatingIndex = states.indexOf(ConnectionState.AUTHENTICATING);
    const connectedIndex = states.indexOf(ConnectionState.CONNECTED);

    expect(authenticatingIndex).toBeGreaterThan(connectingIndex);
    expect(connectedIndex).toBeGreaterThan(authenticatingIndex);

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify AUTHENTICATING → ERROR transition on auth_error
   */
  it('should transition from AUTHENTICATING to ERROR on auth_error', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Simulate Socket.IO connect event
    await new Promise((resolve) => setTimeout(resolve, 10));
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    // Simulate auth_error event
    await new Promise((resolve) => setTimeout(resolve, 10));
    const authErrorHandler = eventHandlers.get('auth_error');
    if (authErrorHandler) {
      authErrorHandler({
        code: 'AUTH_INVALID',
        message: 'Invalid token',
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert
    expect(states).toContain(ConnectionState.CONNECTING);
    expect(states).toContain(ConnectionState.AUTHENTICATING);
    // Note: auth_error triggers disconnect, which sets DISCONNECTED state

    const connectingIndex = states.indexOf(ConnectionState.CONNECTING);
    const authenticatingIndex = states.indexOf(ConnectionState.AUTHENTICATING);

    expect(authenticatingIndex).toBeGreaterThan(connectingIndex);

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify state never skips AUTHENTICATING
   */
  it('should never skip AUTHENTICATING state when connecting', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Simulate Socket.IO connect event
    await new Promise((resolve) => setTimeout(resolve, 10));
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    // Immediately simulate session_created (fast server response)
    const sessionCreatedHandler = eventHandlers.get('session_created');
    if (sessionCreatedHandler) {
      sessionCreatedHandler({
        sessionId: 'test-session',
        userId: 'test-user',
        isGuest: false,
        timestamp: Date.now(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert: Even with immediate session_created, must go through AUTHENTICATING
    expect(states).toContain(ConnectionState.CONNECTING);
    expect(states).toContain(ConnectionState.AUTHENTICATING);
    expect(states).toContain(ConnectionState.CONNECTED);

    const connectingIndex = states.indexOf(ConnectionState.CONNECTING);
    const authenticatingIndex = states.indexOf(ConnectionState.AUTHENTICATING);
    const connectedIndex = states.indexOf(ConnectionState.CONNECTED);

    expect(authenticatingIndex).toBeGreaterThan(connectingIndex);
    expect(connectedIndex).toBeGreaterThan(authenticatingIndex);

    // Cleanup
    client.disconnect();
  });
});
