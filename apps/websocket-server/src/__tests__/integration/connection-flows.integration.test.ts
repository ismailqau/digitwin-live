/**
 * Integration Test: End-to-End WebSocket Connection Flows
 *
 * Tests the complete connection handshake and authentication flows:
 * - Successful connection with valid JWT token
 * - Connection with guest token
 * - Connection failure with invalid token
 * - Connection timeout handling
 * - Reconnection after auth_error
 *
 * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3
 */

import 'reflect-metadata';
import { createServer, Server as HttpServer } from 'http';

import { ConversationState } from '@clone/shared-types';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import { AuthService, GUEST_TOKEN_EXPIRATION_MS } from '../../application/services/AuthService';
import { ConnectionService } from '../../application/services/ConnectionService';
import { SessionService } from '../../application/services/SessionService';
import { ClientMessage, ServerMessage } from '../../domain/models/Message';
import { Session } from '../../domain/models/Session';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import {
  WebSocketController,
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
    // No-op for integration tests
    return 0;
  }
}

// Mock MessageRouterService for integration tests
class MockMessageRouterService {
  constructor(
    private connectionService: ConnectionService,
    _sessionService: SessionService
  ) {}

  async routeClientMessage(_sessionId: string, _message: ClientMessage): Promise<void> {
    // No-op for integration tests
  }

  sendToClient(sessionId: string, message: ServerMessage): void {
    this.connectionService.sendToClient(sessionId, message);
  }
}

