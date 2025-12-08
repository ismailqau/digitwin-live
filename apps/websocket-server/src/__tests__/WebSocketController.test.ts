/**
 * WebSocketController Tests
 *
 * Tests for WebSocket connection handling with native WebSocket implementation.
 * Tests the WebSocketController which handles authenticated connections.
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
    emit: jest.fn(),
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

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../infrastructure/logging/logger', () => mockLogger);

// Now import after mocks
import * as fc from 'fast-check';
import WebSocket from 'ws';

import { AuthService, GUEST_TOKEN_EXPIRATION_MS } from '../application/services/AuthService';
import { WebSocketConnection } from '../infrastructure/websocket/ConnectionManager';
import { MessageProtocol, MessageEnvelope } from '../infrastructure/websocket/MessageProtocol';
import { WebSocketController } from '../presentation/controllers/WebSocketController';

/**
 * Creates a mock WebSocket for testing
 */
function createMockWebSocket(): WebSocket {
  const sentMessages: string[] = [];

  const mockWs = {
    readyState: WebSocket.OPEN,
    send: jest.fn((data: string) => {
      sentMessages.push(data);
    }),
    close: jest.fn(),
    on: jest.fn(),
    _sentMessages: sentMessages,
  } as unknown as WebSocket & { _sentMessages: string[] };

  return mockWs;
}

/**
 * Creates a mock WebSocketConnection for testing
 */
function createMockConnection(options: {
  connectionId?: string;
  userId?: string;
  sessionId?: string;
  isAuthenticated?: boolean;
}): WebSocketConnection {
  return {
    id: options.connectionId || `conn-${Math.random().toString(36).substring(7)}`,
    ws: createMockWebSocket(),
    userId: options.userId || `user-${Math.random().toString(36).substring(7)}`,
    sessionId: options.sessionId || `session-${Math.random().toString(36).substring(7)}`,
    isAuthenticated: options.isAuthenticated ?? true,
    lastPing: Date.now(),
    createdAt: Date.now(),
  };
}

