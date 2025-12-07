/**
 * WebSocketController Tests
 *
 * Tests for WebSocket connection handling including authentication response guarantee.
 */

import 'reflect-metadata';

// Mock all dependencies BEFORE any imports
jest.mock('../application/services/ConnectionService', () => ({
  ConnectionService: jest.fn().mockImplementation(() => ({
    registerConnection: jest.fn(),
    unregisterConnection: jest.fn(),
    getConnection: jest.fn(),
    sendToClient: jest.fn(),
    isConnected: jest.fn(),
    getActiveConnectionCount: jest.fn(),
  })),
}));

jest.mock('../application/services/SessionService', () => ({
  SessionService: jest.fn().mockImplementation(() => ({
    createSession: jest.fn(),
    getSession: jest.fn(),
    endSession: jest.fn(),
    updateSessionState: jest.fn(),
    transitionState: jest.fn(),
    addConversationTurn: jest.fn(),
    getConversationHistory: jest.fn(),
    getUserSessions: jest.fn(),
    updateActivity: jest.fn(),
    logInterruption: jest.fn(),
  })),
}));

jest.mock('../application/services/MessageRouterService', () => ({
  MessageRouterService: jest.fn().mockImplementation(() => ({
    routeClientMessage: jest.fn(),
    sendToClient: jest.fn(),
  })),
}));

jest.mock('../application/services/MetricsService', () => ({
  MetricsService: jest.fn().mockImplementation(() => ({
    recordConnectionAttempt: jest.fn(),
    recordConnectionSuccess: jest.fn(),
    recordConnectionFailure: jest.fn(),
    recordConnectionTimeout: jest.fn(),
    recordDisconnection: jest.fn(),
    getMetricsSummary: jest.fn(),
    getAlertStatus: jest.fn(),
    setActiveConnections: jest.fn(),
  })),
}));

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../infrastructure/logging/logger', () => mockLogger);

jest.mock('../utils/errorHandler', () => ({
  WebSocketErrorHandler: {
    sendError: jest.fn(),
    sendASRError: jest.fn(),
    sendConnectionError: jest.fn(),
    wrapHandler: jest.fn(),
  },
}));

// Now import after mocks
import * as fc from 'fast-check';
import { Socket } from 'socket.io';

import {
  AuthService,
  AuthErrorCode,
  GUEST_TOKEN_EXPIRATION_MS,
} from '../application/services/AuthService';
import {
  WebSocketController,
  AuthErrorPayload,
  SessionCreatedPayload,
} from '../presentation/controllers/WebSocketController';

/**
 * Creates a mock Socket.IO socket for testing
 */
function createMockSocket(options: { token?: string | null; authHeader?: string | null }): Socket {
  const emittedEvents: Array<{ event: string; data: unknown }> = [];
  const eventListeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  const mockSocket = {
    id: `socket-${Math.random().toString(36).substring(7)}`,
    handshake: {
      auth: {
        token: options.token,
      },
      headers: {
        authorization: options.authHeader,
      },
    },
    emit: jest.fn((event: string, data: unknown) => {
      emittedEvents.push({ event, data });
      return true;
    }),
    on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(callback);
    }),
    disconnect: jest.fn(),
    _emittedEvents: emittedEvents,
    _eventListeners: eventListeners,
  } as unknown as Socket & {
    _emittedEvents: Array<{ event: string; data: unknown }>;
    _eventListeners: Map<string, Array<(...args: unknown[]) => void>>;
  };

  return mockSocket;
}

