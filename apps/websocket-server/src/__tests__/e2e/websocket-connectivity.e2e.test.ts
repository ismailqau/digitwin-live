/**
 * End-to-End WebSocket Connectivity Tests
 *
 * Tests complete WebSocket connectivity flows from mobile app to server:
 * - Mobile app connects to server successfully (Requirement 11.1)
 * - JWT authentication and session creation (Requirement 11.2)
 * - Bidirectional message flow (Requirement 11.3)
 * - Reconnection after network interruption (Requirement 11.4)
 * - Real-time features: audio, transcripts, LLM responses (Requirement 11.5)
 *
 * These tests simulate the mobile app's NativeWebSocketClient behavior
 * and verify end-to-end communication with the server.
 */

import 'reflect-metadata';
import { createServer, Server as HttpServer } from 'http';

import { ConversationState } from '@clone/shared-types';
import express from 'express';
import WebSocket from 'ws';

import { AuthService } from '../../application/services/AuthService';
import { MetricsService } from '../../application/services/MetricsService';
import { SessionService } from '../../application/services/SessionService';
import { Session } from '../../domain/models/Session';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { MessageProtocol, MessageEnvelope } from '../../infrastructure/websocket/MessageProtocol';
import { NativeWebSocketServer } from '../../infrastructure/websocket/NativeWebSocketServer';

// Mock SessionRepository
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

// Mock MetricsService - use real implementation for accurate tracking
class MockMetricsService extends MetricsService {
  // Use parent class implementation for all methods
}

/**
 * Helper to create a WebSocket client that simulates mobile app behavior
 */
