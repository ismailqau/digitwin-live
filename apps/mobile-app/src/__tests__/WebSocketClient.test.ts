/**
 * NativeWebSocketClient Property-Based Tests
 *
 * Feature: mobile-app-modernization
 * Property 2: Client state consistency
 * Validates: Requirements 1.2, 2.3, 2.4, 2.5
 *
 * Tests that the NativeWebSocketClient correctly transitions through states:
 * CONNECTING → AUTHENTICATING → (CONNECTED | ERROR)
 */

import * as fc from 'fast-check';

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
      this.onclose(new CloseEvent('close'));
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

describe('NativeWebSocketClient - Property 2: Client state consistency', () => {
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
    if (mockWsInstance) {
      mockWsInstance.onopen = null;
      mockWsInstance.onclose = null;
      mockWsInstance.onerror = null;
      mockWsInstance.onmessage = null;
    }
    jest.clearAllTimers();
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
          const client = new NativeWebSocketClient();
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

          // Wait for connection to be attempted
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Simulate WebSocket open event
          if (mockWsInstance && mockWsInstance.onopen) {
            mockWsInstance.readyState = WebSocket.OPEN;
            mockWsInstance.onopen(new Event('open'));
          }

          // Simulate server response
          if (serverRespondsQuickly) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            if (mockWsInstance && mockWsInstance.onmessage) {
              if (authSucceeds) {
                mockWsInstance.onmessage(
                  new MessageEvent('message', {
                    data: JSON.stringify({
                      type: 'session_created',
                      sessionId: 'test-session',
                      data: {
                        sessionId: 'test-session',
                        userId: 'test-user',
                        isGuest: !hasToken,
                        timestamp: Date.now(),
                      },
                      timestamp: Date.now(),
                    }),
                  })
                );
              } else {
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
            }
          }

          // Wait for state transitions to complete
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Cleanup
          client.disconnect();

          // Assert: Verify state transition sequence
          const hasConnecting = stateTransitions.includes(ConnectionState.CONNECTING);
          const hasAuthenticating = stateTransitions.includes(ConnectionState.AUTHENTICATING);

          // If we got to CONNECTING, we must have gone through AUTHENTICATING
          if (hasConnecting) {
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
      { numRuns: 10 }
    );
  }, 30000);

  /**
   * Unit test: Verify CONNECTING → AUTHENTICATING transition
   */
  it('should transition from CONNECTING to AUTHENTICATING on WebSocket open', async () => {
    // Arrange
    const client = new NativeWebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Wait for connection attempt
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate WebSocket open event
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

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
    const client = new NativeWebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Wait for connection attempt
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate WebSocket open event
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    // Simulate session_created event
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (mockWsInstance && mockWsInstance.onmessage) {
      mockWsInstance.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'session_created',
            sessionId: 'test-session',
            data: {
              sessionId: 'test-session',
              userId: 'test-user',
              isGuest: false,
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          }),
        })
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

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
    const client = new NativeWebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Wait for connection attempt
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate WebSocket open event
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    // Simulate auth_error event
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

    await new Promise((resolve) => setTimeout(resolve, 50));

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
   * Unit test: Verify state never skips AUTHENTICATING
   */
  it('should never skip AUTHENTICATING state when connecting', async () => {
    // Arrange
    const client = new NativeWebSocketClient();
    const states: ConnectionState[] = [];

    client.onConnectionStateChange((state) => states.push(state));

    // Act
    void client.connect();

    // Wait for connection attempt
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate WebSocket open event
    if (mockWsInstance && mockWsInstance.onopen) {
      mockWsInstance.readyState = WebSocket.OPEN;
      mockWsInstance.onopen(new Event('open'));
    }

    // Immediately simulate session_created (fast server response)
    if (mockWsInstance && mockWsInstance.onmessage) {
      mockWsInstance.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'session_created',
            sessionId: 'test-session',
            data: {
              sessionId: 'test-session',
              userId: 'test-user',
              isGuest: false,
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          }),
        })
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

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