describe('WebSocketController', () => {
  let controller: WebSocketController;
  let authService: AuthService;
  let mockConnectionService: {
    registerConnection: jest.Mock;
    unregisterConnection: jest.Mock;
    emit: jest.Mock;
  };
  let mockMessageRouter: {
    routeClientMessage: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConnectionService = {
      registerConnection: jest.fn(),
      unregisterConnection: jest.fn(),
      emit: jest.fn(),
    };

    mockMessageRouter = {
      routeClientMessage: jest.fn(),
    };

    authService = new AuthService();

    controller = new WebSocketController(
      mockConnectionService as unknown as any,
      mockMessageRouter as unknown as any,
      authService
    );
  });

  describe('handleConnection', () => {
    it('should register connection with ConnectionService', () => {
      const connection = createMockConnection({
        connectionId: 'conn-123',
        sessionId: 'session-456',
        userId: 'user-789',
      });

      controller.handleConnection('conn-123', connection);

      expect(mockConnectionService.registerConnection).toHaveBeenCalledWith(
        'session-456',
        connection.ws,
        'conn-123'
      );
    });

    it('should log connection registration', () => {
      const connection = createMockConnection({
        connectionId: 'conn-123',
        sessionId: 'session-456',
      });

      controller.handleConnection('conn-123', connection);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[WebSocketController] Connection registered',
        expect.objectContaining({
          connectionId: 'conn-123',
          sessionId: 'session-456',
        })
      );
    });

    it('should handle missing sessionId gracefully', () => {
      const connection = createMockConnection({
        connectionId: 'conn-123',
      });
      connection.sessionId = undefined;

      controller.handleConnection('conn-123', connection);

      expect(mockConnectionService.registerConnection).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[WebSocketController] Connection missing sessionId',
        expect.objectContaining({ connectionId: 'conn-123' })
      );
    });
  });

  describe('handleMessage', () => {
    it('should route message type "message" to message router', async () => {
      const message: MessageEnvelope = {
        type: 'message',
        sessionId: 'session-123',
        data: { text: 'Hello' },
        timestamp: Date.now(),
      };

      await controller.handleMessage('conn-123', message, 'session-123');

      expect(mockMessageRouter.routeClientMessage).toHaveBeenCalledWith('session-123', {
        text: 'Hello',
      });
    });

    it('should route audio_chunk messages', async () => {
      const message: MessageEnvelope = {
        type: 'audio_chunk',
        sessionId: 'session-123',
        data: { chunk: 'base64data' },
        timestamp: Date.now(),
      };

      await controller.handleMessage('conn-123', message, 'session-123');

      expect(mockMessageRouter.routeClientMessage).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          type: 'audio_chunk',
          sessionId: 'session-123',
        })
      );
    });

    it('should handle retry_asr messages', async () => {
      const message: MessageEnvelope = {
        type: 'retry_asr',
        sessionId: 'session-123',
        timestamp: Date.now(),
      };

      await controller.handleMessage('conn-123', message, 'session-123');

      expect(mockConnectionService.emit).toHaveBeenCalledWith(
        'session-123',
        'asr_retry_acknowledged',
        expect.objectContaining({
          sessionId: 'session-123',
          message: 'Ready to receive audio. Please speak again.',
        })
      );
    });

    it('should log unhandled message types', async () => {
      const message: MessageEnvelope = {
        type: 'unknown_type',
        sessionId: 'session-123',
        timestamp: Date.now(),
      };

      await controller.handleMessage('conn-123', message, 'session-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[WebSocketController] Unhandled message type',
        expect.objectContaining({
          connectionId: 'conn-123',
          type: 'unknown_type',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockMessageRouter.routeClientMessage.mockRejectedValue(new Error('Router error'));

      const message: MessageEnvelope = {
        type: 'message',
        sessionId: 'session-123',
        data: { text: 'Hello' },
        timestamp: Date.now(),
      };

      await controller.handleMessage('conn-123', message, 'session-123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[WebSocketController] Message handling error',
        expect.objectContaining({
          connectionId: 'conn-123',
          sessionId: 'session-123',
        })
      );

      expect(mockConnectionService.emit).toHaveBeenCalledWith(
        'session-123',
        'error',
        expect.objectContaining({
          type: 'error',
          errorCode: 'INTERNAL_ERROR',
        })
      );
    });
  });

  describe('handleDisconnection', () => {
    it('should log disconnection', () => {
      controller.handleDisconnection('conn-123', 1000, 'Normal closure');

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[WebSocketController] Handling disconnection',
        expect.objectContaining({
          connectionId: 'conn-123',
          code: 1000,
          reason: 'Normal closure',
          event: 'disconnect',
        })
      );
    });
  });

  describe('getTokenType', () => {
    it('should return "none" for null token', () => {
      expect(controller.getTokenType(null)).toBe('none');
    });

    it('should return "none" for undefined token', () => {
      expect(controller.getTokenType(undefined)).toBe('none');
    });

    it('should return "guest" for guest tokens', () => {
      const guestToken = `guest_550e8400-e29b-41d4-a716-446655440000_${Date.now()}`;
      expect(controller.getTokenType(guestToken)).toBe('guest');
    });

    it('should return "mock" for mock tokens', () => {
      expect(controller.getTokenType('mock-guest-token')).toBe('mock');
    });

    it('should return "jwt" for JWT tokens', () => {
      const jwt = authService.generateToken('user-123', 'test@example.com', 'free', ['user']);
      expect(controller.getTokenType(jwt)).toBe('jwt');
    });
  });
});