describe('WebSocketController', () => {
  let controller: WebSocketController;
  let authService: AuthService;
  let mockSessionService: {
    createSession: jest.Mock;
    getSession: jest.Mock;
    endSession: jest.Mock;
  };
  let mockConnectionService: {
    registerConnection: jest.Mock;
    unregisterConnection: jest.Mock;
  };
  let mockMessageRouter: {
    routeClientMessage: jest.Mock;
  };

  let mockMetricsService: {
    recordConnectionAttempt: jest.Mock;
    recordConnectionSuccess: jest.Mock;
    recordConnectionFailure: jest.Mock;
    recordConnectionTimeout: jest.Mock;
    recordDisconnection: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock service instances
    mockSessionService = {
      createSession: jest.fn().mockImplementation((userId: string, socketId: string) =>
        Promise.resolve({
          id: `session-${Math.random().toString(36).substring(7)}`,
          userId,
          connectionId: socketId,
          state: 'idle',
          conversationHistory: [],
          createdAt: new Date(),
          lastActivityAt: new Date(),
        })
      ),
      getSession: jest.fn(),
      endSession: jest.fn(),
    };

    mockConnectionService = {
      registerConnection: jest.fn(),
      unregisterConnection: jest.fn(),
    };

    mockMessageRouter = {
      routeClientMessage: jest.fn(),
    };

    mockMetricsService = {
      recordConnectionAttempt: jest.fn(),
      recordConnectionSuccess: jest.fn(),
      recordConnectionFailure: jest.fn(),
      recordConnectionTimeout: jest.fn(),
      recordDisconnection: jest.fn(),
    };

    // Use real AuthService for accurate token validation
    authService = new AuthService();

    // Create controller with mocked dependencies

    controller = new WebSocketController(
      mockSessionService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockConnectionService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockMessageRouter as any,
      authService,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockMetricsService as any
    );
  });

  /**
   * Property-Based Tests
   *
   * **Feature: websocket-connection-timeout-fix, Property 1: Authentication response guarantee**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * For any WebSocket connection attempt, the server must emit either
   * `session_created` or `auth_error` within 5 seconds before disconnecting.
   */
  describe('Property 1: Authentication response guarantee', () => {
    /**
     * Generator for valid UUID v4 strings
     */
    const uuidV4Arb = fc
      .tuple(
        fc.hexaString({ minLength: 8, maxLength: 8 }),
        fc.hexaString({ minLength: 4, maxLength: 4 }),
        fc.hexaString({ minLength: 3, maxLength: 3 }),
        fc.hexaString({ minLength: 3, maxLength: 3 }),
        fc.hexaString({ minLength: 12, maxLength: 12 })
      )
      .map(([a, b, c, d, e]) => {
        const version = '4' + c.slice(0, 3);
        const variant = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)] + d.slice(0, 3);
        return `${a}-${b}-${version}-${variant}-${e}`;
      });

    /**
     * Generator for valid guest tokens (non-expired)
     */
    const validGuestTokenArb = fc
      .tuple(uuidV4Arb, fc.integer({ min: 0, max: GUEST_TOKEN_EXPIRATION_MS - 1000 }))
      .map(([uuid, ageMs]) => {
        const timestamp = Date.now() - ageMs;
        return `guest_${uuid}_${timestamp}`;
      });

    /**
     * Generator for expired guest tokens
     */
    const expiredGuestTokenArb = fc
      .tuple(
        uuidV4Arb,
        fc.integer({ min: GUEST_TOKEN_EXPIRATION_MS + 1000, max: GUEST_TOKEN_EXPIRATION_MS * 10 })
      )
      .map(([uuid, ageMs]) => {
        const timestamp = Date.now() - ageMs;
        return `guest_${uuid}_${timestamp}`;
      });

    /**
     * Generator for invalid tokens (random strings that are not valid JWT or guest tokens)
     */
    const invalidTokenArb = fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => !s.startsWith('guest_') && !s.startsWith('mock-'));

    it('should always emit exactly one of session_created or auth_error for any connection attempt', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            validGuestTokenArb,
            expiredGuestTokenArb,
            invalidTokenArb,
            fc.constant('mock-guest-token')
          ),
          async (token) => {
            const socket = createMockSocket({ token }) as Socket & {
              _emittedEvents: Array<{ event: string; data: unknown }>;
            };

            await controller.handleConnection(socket);

            const emittedEvents = socket._emittedEvents;
            const authEvents = emittedEvents.filter(
              (e) => e.event === 'session_created' || e.event === 'auth_error'
            );

            if (authEvents.length !== 1) {
              return false;
            }

            const authEvent = authEvents[0];

            if (authEvent.event === 'session_created') {
              const payload = authEvent.data as SessionCreatedPayload;
              return (
                typeof payload.sessionId === 'string' &&
                typeof payload.userId === 'string' &&
                typeof payload.isGuest === 'boolean' &&
                typeof payload.timestamp === 'number'
              );
            } else if (authEvent.event === 'auth_error') {
              const payload = authEvent.data as AuthErrorPayload;
              return (
                typeof payload.code === 'string' &&
                typeof payload.message === 'string' &&
                typeof payload.timestamp === 'number' &&
                Object.values(AuthErrorCode).includes(payload.code as AuthErrorCode)
              );
            }

            return false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should emit session_created for valid tokens and auth_error for invalid tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.tuple(validGuestTokenArb, fc.constant('session_created' as const)),
            fc.tuple(fc.constant('mock-guest-token'), fc.constant('session_created' as const)),
            fc.tuple(fc.constant(null), fc.constant('auth_error' as const)),
            fc.tuple(expiredGuestTokenArb, fc.constant('auth_error' as const)),
            fc.tuple(invalidTokenArb, fc.constant('auth_error' as const))
          ),
          async ([token, expectedEvent]) => {
            const socket = createMockSocket({ token }) as Socket & {
              _emittedEvents: Array<{ event: string; data: unknown }>;
            };

            await controller.handleConnection(socket);

            const emittedEvents = socket._emittedEvents;
            const authEvents = emittedEvents.filter(
              (e) => e.event === 'session_created' || e.event === 'auth_error'
            );

            return authEvents.length === 1 && authEvents[0].event === expectedEvent;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should disconnect socket after emitting auth_error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.constant(null), expiredGuestTokenArb, invalidTokenArb),
          async (token) => {
            const socket = createMockSocket({ token });

            await controller.handleConnection(socket);

            return (socket.disconnect as jest.Mock).mock.calls.length === 1;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not disconnect socket after emitting session_created', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(validGuestTokenArb, fc.constant('mock-guest-token')),
          async (token) => {
            const socket = createMockSocket({ token });

            await controller.handleConnection(socket);

            return (socket.disconnect as jest.Mock).mock.calls.length === 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include isGuest: true in session_created for guest tokens', async () => {
      await fc.assert(
        fc.asyncProperty(validGuestTokenArb, async (token) => {
          const socket = createMockSocket({ token }) as Socket & {
            _emittedEvents: Array<{ event: string; data: unknown }>;
          };

          await controller.handleConnection(socket);

          const sessionCreatedEvent = socket._emittedEvents.find(
            (e) => e.event === 'session_created'
          );

          if (!sessionCreatedEvent) {
            return false;
          }

          const payload = sessionCreatedEvent.data as SessionCreatedPayload;
          return payload.isGuest === true;
        }),
        { numRuns: 50 }
      );
    });

    it('should include correct error code in auth_error for different failure types', async () => {
      // Test missing token -> AUTH_REQUIRED
      const socketNoToken = createMockSocket({ token: null }) as Socket & {
        _emittedEvents: Array<{ event: string; data: unknown }>;
      };
      await controller.handleConnection(socketNoToken);
      const authErrorNoToken = socketNoToken._emittedEvents.find((e) => e.event === 'auth_error');
      expect(authErrorNoToken).toBeDefined();
      expect((authErrorNoToken?.data as AuthErrorPayload).code).toBe(AuthErrorCode.AUTH_REQUIRED);

      // Test expired token -> AUTH_EXPIRED
      const expiredToken = `guest_550e8400-e29b-41d4-a716-446655440000_${Date.now() - GUEST_TOKEN_EXPIRATION_MS - 1000}`;
      const socketExpired = createMockSocket({ token: expiredToken }) as Socket & {
        _emittedEvents: Array<{ event: string; data: unknown }>;
      };
      await controller.handleConnection(socketExpired);
      const authErrorExpired = socketExpired._emittedEvents.find((e) => e.event === 'auth_error');
      expect(authErrorExpired).toBeDefined();
      expect((authErrorExpired?.data as AuthErrorPayload).code).toBe(AuthErrorCode.AUTH_EXPIRED);

      // Test invalid token -> AUTH_INVALID
      const socketInvalid = createMockSocket({ token: 'invalid-token-xyz' }) as Socket & {
        _emittedEvents: Array<{ event: string; data: unknown }>;
      };
      await controller.handleConnection(socketInvalid);
      const authErrorInvalid = socketInvalid._emittedEvents.find((e) => e.event === 'auth_error');
      expect(authErrorInvalid).toBeDefined();
      expect((authErrorInvalid?.data as AuthErrorPayload).code).toBe(AuthErrorCode.AUTH_INVALID);
    });
  });

  /**
   * Unit Tests for WebSocketController error handling
   *
   * Tests for specific authentication failure scenarios.
   * _Requirements: 1.1, 1.2, 1.3, 3.2_
   */
  describe('Unit Tests: WebSocketController error handling', () => {
    describe('auth failure with missing token', () => {
      it('should emit auth_error with AUTH_REQUIRED code', async () => {
        const socket = createMockSocket({ token: null }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        await controller.handleConnection(socket);

        const authErrorEvent = socket._emittedEvents.find((e) => e.event === 'auth_error');
        expect(authErrorEvent).toBeDefined();

        const payload = authErrorEvent?.data as AuthErrorPayload;
        expect(payload.code).toBe(AuthErrorCode.AUTH_REQUIRED);
        expect(payload.message).toBe('Authentication token required');
        expect(typeof payload.timestamp).toBe('number');
      });

      it('should disconnect the socket', async () => {
        const socket = createMockSocket({ token: null });

        await controller.handleConnection(socket);

        expect(socket.disconnect).toHaveBeenCalledTimes(1);
      });

      it('should not create a session', async () => {
        const socket = createMockSocket({ token: null });

        await controller.handleConnection(socket);

        expect(mockSessionService.createSession).not.toHaveBeenCalled();
      });
    });

    describe('auth failure with invalid token', () => {
      it('should emit auth_error with AUTH_INVALID code for malformed JWT', async () => {
        const socket = createMockSocket({ token: 'invalid-jwt-token' }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        await controller.handleConnection(socket);

        const authErrorEvent = socket._emittedEvents.find((e) => e.event === 'auth_error');
        expect(authErrorEvent).toBeDefined();

        const payload = authErrorEvent?.data as AuthErrorPayload;
        expect(payload.code).toBe(AuthErrorCode.AUTH_INVALID);
        expect(payload.message).toBe('Invalid authentication token');
      });

      it('should emit auth_error with AUTH_INVALID code for malformed guest token', async () => {
        const socket = createMockSocket({ token: 'guest_invalid_format' }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        await controller.handleConnection(socket);

        const authErrorEvent = socket._emittedEvents.find((e) => e.event === 'auth_error');
        expect(authErrorEvent).toBeDefined();

        const payload = authErrorEvent?.data as AuthErrorPayload;
        expect(payload.code).toBe(AuthErrorCode.AUTH_INVALID);
      });

      it('should disconnect the socket', async () => {
        const socket = createMockSocket({ token: 'invalid-token' });

        await controller.handleConnection(socket);

        expect(socket.disconnect).toHaveBeenCalledTimes(1);
      });
    });

    describe('auth failure with expired token', () => {
      it('should emit auth_error with AUTH_EXPIRED code for expired guest token', async () => {
        const expiredTimestamp = Date.now() - GUEST_TOKEN_EXPIRATION_MS - 1000;
        const expiredToken = `guest_550e8400-e29b-41d4-a716-446655440000_${expiredTimestamp}`;

        const socket = createMockSocket({ token: expiredToken }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        await controller.handleConnection(socket);

        const authErrorEvent = socket._emittedEvents.find((e) => e.event === 'auth_error');
        expect(authErrorEvent).toBeDefined();

        const payload = authErrorEvent?.data as AuthErrorPayload;
        expect(payload.code).toBe(AuthErrorCode.AUTH_EXPIRED);
        expect(payload.message).toBe('Authentication token expired');
      });

      it('should disconnect the socket', async () => {
        const expiredTimestamp = Date.now() - GUEST_TOKEN_EXPIRATION_MS - 1000;
        const expiredToken = `guest_550e8400-e29b-41d4-a716-446655440000_${expiredTimestamp}`;

        const socket = createMockSocket({ token: expiredToken });

        await controller.handleConnection(socket);

        expect(socket.disconnect).toHaveBeenCalledTimes(1);
      });
    });

    describe('successful auth with valid JWT', () => {
      it('should emit session_created with isGuest: false', async () => {
        const validJwt = authService.generateToken('user-123', 'test@example.com', 'free', [
          'user',
        ]);

        const socket = createMockSocket({ token: validJwt }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        await controller.handleConnection(socket);

        const sessionCreatedEvent = socket._emittedEvents.find(
          (e) => e.event === 'session_created'
        );
        expect(sessionCreatedEvent).toBeDefined();

        const payload = sessionCreatedEvent?.data as SessionCreatedPayload;
        expect(payload.isGuest).toBe(false);
        expect(typeof payload.sessionId).toBe('string');
        expect(typeof payload.userId).toBe('string');
        expect(typeof payload.timestamp).toBe('number');
      });

      it('should create a session', async () => {
        const validJwt = authService.generateToken('user-123', 'test@example.com', 'free', [
          'user',
        ]);

        const socket = createMockSocket({ token: validJwt });

        await controller.handleConnection(socket);

        expect(mockSessionService.createSession).toHaveBeenCalledWith('user-123', socket.id);
      });

      it('should register the connection', async () => {
        const validJwt = authService.generateToken('user-123', 'test@example.com', 'free', [
          'user',
        ]);

        const socket = createMockSocket({ token: validJwt });

        await controller.handleConnection(socket);

        expect(mockConnectionService.registerConnection).toHaveBeenCalled();
      });

      it('should not disconnect the socket', async () => {
        const validJwt = authService.generateToken('user-123', 'test@example.com', 'free', [
          'user',
        ]);

        const socket = createMockSocket({ token: validJwt });

        await controller.handleConnection(socket);

        expect(socket.disconnect).not.toHaveBeenCalled();
      });

      it('should not emit auth_error', async () => {
        const validJwt = authService.generateToken('user-123', 'test@example.com', 'free', [
          'user',
        ]);

        const socket = createMockSocket({ token: validJwt }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        await controller.handleConnection(socket);

        const authErrorEvent = socket._emittedEvents.find((e) => e.event === 'auth_error');
        expect(authErrorEvent).toBeUndefined();
      });
    });

    describe('successful auth with guest token', () => {
      it('should emit session_created with isGuest: true', async () => {
        const guestToken = `guest_550e8400-e29b-41d4-a716-446655440000_${Date.now()}`;

        const socket = createMockSocket({ token: guestToken }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        await controller.handleConnection(socket);

        const sessionCreatedEvent = socket._emittedEvents.find(
          (e) => e.event === 'session_created'
        );
        expect(sessionCreatedEvent).toBeDefined();

        const payload = sessionCreatedEvent?.data as SessionCreatedPayload;
        expect(payload.isGuest).toBe(true);
        expect(typeof payload.sessionId).toBe('string');
        expect(typeof payload.userId).toBe('string');
        expect(typeof payload.timestamp).toBe('number');
      });

      it('should create a session with guest user ID', async () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        const guestToken = `guest_${uuid}_${Date.now()}`;

        const socket = createMockSocket({ token: guestToken });

        await controller.handleConnection(socket);

        expect(mockSessionService.createSession).toHaveBeenCalledWith(`guest-${uuid}`, socket.id);
      });

      it('should register the connection', async () => {
        const guestToken = `guest_550e8400-e29b-41d4-a716-446655440000_${Date.now()}`;

        const socket = createMockSocket({ token: guestToken });

        await controller.handleConnection(socket);

        expect(mockConnectionService.registerConnection).toHaveBeenCalled();
      });

      it('should not disconnect the socket', async () => {
        const guestToken = `guest_550e8400-e29b-41d4-a716-446655440000_${Date.now()}`;

        const socket = createMockSocket({ token: guestToken });

        await controller.handleConnection(socket);

        expect(socket.disconnect).not.toHaveBeenCalled();
      });

      it('should not emit auth_error', async () => {
        const guestToken = `guest_550e8400-e29b-41d4-a716-446655440000_${Date.now()}`;

        const socket = createMockSocket({ token: guestToken }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        await controller.handleConnection(socket);

        const authErrorEvent = socket._emittedEvents.find((e) => e.event === 'auth_error');
        expect(authErrorEvent).toBeUndefined();
      });
    });

    describe('session creation timeout', () => {
      it('should emit auth_error when session creation times out', async () => {
        // Make session creation hang
        mockSessionService.createSession.mockImplementation(
          () => new Promise(() => {}) // Never resolves
        );

        const guestToken = `guest_550e8400-e29b-41d4-a716-446655440000_${Date.now()}`;
        const socket = createMockSocket({ token: guestToken }) as Socket & {
          _emittedEvents: Array<{ event: string; data: unknown }>;
        };

        // Use fake timers
        jest.useFakeTimers();

        const connectionPromise = controller.handleConnection(socket);

        // Fast-forward past the timeout
        jest.advanceTimersByTime(3000);

        await connectionPromise;

        jest.useRealTimers();

        const authErrorEvent = socket._emittedEvents.find((e) => e.event === 'auth_error');
        expect(authErrorEvent).toBeDefined();
        expect(socket.disconnect).toHaveBeenCalled();
      });
    });
  });

  /**
   * Property-Based Test for Logging Completeness
   *
   * **Feature: websocket-connection-timeout-fix, Property 6: Logging completeness**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * For any connection attempt, the server must log at least one entry with
   * socket ID, timestamp, and outcome (success/failure).
   */
  describe('Property 6: Logging completeness', () => {
    beforeEach(() => {
      // Clear mock logger calls before each test
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockLogger.debug.mockClear();
    });

    /**
     * Generator for valid UUID v4 strings
     */
    const uuidV4Arb = fc
      .tuple(
        fc.hexaString({ minLength: 8, maxLength: 8 }),
        fc.hexaString({ minLength: 4, maxLength: 4 }),
        fc.hexaString({ minLength: 3, maxLength: 3 }),
        fc.hexaString({ minLength: 3, maxLength: 3 }),
        fc.hexaString({ minLength: 12, maxLength: 12 })
      )
      .map(([a, b, c, d, e]) => {
        const version = '4' + c.slice(0, 3);
        const variant = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)] + d.slice(0, 3);
        return `${a}-${b}-${version}-${variant}-${e}`;
      });

    /**
     * Generator for valid guest tokens (non-expired)
     */
    const validGuestTokenArb = fc
      .tuple(uuidV4Arb, fc.integer({ min: 0, max: GUEST_TOKEN_EXPIRATION_MS - 1000 }))
      .map(([uuid, ageMs]) => {
        const timestamp = Date.now() - ageMs;
        return `guest_${uuid}_${timestamp}`;
      });

    /**
     * Generator for expired guest tokens
     */
    const expiredGuestTokenArb = fc
      .tuple(
        uuidV4Arb,
        fc.integer({ min: GUEST_TOKEN_EXPIRATION_MS + 1000, max: GUEST_TOKEN_EXPIRATION_MS * 10 })
      )
      .map(([uuid, ageMs]) => {
        const timestamp = Date.now() - ageMs;
        return `guest_${uuid}_${timestamp}`;
      });

    /**
     * Generator for invalid tokens
     */
    const invalidTokenArb = fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => !s.startsWith('guest_') && !s.startsWith('mock-'));

    it('should log connection attempt for any connection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            validGuestTokenArb,
            expiredGuestTokenArb,
            invalidTokenArb,
            fc.constant('mock-guest-token')
          ),
          async (token) => {
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();

            const socket = createMockSocket({ token });

            await controller.handleConnection(socket);

            // Check that at least one log entry was made
            const totalLogCalls =
              mockLogger.info.mock.calls.length + mockLogger.warn.mock.calls.length;

            if (totalLogCalls === 0) {
              return false;
            }

            // Find the connection attempt log
            const connectionAttemptLog = mockLogger.info.mock.calls.find(
              (call) => call[0] && call[0].includes('Connection attempt')
            );

            if (!connectionAttemptLog) {
              return false;
            }

            // Verify the log contains required fields
            const logData = connectionAttemptLog[1];
            return (
              logData &&
              typeof logData.socketId === 'string' &&
              typeof logData.timestamp === 'number' &&
              typeof logData.tokenType === 'string'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log outcome (success or failure) for any connection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.tuple(validGuestTokenArb, fc.constant('success' as const)),
            fc.tuple(fc.constant('mock-guest-token'), fc.constant('success' as const)),
            fc.tuple(fc.constant(null), fc.constant('failure' as const)),
            fc.tuple(expiredGuestTokenArb, fc.constant('failure' as const)),
            fc.tuple(invalidTokenArb, fc.constant('failure' as const))
          ),
          async ([token, expectedOutcome]) => {
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();

            const socket = createMockSocket({ token });

            await controller.handleConnection(socket);

            if (expectedOutcome === 'success') {
              // Should have session creation log
              const sessionCreatedLog = mockLogger.info.mock.calls.find(
                (call) => call[0] && call[0].includes('Session created successfully')
              );

              if (!sessionCreatedLog) {
                return false;
              }

              const logData = sessionCreatedLog[1];
              return (
                logData &&
                typeof logData.socketId === 'string' &&
                typeof logData.sessionId === 'string' &&
                typeof logData.userId === 'string' &&
                typeof logData.timestamp === 'number'
              );
            } else {
              // Should have authentication failure log
              const authFailureLog = mockLogger.warn.mock.calls.find(
                (call) => call[0] && call[0].includes('Authentication failed')
              );

              if (!authFailureLog) {
                return false;
              }

              const logData = authFailureLog[1];
              return (
                logData &&
                typeof logData.socketId === 'string' &&
                typeof logData.errorCode === 'string' &&
                typeof logData.timestamp === 'number'
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include socket ID in all connection-related logs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            validGuestTokenArb,
            expiredGuestTokenArb,
            invalidTokenArb,
            fc.constant('mock-guest-token')
          ),
          async (token) => {
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            const socket = createMockSocket({ token });
            const socketId = socket.id;

            await controller.handleConnection(socket);

            // Get all log calls
            const allLogCalls = [
              ...mockLogger.info.mock.calls,
              ...mockLogger.warn.mock.calls,
              ...mockLogger.debug.mock.calls,
            ];

            // Filter for connection-related logs
            const connectionLogs = allLogCalls.filter(
              (call) =>
                call[0] &&
                (call[0].includes('Connection') ||
                  call[0].includes('Session') ||
                  call[0].includes('Authentication'))
            );

            // All connection-related logs should have socketId
            return connectionLogs.every((call) => {
              const logData = call[1];
              return logData && logData.socketId === socketId;
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include timestamp in all connection-related logs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            validGuestTokenArb,
            expiredGuestTokenArb,
            invalidTokenArb,
            fc.constant('mock-guest-token')
          ),
          async (token) => {
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();

            const socket = createMockSocket({ token });

            const beforeTime = Date.now();
            await controller.handleConnection(socket);
            const afterTime = Date.now();

            // Get all log calls
            const allLogCalls = [...mockLogger.info.mock.calls, ...mockLogger.warn.mock.calls];

            // Filter for connection-related logs
            const connectionLogs = allLogCalls.filter(
              (call) =>
                call[0] &&
                (call[0].includes('Connection') ||
                  call[0].includes('Session') ||
                  call[0].includes('Authentication'))
            );

            // All connection-related logs should have timestamp within the test window
            return connectionLogs.every((call) => {
              const logData = call[1];
              return (
                logData &&
                typeof logData.timestamp === 'number' &&
                logData.timestamp >= beforeTime &&
                logData.timestamp <= afterTime
              );
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should log token type for all connection attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.tuple(fc.constant(null), fc.constant('none')),
            fc.tuple(validGuestTokenArb, fc.constant('guest')),
            fc.tuple(fc.constant('mock-guest-token'), fc.constant('mock')),
            fc.tuple(invalidTokenArb, fc.constant('jwt'))
          ),
          async ([token, expectedTokenType]) => {
            mockLogger.info.mockClear();

            const socket = createMockSocket({ token });

            await controller.handleConnection(socket);

            // Find the connection attempt log
            const connectionAttemptLog = mockLogger.info.mock.calls.find(
              (call) => call[0] && call[0].includes('Connection attempt')
            );

            if (!connectionAttemptLog) {
              return false;
            }

            const logData = connectionAttemptLog[1];
            return logData && logData.tokenType === expectedTokenType;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should log error details for authentication failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.constant(null), expiredGuestTokenArb, invalidTokenArb),
          async (token) => {
            mockLogger.warn.mockClear();

            const socket = createMockSocket({ token });

            await controller.handleConnection(socket);

            // Find the authentication failure log
            const authFailureLog = mockLogger.warn.mock.calls.find(
              (call) => call[0] && call[0].includes('Authentication failed')
            );

            if (!authFailureLog) {
              return false;
            }

            const logData = authFailureLog[1];
            return (
              logData &&
              typeof logData.errorCode === 'string' &&
              typeof logData.errorMessage === 'string' &&
              typeof logData.error === 'string'
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