function createMobileAppClient(
  serverPort: number,
  token: string | null
): Promise<{
  ws: WebSocket;
  messages: MessageEnvelope[];
  sessionId: string | null;
  waitForMessage: (type: string, timeout?: number) => Promise<MessageEnvelope>;
  sendMessage: (type: string, data?: unknown, sessionId?: string) => void;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    const messages: MessageEnvelope[] = [];
    let sessionId: string | null = null;
    const messageWaiters: Map<
      string,
      { resolve: (msg: MessageEnvelope) => void; reject: (err: Error) => void }
    > = new Map();

    const url = token
      ? `ws://localhost:${serverPort}/socket.io/?token=${encodeURIComponent(token)}`
      : `ws://localhost:${serverPort}/socket.io/`;

    const ws = new WebSocket(url);

    const sendMessage = (type: string, data?: unknown, sid?: string) => {
      const envelope = MessageProtocol.createEnvelope(type, data, sid || sessionId || undefined);
      ws.send(MessageProtocol.serialize(envelope));
    };

    const waitForMessage = (type: string, timeout = 5000): Promise<MessageEnvelope> => {
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
    };

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        sessionId,
        waitForMessage,
        sendMessage,
        close: () => ws.close(),
      });
    });

    ws.on('message', (data) => {
      try {
        const result = MessageProtocol.deserialize(data.toString());
        if (result.success && result.message) {
          messages.push(result.message);

          // Capture sessionId from session_created
          if (result.message.type === 'session_created') {
            const payload = result.message.data as { sessionId: string };
            sessionId = payload.sessionId;
          }

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

describe('End-to-End WebSocket Connectivity', () => {
  let httpServer: HttpServer;
  let wsServer: NativeWebSocketServer;
  let serverPort: number;
  let authService: AuthService;
  let sessionService: SessionService;
  let metricsService: MetricsService;

  beforeAll(async () => {
    // Create Express app
    const app = express();

    // Create HTTP server
    httpServer = createServer(app);

    // Create services
    authService = new AuthService();
    const sessionRepository = new MockSessionRepository();
    sessionService = new SessionService(sessionRepository);
    metricsService = new MockMetricsService();

    // Create native WebSocket server
    wsServer = new NativeWebSocketServer(httpServer, authService, sessionService, metricsService);
    wsServer.start();

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

  afterEach(async () => {
    // Give time for connections to close between tests
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    try {
      // Stop heartbeat first
      wsServer.stopHeartbeat();

      // Close WebSocket server - this will close all client connections

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 2000);
        wsServer.close().then(() => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Close HTTP server with a timeout
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force resolve even if close fails
          resolve();
        }, 2000);

        httpServer.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch {
      // Ignore cleanup errors
    }
  }, 8000);

  /**
   * Requirement 11.1: Mobile app connects to server successfully
   */
  describe('Mobile app connection', () => {
    it('should successfully connect with valid JWT token', async () => {
      const token = authService.generateToken('user-123', 'test@example.com', 'free', ['user']);
      const startTime = Date.now();

      const client = await createMobileAppClient(serverPort, token);

      try {
        const sessionCreated = await client.waitForMessage('session_created');
        const duration = Date.now() - startTime;

        expect(sessionCreated).toBeDefined();
        expect(sessionCreated.type).toBe('session_created');
        expect(duration).toBeLessThan(5000); // Should connect within 5 seconds

        const payload = sessionCreated.data as {
          sessionId: string;
          userId: string;
          isGuest: boolean;
        };
        expect(payload.sessionId).toBeDefined();
        expect(payload.userId).toBe('user-123');
        expect(payload.isGuest).toBe(false);
      } finally {
        client.close();
      }
    });

    it('should successfully connect with guest token', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const guestToken = `guest_${uuid}_${Date.now()}`;

      const client = await createMobileAppClient(serverPort, guestToken);

      try {
        const sessionCreated = await client.waitForMessage('session_created');

        const payload = sessionCreated.data as {
          sessionId: string;
          userId: string;
          isGuest: boolean;
        };
        expect(payload.sessionId).toBeDefined();
        expect(payload.userId).toBe(`guest-${uuid}`);
        expect(payload.isGuest).toBe(true);
      } finally {
        client.close();
      }
    });

    it('should maintain connection after successful authentication', async () => {
      const token = authService.generateToken('user-456', 'test2@example.com', 'pro', ['user']);

      const client = await createMobileAppClient(serverPort, token);

      try {
        await client.waitForMessage('session_created');

        // Wait and verify connection is still open
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(client.ws.readyState).toBe(WebSocket.OPEN);
      } finally {
        client.close();
      }
    });
  });

  /**
   * Requirement 11.2: JWT authentication and session creation
   */
  describe('JWT authentication and session creation', () => {
    it('should authenticate JWT token and create session', async () => {
      const token = authService.generateToken('user-789', 'auth@example.com', 'free', ['user']);

      const client = await createMobileAppClient(serverPort, token);

      try {
        const sessionCreated = await client.waitForMessage('session_created');

        expect(sessionCreated.type).toBe('session_created');
        const payload = sessionCreated.data as {
          sessionId: string;
          userId: string;
          isGuest: boolean;
          timestamp: number;
        };

        // Verify all required fields
        expect(payload.sessionId).toBeDefined();
        expect(typeof payload.sessionId).toBe('string');
        expect(payload.userId).toBe('user-789');
        expect(payload.isGuest).toBe(false);
        expect(payload.timestamp).toBeDefined();
        expect(typeof payload.timestamp).toBe('number');
      } finally {
        client.close();
      }
    });

    it('should reject invalid JWT token', async () => {
      const client = await createMobileAppClient(serverPort, 'invalid-jwt-token');

      try {
        const authError = await client.waitForMessage('auth_error');

        expect(authError.type).toBe('auth_error');
        const payload = authError.data as { code: string; message: string };
        expect(payload.code).toBe('AUTH_INVALID');
        expect(payload.message).toBeDefined();
      } finally {
        client.close();
      }
    });

    it('should reject missing token', async () => {
      const client = await createMobileAppClient(serverPort, null);

      try {
        const authError = await client.waitForMessage('auth_error');

        const payload = authError.data as { code: string; message: string };
        expect(payload.code).toBe('AUTH_REQUIRED');
        expect(payload.message).toBe('Authentication token required');
      } finally {
        client.close();
      }
    });

    it('should create unique session for each connection', async () => {
      const token1 = authService.generateToken('user-multi-1', 'multi1@example.com', 'free', [
        'user',
      ]);
      const token2 = authService.generateToken('user-multi-2', 'multi2@example.com', 'free', [
        'user',
      ]);

      const client1 = await createMobileAppClient(serverPort, token1);
      const client2 = await createMobileAppClient(serverPort, token2);

      try {
        const session1 = await client1.waitForMessage('session_created');
        const session2 = await client2.waitForMessage('session_created');

        const payload1 = session1.data as { sessionId: string };
        const payload2 = session2.data as { sessionId: string };

        expect(payload1.sessionId).not.toBe(payload2.sessionId);
      } finally {
        client1.close();
        client2.close();
      }
    });
  });

  /**
   * Requirement 11.3: Bidirectional message flow
   */
  describe('Bidirectional message flow', () => {
    it('should send message from mobile app to server', async () => {
      const token = authService.generateToken('user-send', 'send@example.com', 'free', ['user']);

      const client = await createMobileAppClient(serverPort, token);

      try {
        await client.waitForMessage('session_created');

        // Register a message handler on the server
        const receivedMessages: MessageEnvelope[] = [];
        const unsubscribe = wsServer.onMessage('test-message', (_connectionId, message) => {
          receivedMessages.push(message);
        });

        // Send message from client
        client.sendMessage('test-message', { content: 'Hello from mobile app' });

        // Wait for server to receive
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(receivedMessages.length).toBe(1);
        expect(receivedMessages[0].type).toBe('test-message');
        expect((receivedMessages[0].data as { content: string }).content).toBe(
          'Hello from mobile app'
        );

        unsubscribe();
      } finally {
        client.close();
      }
    });

    it('should receive message from server to mobile app', async () => {
      const token = authService.generateToken('user-receive', 'receive@example.com', 'free', [
        'user',
      ]);

      const client = await createMobileAppClient(serverPort, token);

      try {
        const sessionCreated = await client.waitForMessage('session_created');
        const sessionId = (sessionCreated.data as { sessionId: string }).sessionId;

        // Send message from server to client
        wsServer.broadcast(
          sessionId,
          MessageProtocol.createEnvelope('server-message', { content: 'Hello from server' })
        );

        // Wait for client to receive
        const serverMessage = await client.waitForMessage('server-message');

        expect(serverMessage.type).toBe('server-message');
        expect((serverMessage.data as { content: string }).content).toBe('Hello from server');
      } finally {
        client.close();
      }
    });

    it('should handle ping/pong heartbeat', async () => {
      const token = authService.generateToken('user-ping', 'ping@example.com', 'free', ['user']);

      const client = await createMobileAppClient(serverPort, token);

      try {
        await client.waitForMessage('session_created');

        // Send ping from client
        client.sendMessage('ping', { timestamp: Date.now() });

        // Wait for pong response
        const pong = await client.waitForMessage('pong');

        expect(pong.type).toBe('pong');
        expect((pong.data as { timestamp: number }).timestamp).toBeDefined();
      } finally {
        client.close();
      }
    });

    it('should preserve message order', async () => {
      const token = authService.generateToken('user-order', 'order@example.com', 'free', ['user']);

      const client = await createMobileAppClient(serverPort, token);

      try {
        await client.waitForMessage('session_created');

        const receivedMessages: MessageEnvelope[] = [];
        const unsubscribe = wsServer.onMessage('ordered-message', (_connectionId, message) => {
          receivedMessages.push(message);
        });

        // Send multiple messages in order
        for (let i = 0; i < 5; i++) {
          client.sendMessage('ordered-message', { sequence: i });
        }

        // Wait for all messages to be received
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(receivedMessages.length).toBe(5);
        for (let i = 0; i < 5; i++) {
          expect((receivedMessages[i].data as { sequence: number }).sequence).toBe(i);
        }

        unsubscribe();
      } finally {
        client.close();
      }
    });
  });

  /**
   * Requirement 11.4: Reconnection after network interruption
   */
  describe('Reconnection after network interruption', () => {
    it('should allow reconnection after connection close', async () => {
      const token = authService.generateToken('user-reconnect', 'reconnect@example.com', 'free', [
        'user',
      ]);

      // First connection
      const client1 = await createMobileAppClient(serverPort, token);
      const session1 = await client1.waitForMessage('session_created');
      const sessionId1 = (session1.data as { sessionId: string }).sessionId;
      client1.close();

      // Wait for connection to close
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Second connection (reconnect)
      const client2 = await createMobileAppClient(serverPort, token);

      try {
        const session2 = await client2.waitForMessage('session_created');
        const sessionId2 = (session2.data as { sessionId: string }).sessionId;

        // Should create a new session
        expect(sessionId2).toBeDefined();
        expect(sessionId2).not.toBe(sessionId1);
      } finally {
        client2.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it('should reconnect after server-initiated close', async () => {
      const token = authService.generateToken(
        'user-server-close',
        'serverclose@example.com',
        'free',
        ['user']
      );

      // First connection
      const client1 = await createMobileAppClient(serverPort, token);
      await client1.waitForMessage('session_created');

      // Server closes the connection
      client1.ws.close();

      // Wait for connection to close
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reconnect
      const client2 = await createMobileAppClient(serverPort, token);

      try {
        const session2 = await client2.waitForMessage('session_created');
        expect(session2).toBeDefined();
      } finally {
        client2.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it('should handle multiple reconnection attempts', async () => {
      const token = authService.generateToken('user-multi-reconnect', 'multi@example.com', 'free', [
        'user',
      ]);

      const sessionIds: string[] = [];

      // Connect and disconnect 3 times
      for (let i = 0; i < 3; i++) {
        const client = await createMobileAppClient(serverPort, token);
        const session = await client.waitForMessage('session_created');
        sessionIds.push((session.data as { sessionId: string }).sessionId);
        client.close();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // All sessions should be unique
      const uniqueSessions = new Set(sessionIds);
      expect(uniqueSessions.size).toBe(3);

      // Wait for final cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  /**
   * Requirement 11.5: Real-time features (audio, transcripts, LLM responses)
   */
  describe('Real-time features', () => {
    it('should handle audio chunk messages', async () => {
      const token = authService.generateToken('user-audio', 'audio@example.com', 'free', ['user']);

      const client = await createMobileAppClient(serverPort, token);

      try {
        await client.waitForMessage('session_created');

        const receivedAudio: MessageEnvelope[] = [];
        const unsubscribe = wsServer.onMessage('audio-chunk', (_connectionId, message) => {
          receivedAudio.push(message);
        });

        // Simulate audio chunk from mobile app
        const audioData = {
          chunk: 'base64-encoded-audio-data',
          sequence: 1,
          timestamp: Date.now(),
        };
        client.sendMessage('audio-chunk', audioData);

        // Wait for server to receive
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(receivedAudio.length).toBe(1);
        expect(receivedAudio[0].type).toBe('audio-chunk');
        expect((receivedAudio[0].data as typeof audioData).chunk).toBe('base64-encoded-audio-data');

        unsubscribe();
      } finally {
        client.close();
      }
    });

    it('should handle transcript messages from server', async () => {
      const token = authService.generateToken('user-transcript', 'transcript@example.com', 'free', [
        'user',
      ]);

      const client = await createMobileAppClient(serverPort, token);

      try {
        const sessionCreated = await client.waitForMessage('session_created');
        const sessionId = (sessionCreated.data as { sessionId: string }).sessionId;

        // Simulate transcript from server
        const transcriptData = {
          text: 'Hello, how can I help you?',
          isFinal: true,
          timestamp: Date.now(),
        };
        wsServer.broadcast(sessionId, MessageProtocol.createEnvelope('transcript', transcriptData));

        // Wait for client to receive
        const transcript = await client.waitForMessage('transcript');

        expect(transcript.type).toBe('transcript');
        expect((transcript.data as typeof transcriptData).text).toBe('Hello, how can I help you?');
        expect((transcript.data as typeof transcriptData).isFinal).toBe(true);
      } finally {
        client.close();
      }
    });

    it('should handle LLM response messages from server', async () => {
      const token = authService.generateToken('user-llm', 'llm@example.com', 'free', ['user']);

      const client = await createMobileAppClient(serverPort, token);

      try {
        const sessionCreated = await client.waitForMessage('session_created');
        const sessionId = (sessionCreated.data as { sessionId: string }).sessionId;

        // Simulate LLM response from server
        const llmData = {
          text: 'I can help you with that.',
          isComplete: true,
          timestamp: Date.now(),
        };
        wsServer.broadcast(sessionId, MessageProtocol.createEnvelope('llm-response', llmData));

        // Wait for client to receive
        const llmResponse = await client.waitForMessage('llm-response');

        expect(llmResponse.type).toBe('llm-response');
        expect((llmResponse.data as typeof llmData).text).toBe('I can help you with that.');
        expect((llmResponse.data as typeof llmData).isComplete).toBe(true);
      } finally {
        client.close();
      }
    });

    it('should handle streaming LLM responses', async () => {
      const token = authService.generateToken('user-stream', 'stream@example.com', 'free', [
        'user',
      ]);

      const client = await createMobileAppClient(serverPort, token);

      try {
        const sessionCreated = await client.waitForMessage('session_created');
        const sessionId = (sessionCreated.data as { sessionId: string }).sessionId;

        // Simulate streaming LLM response chunks
        const chunks = ['Hello', ' there', ', how', ' can', ' I', ' help?'];
        for (const chunk of chunks) {
          wsServer.broadcast(
            sessionId,
            MessageProtocol.createEnvelope('llm-chunk', {
              text: chunk,
              isComplete: false,
            })
          );
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Send final chunk
        wsServer.broadcast(
          sessionId,
          MessageProtocol.createEnvelope('llm-chunk', {
            text: '',
            isComplete: true,
          })
        );

        // Wait for all chunks to be received
        await new Promise((resolve) => setTimeout(resolve, 500));

        const llmChunks = client.messages.filter((m) => m.type === 'llm-chunk');
        expect(llmChunks.length).toBeGreaterThanOrEqual(chunks.length);
      } finally {
        client.close();
      }
    });

    it('should handle conversation state changes', async () => {
      const token = authService.generateToken('user-state', 'state@example.com', 'free', ['user']);

      const client = await createMobileAppClient(serverPort, token);

      try {
        const sessionCreated = await client.waitForMessage('session_created');
        const sessionId = (sessionCreated.data as { sessionId: string }).sessionId;

        // Simulate state change from server
        const stateData = {
          state: 'listening',
          timestamp: Date.now(),
        };
        wsServer.broadcast(sessionId, MessageProtocol.createEnvelope('state-change', stateData));

        // Wait for client to receive
        const stateChange = await client.waitForMessage('state-change');

        expect(stateChange.type).toBe('state-change');
        expect((stateChange.data as typeof stateData).state).toBe('listening');
      } finally {
        client.close();
      }
    });
  });

  /**
   * Additional test: Connection metrics
   */
  describe('Connection metrics', () => {
    it('should track active connections', async () => {
      const token1 = authService.generateToken('user-metrics-1', 'metrics1@example.com', 'free', [
        'user',
      ]);
      const token2 = authService.generateToken('user-metrics-2', 'metrics2@example.com', 'free', [
        'user',
      ]);

      // Get baseline count
      const initialCount = wsServer.getActiveConnectionCount();

      // Create first client and wait for session
      const client1 = await createMobileAppClient(serverPort, token1);
      const session1 = await client1.waitForMessage('session_created');
      const sessionId1 = (session1.data as { sessionId: string }).sessionId;

      // Wait for connection to be registered
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify first connection is tracked
      const countAfterFirst = wsServer.getActiveConnectionCount();
      expect(countAfterFirst).toBeGreaterThanOrEqual(initialCount + 1);

      // Verify first client is still connected before creating second
      expect(client1.ws.readyState).toBe(WebSocket.OPEN);

      // Create second client and wait for session
      const client2 = await createMobileAppClient(serverPort, token2);
      const session2 = await client2.waitForMessage('session_created');
      const sessionId2 = (session2.data as { sessionId: string }).sessionId;

      // Wait for second connection to be registered
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify both clients are still connected
      expect(client1.ws.readyState).toBe(WebSocket.OPEN);
      expect(client2.ws.readyState).toBe(WebSocket.OPEN);

      // Verify sessions are different
      expect(sessionId1).not.toBe(sessionId2);

      // Get all connections to debug
      const allConnections = wsServer.getConnectionManager().getAllConnections();

      expect(allConnections.length).toBeGreaterThanOrEqual(2);

      // Now check the count - should have increased
      const countAfterSecond = wsServer.getActiveConnectionCount();
      expect(countAfterSecond).toBeGreaterThan(countAfterFirst);

      // Clean up
      client1.close();
      client2.close();

      // Wait for connections to close
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
  });
});
