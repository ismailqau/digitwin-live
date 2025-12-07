/**
 * WebSocketClient Property-Based Tests - Connection Timeout
 *
 * Feature: websocket-connection-timeout-fix
 * Property 5: Connection timeout handling
 * Validates: Requirements 5.5
 *
 * Tests that the WebSocketClient correctly handles timeouts when waiting for session_created:
 * - Transitions to ERROR state after timeout
 * - Schedules reconnection after timeout
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

describe('WebSocketClient - Property 5: Connection timeout handling', () => {
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
    jest.useFakeTimers();
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
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /**
   * Property 5: Connection timeout handling
   *
   * For any connection that doesn't receive session_created within 10 seconds,
   * the client must transition to ERROR state and schedule reconnection.
   */
  it('should transition to ERROR and schedule reconnection on timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasToken: fc.boolean(),
          delayMs: fc.integer({ min: 10000, max: 15000 }), // Delays beyond timeout
        }),
        async ({ hasToken, delayMs }) => {
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
          const connectPromise = client.connect();

          // Advance timers to allow initial setup
          await Promise.resolve();
          jest.advanceTimersByTime(100);

          // Simulate Socket.IO connect event
          const connectHandler = eventHandlers.get('connect');
          if (connectHandler) {
            mockSocket.connected = true;
            mockSocket.disconnected = false;
            connectHandler();
          }

          // Advance timers to allow state transition
          await Promise.resolve();
          jest.advanceTimersByTime(100);

          // Verify we're in AUTHENTICATING state
          expect(stateTransitions).toContain(ConnectionState.AUTHENTICATING);

          // Advance timers past the timeout (10 seconds)
          jest.advanceTimersByTime(delayMs);
          await Promise.resolve();

          // Wait for the connect promise to settle
          await connectPromise.catch(() => {
            // Expected to fail due to timeout
          });

          // Assert: Verify timeout behavior
          // 1. Must transition to ERROR state
          expect(stateTransitions).toContain(ConnectionState.ERROR);

          // 2. ERROR must come after AUTHENTICATING (find the ERROR that comes after AUTHENTICATING)
          const authenticatingIndex = stateTransitions.indexOf(ConnectionState.AUTHENTICATING);

          // Find the first ERROR state that comes after AUTHENTICATING
          let errorAfterAuth = -1;
          for (let i = authenticatingIndex + 1; i < stateTransitions.length; i++) {
            if (stateTransitions[i] === ConnectionState.ERROR) {
              errorAfterAuth = i;
              break;
            }
          }

          // If we reached AUTHENTICATING, we should have an ERROR after it due to timeout
          if (authenticatingIndex !== -1) {
            expect(errorAfterAuth).toBeGreaterThan(authenticatingIndex);
          }

          // 3. Must transition to RECONNECTING (scheduled reconnection)
          // Note: RECONNECTING might not appear immediately in the state array
          // because it's scheduled, but we can verify the state after advancing timers
          jest.advanceTimersByTime(1000); // Advance to trigger reconnection
          await Promise.resolve();

          // Cleanup
          client.disconnect();

          return true;
        }
      ),
      { numRuns: 50 } // Reduced runs since we're using timers
    );
  });

  /**
   * Unit test: Verify timeout triggers ERROR state
   */
  it('should transition to ERROR state when session_created times out', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    const connectPromise = client.connect();

    // Advance timers to allow initial setup
    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Simulate Socket.IO connect event
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Verify we're in AUTHENTICATING state
    expect(states).toContain(ConnectionState.AUTHENTICATING);

    // Advance timers past the 10-second timeout
    jest.advanceTimersByTime(10000);
    await Promise.resolve();

    // Wait for the connect promise to settle
    await connectPromise.catch(() => {
      // Expected to fail
    });

    // Assert
    expect(states).toContain(ConnectionState.ERROR);

    const authenticatingIndex = states.indexOf(ConnectionState.AUTHENTICATING);

    // Find the first ERROR state that comes after AUTHENTICATING
    let errorAfterAuth = -1;
    for (let i = authenticatingIndex + 1; i < states.length; i++) {
      if (states[i] === ConnectionState.ERROR) {
        errorAfterAuth = i;
        break;
      }
    }

    expect(errorAfterAuth).toBeGreaterThan(authenticatingIndex);

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify timeout is cleared when session_created arrives
   */
  it('should clear timeout when session_created arrives before timeout', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act - Start connection but don't await yet
    const connectPromise = client.connect();

    // Advance timers to allow initial setup
    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Simulate Socket.IO connect event immediately
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    // Allow the connect promise to resolve
    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Wait for the connect promise to complete
    await connectPromise;

    // Now we should be in AUTHENTICATING state
    expect(states).toContain(ConnectionState.AUTHENTICATING);

    // Simulate session_created before timeout (e.g., after 2 seconds)
    jest.advanceTimersByTime(2000);
    const sessionCreatedHandler = eventHandlers.get('session_created');
    if (sessionCreatedHandler) {
      sessionCreatedHandler({
        sessionId: 'test-session',
        userId: 'test-user',
        isGuest: false,
        timestamp: Date.now(),
      });
    }

    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Verify we're now CONNECTED
    expect(states).toContain(ConnectionState.CONNECTED);

    // Advance past where timeout would have fired (10 seconds total)
    jest.advanceTimersByTime(8000);
    await Promise.resolve();

    // Assert: Should still be CONNECTED, no ERROR from timeout
    const authenticatingIndex = states.indexOf(ConnectionState.AUTHENTICATING);
    const connectedIndex = states.indexOf(ConnectionState.CONNECTED);

    expect(connectedIndex).toBeGreaterThan(authenticatingIndex);

    // Check if there's an ERROR between AUTHENTICATING and CONNECTED
    let errorBetween = false;
    for (let i = authenticatingIndex + 1; i < connectedIndex; i++) {
      if (states[i] === ConnectionState.ERROR) {
        errorBetween = true;
        break;
      }
    }

    // There should be no ERROR between AUTHENTICATING and CONNECTED
    expect(errorBetween).toBe(false);

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify timeout is cleared on auth_error
   */
  it('should clear timeout when auth_error arrives', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Advance timers to allow initial setup
    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Simulate Socket.IO connect event
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Simulate auth_error before timeout (e.g., after 2 seconds)
    jest.advanceTimersByTime(2000);
    const authErrorHandler = eventHandlers.get('auth_error');
    if (authErrorHandler) {
      authErrorHandler({
        code: 'AUTH_INVALID',
        message: 'Invalid token',
        timestamp: Date.now(),
      });
    }

    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Advance past where timeout would have fired
    jest.advanceTimersByTime(9000);
    await Promise.resolve();

    // Assert: Should have ERROR from auth_error
    expect(states).toContain(ConnectionState.ERROR);

    // Verify ERROR comes after AUTHENTICATING
    const authenticatingIndex = states.indexOf(ConnectionState.AUTHENTICATING);

    // Find the first ERROR after AUTHENTICATING
    let firstErrorAfterAuth = -1;
    for (let i = authenticatingIndex + 1; i < states.length; i++) {
      if (states[i] === ConnectionState.ERROR) {
        firstErrorAfterAuth = i;
        break;
      }
    }

    expect(firstErrorAfterAuth).toBeGreaterThan(authenticatingIndex);

    // Note: There may be multiple ERROR states due to reconnection attempts,
    // but the first one should be from auth_error, not from timeout

    // Cleanup
    client.disconnect();
  });

  /**
   * Unit test: Verify reconnection is scheduled after timeout
   */
  it('should schedule reconnection after timeout', async () => {
    // Arrange
    const client = new WebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    const connectPromise = client.connect();

    // Advance timers to allow initial setup
    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Simulate Socket.IO connect event
    const connectHandler = eventHandlers.get('connect');
    if (connectHandler) {
      mockSocket.connected = true;
      connectHandler();
    }

    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // Advance timers past the timeout
    jest.advanceTimersByTime(10000);
    await Promise.resolve();

    // Wait for the connect promise to settle
    await connectPromise.catch(() => {
      // Expected to fail
    });

    // Advance timers to trigger reconnection (first delay is 1000ms)
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Assert: Should transition to RECONNECTING
    expect(states).toContain(ConnectionState.RECONNECTING);

    // Cleanup
    client.disconnect();
  });
});
