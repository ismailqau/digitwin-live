/**
 * Integration Test: End-to-End WebSocket Connection Flows
 *
 * Tests the complete connection handshake and authentication flows using native WebSocket:
 * - Successful connection with valid JWT token
 * - Connection with guest token
 * - Connection failure with invalid token
 * - Connection timeout handling
 * - Reconnection after auth_error
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5
 */

import 'reflect-metadata';
import { createServer, Server as HttpServer } from 'http';

import { ConversationState } from '@clone/shared-types';
import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';

import { AuthService, GUEST_TOKEN_EXPIRATION_MS } from '../../application/services/AuthService';
import { SessionService } from '../../application/services/SessionService';
import { Session } from '../../domain/models/Session';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { AuthenticationHandler } from '../../infrastructure/websocket/AuthenticationHandler';
import {
  ConnectionManager,
  WebSocketConnection,
} from '../../infrastructure/websocket/ConnectionManager';
import { MessageProtocol, MessageEnvelope } from '../../infrastructure/websocket/MessageProtocol';
import {
  AuthErrorPayload,
  SessionCreatedPayload,
} from '../../presentation/controllers/WebSocketController';

// Mock SessionRepository for integration tests
class MockSessionRepository implements ISessionRepository {
  private sessions: Map<string, Session> = new Map();