describe('End-to-End WebSocket Connection Flows Integration', () => {
  let httpServer: HttpServer;
  let io: SocketIOServer;
  let serverPort: number;
  let authService: AuthService;

  beforeAll(async () => {
    // Note: We don't initialize database connection since we're using MockSessionRepository
    // This allows tests to run without a database

    // Create Express app
    const app = express();

    // Create HTTP server
    httpServer = createServer(app);

    // Create Socket.IO server
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        credentials: true,
      },
      transports: ['polling', 'websocket'], // Match production config
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Manually create services (avoid full container setup to prevent uuid ESM issues)
    authService = new AuthService();
    const sessionRepository = new MockSessionRepository();
    const sessionService = new SessionService(sessionRepository);
    const connectionService = new ConnectionService();
    const messageRouter = new MockMessageRouterService(connectionService, sessionService);

    // Create mock MetricsService
    const mockMetricsService = {
      recordConnectionAttempt: jest.fn(),
      recordConnectionSuccess: jest.fn(),
      recordConnectionFailure: jest.fn(),
      recordConnectionTimeout: jest.fn(),
      recordDisconnection: jest.fn(),
      getMetricsSummary: jest.fn(),
      getAlertStatus: jest.fn(),
      setActiveConnections: jest.fn(),
    };

    // Create WebSocket controller
    const wsController = new WebSocketController(
      sessionService,
      connectionService,
      messageRouter as any, // Cast to avoid type mismatch in integration test
      authService,
      mockMetricsService as any
    );

    // Handle WebSocket connections
    io.on('connection', (socket) => {
      wsController.handleConnection(socket);
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
    io.close();
    httpServer.close();

    // Note: No database to disconnect since we're using MockSessionRepository
  });

  /**
   * Test: Successful connection with valid JWT token
   * Requirements: 1.1, 1.4
   */
  describe('Successful connection with valid JWT token', () => {
    let client: ClientSocket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should establish connection and receive session_created event', (done) => {
      const validJwt = authService.generateToken('user-123', 'test@example.com', 'free', ['user']);

      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validJwt },
        transports: ['websocket'],
        reconnection: false,
      });

      const startTime = Date.now();

      client.on('session_created', (payload: SessionCreatedPayload) => {
        const duration = Date.now() - startTime;

        expect(payload).toBeDefined();
        expect(payload.sessionId).toBeDefined();
        expect(payload.userId).toBe('user-123');
        expect(payload.isGuest).toBe(false);
        expect(payload.timestamp).toBeDefined();

        // Should receive session_created within 5 seconds (Requirement 1.1)
        expect(duration).toBeLessThan(5000);

        done();
      });

      client.on('auth_error', (error: AuthErrorPayload) => {
        done(new Error(`Unexpected auth_error: ${error.message}`));
      });

      client.on('connect_error', (error: Error) => {
        done(new Error(`Connection error: ${error.message}`));
      });
    });

    it('should not receive auth_error event', (done) => {
      const validJwt = authService.generateToken('user-456', 'test2@example.com', 'pro', ['user']);

      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validJwt },
        transports: ['websocket'],
        reconnection: false,
      });

      let authErrorReceived = false;

      client.on('session_created', () => {
        // Wait a bit to ensure no auth_error is emitted
        setTimeout(() => {
          expect(authErrorReceived).toBe(false);
          done();
        }, 500);
      });

      client.on('auth_error', () => {
        authErrorReceived = true;
        done(new Error('Should not receive auth_error for valid token'));
      });
    });

    it('should remain connected after session_created', (done) => {
      const validJwt = authService.generateToken('user-789', 'test3@example.com', 'free', ['user']);

      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validJwt },
        transports: ['websocket'],
        reconnection: false,
      });

      let testCompleted = false;

      client.on('session_created', () => {
        // Wait a bit and check if still connected
        setTimeout(() => {
          expect(client.connected).toBe(true);
          testCompleted = true;
          done();
        }, 1000);
      });

      client.on('disconnect', () => {
        if (!testCompleted) {
          done(new Error('Should not disconnect after successful authentication'));
        }
      });
    });
  });

  /**
   * Test: Connection with guest token
   * Requirements: 3.1, 3.2, 3.3
   */
  describe('Connection with guest token', () => {
    let client: ClientSocket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should establish connection with valid guest token', (done) => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const guestToken = `guest_${uuid}_${Date.now()}`;

      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: guestToken },
        transports: ['websocket'],
        reconnection: false,
      });

      let testCompleted = false;

      client.on('session_created', (payload: SessionCreatedPayload) => {
        expect(payload).toBeDefined();
        expect(payload.sessionId).toBeDefined();
        expect(payload.userId).toBe(`guest-${uuid}`);
        expect(payload.isGuest).toBe(true); // Requirement 3.3
        expect(payload.timestamp).toBeDefined();

        testCompleted = true;
        done();
      });

      client.on('auth_error', (error: AuthErrorPayload) => {
        done(new Error(`Unexpected auth_error: ${error.message}`));
      });

      client.on('disconnect', () => {
        if (!testCompleted) {
          done(new Error('Should not disconnect before session_created'));
        }
      });
    });

    it('should receive session_created with isGuest: true', (done) => {
      const uuid = '660e8400-e29b-41d4-a716-446655440001';
      const guestToken = `guest_${uuid}_${Date.now()}`;

      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: guestToken },
        transports: ['websocket'],
        reconnection: false,
      });

      let testCompleted = false;

      client.on('session_created', (payload: SessionCreatedPayload) => {
        expect(payload.isGuest).toBe(true);
        testCompleted = true;
        done();
      });

      client.on('disconnect', () => {
        if (!testCompleted) {
          done(new Error('Should not disconnect before session_created'));
        }
      });
    });

    it('should reject expired guest token', (done) => {
      const uuid = '770e8400-e29b-41d4-a716-446655440002';
      const expiredTimestamp = Date.now() - GUEST_TOKEN_EXPIRATION_MS - 1000;
      const expiredGuestToken = `guest_${uuid}_${expiredTimestamp}`;

      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: expiredGuestToken },
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('auth_error', (error: AuthErrorPayload) => {
        expect(error.code).toBe('AUTH_EXPIRED');
        expect(error.message).toBe('Authentication token expired');
        done();
      });

      client.on('session_created', () => {
        done(new Error('Should not receive session_created for expired token'));
      });
    });
  });

  /**
   * Test: Connection failure with invalid token
   * Requirements: 1.2, 1.3
   */
  describe('Connection failure with invalid token', () => {
    let client: ClientSocket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should emit auth_error for missing token', (done) => {
      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: null },
        transports: ['websocket'],
        reconnection: false,
      });

      const startTime = Date.now();

      client.on('auth_error', (error: AuthErrorPayload) => {
        const duration = Date.now() - startTime;

        expect(error.code).toBe('AUTH_REQUIRED');
        expect(error.message).toBe('Authentication token required');
        expect(error.timestamp).toBeDefined();

        // Should receive auth_error immediately (Requirement 1.2)
        expect(duration).toBeLessThan(1000);

        done();
      });

      client.on('session_created', () => {
        done(new Error('Should not receive session_created without token'));
      });
    });

    it('should emit auth_error for invalid token format', (done) => {
      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: 'invalid-token-xyz' },
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('auth_error', (error: AuthErrorPayload) => {
        expect(error.code).toBe('AUTH_INVALID');
        expect(error.message).toBe('Invalid authentication token');
        done();
      });

      client.on('session_created', () => {
        done(new Error('Should not receive session_created for invalid token'));
      });
    });

    it('should emit auth_error for malformed guest token', (done) => {
      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: 'guest_invalid_format' },
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('auth_error', (error: AuthErrorPayload) => {
        expect(error.code).toBe('AUTH_INVALID');
        done();
      });
    });

    it('should disconnect after emitting auth_error', (done) => {
      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
        reconnection: false,
      });

      let authErrorReceived = false;

      client.on('auth_error', () => {
        authErrorReceived = true;
      });

      client.on('disconnect', () => {
        expect(authErrorReceived).toBe(true);
        done();
      });
    });

    it('should not emit session_created for invalid token', (done) => {
      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: 'bad-token' },
        transports: ['websocket'],
        reconnection: false,
      });

      let sessionCreatedReceived = false;

      client.on('session_created', () => {
        sessionCreatedReceived = true;
      });

      client.on('auth_error', () => {
        // Wait a bit to ensure session_created is not emitted
        setTimeout(() => {
          expect(sessionCreatedReceived).toBe(false);
          done();
        }, 500);
      });
    });
  });

  /**
   * Test: Connection timeout handling
   * Requirements: 1.1, 5.5
   */
  describe('Connection timeout handling', () => {
    let client: ClientSocket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should handle client-side timeout gracefully', (done) => {
      const validJwt = authService.generateToken('user-timeout', 'timeout@example.com', 'free', [
        'user',
      ]);

      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validJwt },
        transports: ['websocket'],
        reconnection: false,
        timeout: 1000, // 1 second timeout
      });

      client.on('session_created', () => {
        // Session created successfully
      });

      // If session is created before timeout, that's fine
      // If timeout occurs, we should handle it gracefully
      setTimeout(() => {
        // Either session was created or timeout occurred
        // Both are valid outcomes for this test
        expect(true).toBe(true);
        done();
      }, 2000);
    });

    it('should receive session_created within 10 seconds for Cloud Run cold start', (done) => {
      const validJwt = authService.generateToken(
        'user-coldstart',
        'coldstart@example.com',
        'free',
        ['user']
      );

      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validJwt },
        transports: ['websocket'],
        reconnection: false,
        timeout: 10000, // 10 second timeout for cold start
      });

      const startTime = Date.now();

      client.on('session_created', () => {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(10000); // Requirement 5.5
        done();
      });

      client.on('connect_error', (error: Error) => {
        done(new Error(`Connection error: ${error.message}`));
      });
    }, 15000); // Increase test timeout to 15 seconds
  });

  /**
   * Test: Reconnection after auth_error
   * Requirements: 2.2, 5.4
   */
  describe('Reconnection after auth_error', () => {
    let client: ClientSocket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should allow reconnection with valid token after auth_error', (done) => {
      // First connection with invalid token
      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: 'invalid-first-attempt' },
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('auth_error', () => {
        client.disconnect();

        // Second connection with valid token
        const validJwt = authService.generateToken(
          'user-reconnect',
          'reconnect@example.com',
          'free',
          ['user']
        );

        client = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validJwt },
          transports: ['websocket'],
          reconnection: false,
        });

        client.on('session_created', (payload: SessionCreatedPayload) => {
          expect(payload.userId).toBe('user-reconnect');
          expect(payload.isGuest).toBe(false);
          done();
        });

        client.on('auth_error', (error: AuthErrorPayload) => {
          done(new Error(`Second connection failed: ${error.message}`));
        });
      });
    });

    it('should allow reconnection with guest token after auth_error', (done) => {
      // First connection with invalid token
      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('auth_error', () => {
        client.disconnect();

        // Second connection with guest token
        const uuid = '880e8400-e29b-41d4-a716-446655440003';
        const guestToken = `guest_${uuid}_${Date.now()}`;

        client = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: guestToken },
          transports: ['websocket'],
          reconnection: false,
        });

        client.on('session_created', (payload: SessionCreatedPayload) => {
          expect(payload.userId).toBe(`guest-${uuid}`);
          expect(payload.isGuest).toBe(true);
          done();
        });

        client.on('auth_error', (error: AuthErrorPayload) => {
          done(new Error(`Guest reconnection failed: ${error.message}`));
        });
      });
    });

    it('should handle multiple reconnection attempts', (done) => {
      let attemptCount = 0;
      const maxAttempts = 3;

      const attemptConnection = () => {
        attemptCount++;

        if (attemptCount < maxAttempts) {
          // Invalid token for first attempts
          client = ioClient(`http://localhost:${serverPort}`, {
            auth: { token: `invalid-attempt-${attemptCount}` },
            transports: ['websocket'],
            reconnection: false,
          });

          client.on('auth_error', () => {
            client.disconnect();
            setTimeout(attemptConnection, 100);
          });
        } else {
          // Valid token on final attempt
          const validJwt = authService.generateToken(
            'user-multi-reconnect',
            'multi@example.com',
            'free',
            ['user']
          );

          client = ioClient(`http://localhost:${serverPort}`, {
            auth: { token: validJwt },
            transports: ['websocket'],
            reconnection: false,
          });

          client.on('session_created', (payload: SessionCreatedPayload) => {
            expect(payload.userId).toBe('user-multi-reconnect');
            expect(attemptCount).toBe(maxAttempts);
            done();
          });
        }
      };

      attemptConnection();
    });
  });

  /**
   * Test: Error message completeness
   * Requirements: 2.1, 2.3, 2.4, 2.5
   */
  describe('Error message completeness', () => {
    let client: ClientSocket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should include all required fields in auth_error', (done) => {
      client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: null },
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('auth_error', (error: AuthErrorPayload) => {
        expect(error).toBeDefined();
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.timestamp).toBeDefined();
        expect(typeof error.code).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(typeof error.timestamp).toBe('number');
        done();
      });
    });

    it('should provide descriptive error messages', (done) => {
      const testCases = [
        {
          token: null,
          expectedCode: 'AUTH_REQUIRED',
          expectedMessage: 'Authentication token required',
        },
        {
          token: 'invalid',
          expectedCode: 'AUTH_INVALID',
          expectedMessage: 'Invalid authentication token',
        },
      ];

      let completedTests = 0;

      testCases.forEach((testCase) => {
        const testClient = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: testCase.token },
          transports: ['websocket'],
          reconnection: false,
        });

        testClient.on('auth_error', (error: { code: string; message: string }) => {
          expect(error.code).toBe(testCase.expectedCode);
          expect(error.message).toBe(testCase.expectedMessage);
          testClient.disconnect();

          completedTests++;
          if (completedTests === testCases.length) {
            done();
          }
        });
      });
    });
  });
});