describe('MessageProtocol', () => {
  describe('serialize', () => {
    it('should serialize message envelope to JSON', () => {
      const message: MessageEnvelope = {
        type: 'test',
        sessionId: 'session-123',
        data: { foo: 'bar' },
        timestamp: 1234567890,
      };

      const result = MessageProtocol.serialize(message);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe('test');
      expect(parsed.sessionId).toBe('session-123');
      expect(parsed.data).toEqual({ foo: 'bar' });
      expect(parsed.timestamp).toBe(1234567890);
    });
  });

  describe('deserialize', () => {
    it('should deserialize valid JSON to message envelope', () => {
      const json = JSON.stringify({
        type: 'test',
        sessionId: 'session-123',
        data: { foo: 'bar' },
        timestamp: 1234567890,
      });

      const result = MessageProtocol.deserialize(json);

      expect(result.success).toBe(true);
      expect(result.message?.type).toBe('test');
      expect(result.message?.sessionId).toBe('session-123');
    });

    it('should return error for invalid JSON', () => {
      const result = MessageProtocol.deserialize('not valid json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON parse error');
    });

    it('should return error for missing type', () => {
      const json = JSON.stringify({
        sessionId: 'session-123',
        timestamp: 1234567890,
      });

      const result = MessageProtocol.deserialize(json);

      expect(result.success).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should return error for missing timestamp', () => {
      const json = JSON.stringify({
        type: 'test',
        sessionId: 'session-123',
      });

      const result = MessageProtocol.deserialize(json);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timestamp');
    });
  });

  describe('createEnvelope', () => {
    it('should create envelope with current timestamp', () => {
      const before = Date.now();
      const envelope = MessageProtocol.createEnvelope('test', { foo: 'bar' }, 'session-123');
      const after = Date.now();

      expect(envelope.type).toBe('test');
      expect(envelope.sessionId).toBe('session-123');
      expect(envelope.data).toEqual({ foo: 'bar' });
      expect(envelope.timestamp).toBeGreaterThanOrEqual(before);
      expect(envelope.timestamp).toBeLessThanOrEqual(after);
    });
  });

  /**
   * Property-Based Test: Message serialization round-trip
   *
   * **Feature: mobile-app-modernization, Property 21: Message serialization round-trip**
   * **Validates: Requirements 12.4**
   *
   * For any MessageEnvelope object, serializing then deserializing should produce
   * an equivalent object with the same type, sessionId, data, and timestamp.
   */
  describe('Property 21: Message serialization round-trip', () => {
    it('should preserve message content through serialize/deserialize cycle', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
            sessionId: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            data: fc.option(fc.jsonValue(), { nil: undefined }),
            timestamp: fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
          }),
          (message) => {
            const serialized = MessageProtocol.serialize(message as MessageEnvelope);
            const result = MessageProtocol.deserialize(serialized);

            if (!result.success || !result.message) {
              return false;
            }

            return (
              result.message.type === message.type &&
              result.message.sessionId === message.sessionId &&
              JSON.stringify(result.message.data) === JSON.stringify(message.data) &&
              result.message.timestamp === message.timestamp
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', () => {
      const token = authService.generateToken('user-123', 'test@example.com', 'free', ['user']);
      const payload = authService.verifyToken(token);

      expect(payload.userId).toBe('user-123');
      expect(payload.isGuest).toBe(false);
    });

    it('should verify valid guest token', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const guestToken = `guest_${uuid}_${Date.now()}`;
      const payload = authService.verifyToken(guestToken);

      expect(payload.userId).toBe(`guest-${uuid}`);
      expect(payload.isGuest).toBe(true);
    });

    it('should reject missing token', () => {
      expect(() => authService.verifyToken(undefined)).toThrow();
    });

    it('should reject expired guest token', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const expiredTimestamp = Date.now() - GUEST_TOKEN_EXPIRATION_MS - 1000;
      const expiredToken = `guest_${uuid}_${expiredTimestamp}`;

      expect(() => authService.verifyToken(expiredToken)).toThrow();
    });

    it('should reject invalid token format', () => {
      expect(() => authService.verifyToken('invalid-token')).toThrow();
    });
  });

  /**
   * Property-Based Test: Authentication triggers session creation
   *
   * **Feature: mobile-app-modernization, Property 1: Authentication triggers session creation**
   * **Validates: Requirements 2.2**
   *
   * For any valid JWT token, when a client connects and authenticates successfully,
   * the system should return a payload with userId and isGuest fields.
   */
  describe('Property 1: Authentication triggers session creation', () => {
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

    it('should return valid payload for any valid guest token', () => {
      fc.assert(
        fc.property(validGuestTokenArb, (token) => {
          const payload = authService.verifyToken(token);

          return (
            typeof payload.userId === 'string' &&
            payload.userId.startsWith('guest-') &&
            payload.isGuest === true
          );
        }),
        { numRuns: 100 }
      );
    });
  });
});