  async create(userId: string, connectionId: string): Promise<Session> {
    const session: Session = {
      id: `session-${Date.now()}-${Math.random()}`,
      userId,
      connectionId,
      state: ConversationState.IDLE,
      conversationHistory: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {},
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findById(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async findByConnectionId(connectionId: string): Promise<Session | null> {
    for (const session of this.sessions.values()) {
      if (session.connectionId === connectionId) {
        return session;
      }
    }
    return null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  async update(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteByConnectionId(connectionId: string): Promise<void> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.connectionId === connectionId) {
        this.sessions.delete(id);
      }
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    return 0;
  }
}

/**
 * Helper to create a WebSocket client that connects to the test server
 */
function createTestClient(
  serverPort: number,
  token: string | null
): Promise<{
  ws: WebSocket;
  messages: MessageEnvelope[];
  waitForMessage: (type: string, timeout?: number) => Promise<MessageEnvelope>;
}> {
  return new Promise((resolve, reject) => {
    const messages: MessageEnvelope[] = [];
    const messageWaiters: Map<
      string,
      { resolve: (msg: MessageEnvelope) => void; reject: (err: Error) => void }
    > = new Map();

    const url = token
      ? `ws://localhost:${serverPort}/socket.io/?token=${encodeURIComponent(token)}`
      : `ws://localhost:${serverPort}/socket.io/`;

    const ws = new WebSocket(url);

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        waitForMessage: (type: string, timeout = 5000) => {
          // Check if message already received
          const existing = messages.find((m) => m.type === type);
          if (existing) {
            return Promise.resolve(existing);
          }

          return new Promise((res, rej) => {
            const timeoutId = setTimeout(() => {
              messageWaiters.delete(type);
              rej(new Error(`Timeout waiting for message type: ${type}`));
            }, timeout);

            messageWaiters.set(type, {
              resolve: (msg) => {
                clearTimeout(timeoutId);
                res(msg);
              },
              reject: rej,
            });
          });
        },
      });
    });

    ws.on('message', (data) => {
      try {
        const result = MessageProtocol.deserialize(data.toString());
        if (result.success && result.message) {
          messages.push(result.message);

          // Notify any waiters
          const waiter = messageWaiters.get(result.message.type);
          if (waiter) {
            messageWaiters.delete(result.message.type);
            waiter.resolve(result.message);
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.on('error', (error) => {
      reject(error);
    });
  });
}

describe('End-to-End WebSocket Connection Flows Integration', () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;
  let serverPort: number;
  let authService: AuthService;
  let sessionService: SessionService;
  let connectionManager: ConnectionManager;
  let authHandler: AuthenticationHandler;

  beforeAll(async () => {
    // Create Express app
    const app = express();

    // Create HTTP server
    httpServer = createServer(app);

    // Create native WebSocket server
    wss = new WebSocketServer({
      server: httpServer,
      path: '/socket.io/', // Keep same path for compatibility
    });

    // Create services
    authService = new AuthService();
    const sessionRepository = new MockSessionRepository();
    sessionService = new SessionService(sessionRepository);
    connectionManager = new ConnectionManager();
    authHandler = new AuthenticationHandler(authService);

    // Handle WebSocket connections
    wss.on('connection', async (ws, request) => {
      const connectionId = `conn-${Date.now()}-${Math.random()}`;

      try {
        // Extract and verify token
        const token = authHandler.extractTokenFromRequest(request);
        const payload = await authHandler.authenticateConnection(token, connectionId);

        // Create session
        const session = await sessionService.createSession(payload.userId, connectionId);

        // Register connection
        const connection: WebSocketConnection = {
          id: connectionId,
          ws,
          userId: payload.userId,
          sessionId: session.id,
          isAuthenticated: true,
          lastPing: Date.now(),
          createdAt: Date.now(),
        };
        connectionManager.registerConnection(connectionId, connection);

        // Send session_created
        authHandler.sendSessionCreated(ws, session.id, payload.userId, payload.isGuest);

        // Handle messages
        ws.on('message', (data) => {
          const result = MessageProtocol.deserialize(data.toString());
          if (result.success && result.message?.type === 'ping') {
            const pong = MessageProtocol.createEnvelope(
              'pong',
              { timestamp: Date.now() },
              session.id
            );
            ws.send(MessageProtocol.serialize(pong));
          }
        });

        // Handle close
        ws.on('close', () => {
          connectionManager.unregisterConnection(connectionId);
        });
      } catch (error) {
        // Send auth error
        const { code, message } = authHandler.mapAuthError(error);
        authHandler.sendAuthError(ws, code, message);
        ws.close(4001, message);
      }
    });

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          serverPort = address.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close all connections
    for (const client of wss.clients) {
      client.close();
    }
    wss.close();
    httpServer.close();
  });

  /**
   * Test: Successful connection with valid JWT token
   * Requirements: 1.1, 2.1, 2.2
   */
  describe('Successful connection with valid JWT token', () => {
    it('should establish connection and receive session_created event', async () => {
      const validJwt = authService.generateToken('user-123', 'test@example.com', 'free', ['user']);

      const startTime = Date.now();
      const { ws, waitForMessage } = await createTestClient(serverPort, validJwt);

      try {
        const sessionCreated = await waitForMessage('session_created');
        const duration = Date.now() - startTime;

        expect(sessionCreated).toBeDefined();
        const payload = sessionCreated.data as SessionCreatedPayload;
        expect(payload.sessionId).toBeDefined();
        expect(payload.userId).toBe('user-123');
        expect(payload.isGuest).toBe(false);
        expect(payload.timestamp).toBeDefined();

        // Should receive session_created within 5 seconds (Requirement 1.1)
        expect(duration).toBeLessThan(5000);
      } finally {
        ws.close();
      }
    });

    it('should not receive auth_error event', async () => {
      const validJwt = authService.generateToken('user-456', 'test2@example.com', 'pro', ['user']);

      const { ws, messages, waitForMessage } = await createTestClient(serverPort, validJwt);

      try {
        await waitForMessage('session_created');

        // Wait a bit to ensure no auth_error is emitted
        await new Promise((resolve) => setTimeout(resolve, 500));

        const authError = messages.find((m) => m.type === 'auth_error');
        expect(authError).toBeUndefined();
      } finally {
        ws.close();
      }
    });

    it('should remain connected after session_created', async () => {
      const validJwt = authService.generateToken('user-789', 'test3@example.com', 'free', ['user']);

      const { ws, waitForMessage } = await createTestClient(serverPort, validJwt);

      try {
        await waitForMessage('session_created');

        // Wait a bit and check if still connected
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(ws.readyState).toBe(WebSocket.OPEN);
      } finally {
        ws.close();
      }
    });
  });

  /**
   * Test: Connection with guest token
   * Requirements: 3.1, 3.2, 3.3
   */
  describe('Connection with guest token', () => {
    it('should establish connection with valid guest token', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const guestToken = `guest_${uuid}_${Date.now()}`;

      const { ws, waitForMessage } = await createTestClient(serverPort, guestToken);

      try {
        const sessionCreated = await waitForMessage('session_created');

        expect(sessionCreated).toBeDefined();
        const payload = sessionCreated.data as SessionCreatedPayload;
        expect(payload.sessionId).toBeDefined();
        expect(payload.userId).toBe(`guest-${uuid}`);
        expect(payload.isGuest).toBe(true);
        expect(payload.timestamp).toBeDefined();
      } finally {
        ws.close();
      }
    });

    it('should receive session_created with isGuest: true', async () => {
      const uuid = '660e8400-e29b-41d4-a716-446655440001';
      const guestToken = `guest_${uuid}_${Date.now()}`;

      const { ws, waitForMessage } = await createTestClient(serverPort, guestToken);

      try {
        const sessionCreated = await waitForMessage('session_created');
        const payload = sessionCreated.data as SessionCreatedPayload;
        expect(payload.isGuest).toBe(true);
      } finally {
        ws.close();
      }
    });

    it('should reject expired guest token', async () => {
      const uuid = '770e8400-e29b-41d4-a716-446655440002';
      const expiredTimestamp = Date.now() - GUEST_TOKEN_EXPIRATION_MS - 1000;
      const expiredGuestToken = `guest_${uuid}_${expiredTimestamp}`;

      const { ws, waitForMessage } = await createTestClient(serverPort, expiredGuestToken);

      try {
        const authError = await waitForMessage('auth_error');
        const payload = authError.data as AuthErrorPayload;
        expect(payload.code).toBe('AUTH_EXPIRED');
        expect(payload.message).toBe('Authentication token expired');
      } finally {
        ws.close();
      }
    });
  });

  /**
   * Test: Connection failure with invalid token
   * Requirements: 1.2, 1.3
   */
  describe('Connection failure with invalid token', () => {
    it('should emit auth_error for missing token', async () => {
      const startTime = Date.now();
      const { ws, waitForMessage } = await createTestClient(serverPort, null);

      try {
        const authError = await waitForMessage('auth_error');
        const duration = Date.now() - startTime;

        const payload = authError.data as AuthErrorPayload;
        expect(payload.code).toBe('AUTH_REQUIRED');
        expect(payload.message).toBe('Authentication token required');
        expect(payload.timestamp).toBeDefined();

        // Should receive auth_error immediately (Requirement 1.2)
        expect(duration).toBeLessThan(1000);
      } finally {
        ws.close();
      }
    });

    it('should emit auth_error for invalid token format', async () => {
      const { ws, waitForMessage } = await createTestClient(serverPort, 'invalid-token-xyz');

      try {
        const authError = await waitForMessage('auth_error');
        const payload = authError.data as AuthErrorPayload;
        expect(payload.code).toBe('AUTH_INVALID');
        expect(payload.message).toBe('Invalid authentication token');
      } finally {
        ws.close();
      }
    });

    it('should emit auth_error for malformed guest token', async () => {
      const { ws, waitForMessage } = await createTestClient(serverPort, 'guest_invalid_format');

      try {
        const authError = await waitForMessage('auth_error');
        const payload = authError.data as AuthErrorPayload;
        expect(payload.code).toBe('AUTH_INVALID');
      } finally {
        ws.close();
      }
    });
  });

  /**
   * Test: Heartbeat mechanism
   * Requirements: 3.4, 3.5
   */
  describe('Heartbeat mechanism', () => {
    it('should respond to ping with pong', async () => {
      const validJwt = authService.generateToken('user-ping', 'ping@example.com', 'free', ['user']);

      const { ws, waitForMessage } = await createTestClient(serverPort, validJwt);

      try {
        await waitForMessage('session_created');

        // Send ping
        const ping = MessageProtocol.createEnvelope('ping', { timestamp: Date.now() });
        ws.send(MessageProtocol.serialize(ping));

        // Wait for pong
        const pong = await waitForMessage('pong');
        expect(pong).toBeDefined();
        expect((pong.data as { timestamp: number }).timestamp).toBeDefined();
      } finally {
        ws.close();
      }
    });
  });

  /**
   * Test: Reconnection after auth_error
   * Requirements: 2.3, 2.4
   */
  describe('Reconnection after auth_error', () => {
    it('should allow reconnection with valid token after auth_error', async () => {
      // First connection with invalid token
      const { ws: ws1, waitForMessage: wait1 } = await createTestClient(
        serverPort,
        'invalid-first-attempt'
      );

      try {
        await wait1('auth_error');
      } finally {
        ws1.close();
      }

      // Wait for connection to close
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second connection with valid token
      const validJwt = authService.generateToken(
        'user-reconnect',
        'reconnect@example.com',
        'free',
        ['user']
      );
      const { ws: ws2, waitForMessage: wait2 } = await createTestClient(serverPort, validJwt);

      try {
        const sessionCreated = await wait2('session_created');
        const payload = sessionCreated.data as SessionCreatedPayload;
        expect(payload.userId).toBe('user-reconnect');
        expect(payload.isGuest).toBe(false);
      } finally {
        ws2.close();
      }
    });

    it('should allow reconnection with guest token after auth_error', async () => {
      // First connection with invalid token
      const { ws: ws1, waitForMessage: wait1 } = await createTestClient(
        serverPort,
        'invalid-token'
      );

      try {
        await wait1('auth_error');
      } finally {
        ws1.close();
      }

      // Wait for connection to close
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second connection with guest token
      const uuid = '880e8400-e29b-41d4-a716-446655440003';
      const guestToken = `guest_${uuid}_${Date.now()}`;
      const { ws: ws2, waitForMessage: wait2 } = await createTestClient(serverPort, guestToken);

      try {
        const sessionCreated = await wait2('session_created');
        const payload = sessionCreated.data as SessionCreatedPayload;
        expect(payload.userId).toBe(`guest-${uuid}`);
        expect(payload.isGuest).toBe(true);
      } finally {
        ws2.close();
      }
    });
  });

  /**
   * Test: Error message completeness
   * Requirements: 2.1, 2.2
   */
  describe('Error message completeness', () => {
    it('should include all required fields in auth_error', async () => {
      const { ws, waitForMessage } = await createTestClient(serverPort, null);

      try {
        const authError = await waitForMessage('auth_error');
        const payload = authError.data as AuthErrorPayload;

        expect(payload).toBeDefined();
        expect(payload.code).toBeDefined();
        expect(payload.message).toBeDefined();
        expect(payload.timestamp).toBeDefined();
        expect(typeof payload.code).toBe('string');
        expect(typeof payload.message).toBe('string');
        expect(typeof payload.timestamp).toBe('number');
      } finally {
        ws.close();
      }
    });
  });
});
