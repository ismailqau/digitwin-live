import 'reflect-metadata';
import { createServer } from 'http';
import { resolve } from 'path';

import { DatabaseConnection } from '@clone/database';
import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../../.env') });

import { AuthService } from './application/services/AuthService';
import { getHealthService } from './application/services/health.service';
import { MetricsService } from './application/services/MetricsService';
import { SessionService } from './application/services/SessionService';
import { setupContainer, container } from './infrastructure/config/container';
import logger from './infrastructure/logging/logger';
import { NativeWebSocketServer } from './infrastructure/websocket/NativeWebSocketServer';
import { WebSocketController } from './presentation/controllers/WebSocketController';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '8080', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

async function bootstrap(): Promise<void> {
  // Debug environment variables
  logger.info('[websocket-server] Environment check:', {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDatabaseHost: !!process.env.DATABASE_HOST,
    hasDatabaseUser: !!process.env.DATABASE_USER,
    hasDatabasePassword: !!process.env.DATABASE_PASSWORD,
    databaseHost: process.env.DATABASE_HOST,
    databaseName: process.env.DATABASE_NAME,
  });

  // Initialize database connection
  logger.info('[websocket-server] Initializing database connection...');
  await DatabaseConnection.connect();
  logger.info('[websocket-server] Database connected successfully');

  // Setup dependency injection
  setupContainer();

  // Create Express app
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json());

  // Health check endpoints
  const healthService = getHealthService();

  // Get services from DI container
  const metricsService = container.resolve(MetricsService);
  const authService = container.resolve(AuthService);
  const sessionService = container.resolve(SessionService);
  const wsController = container.resolve(WebSocketController);

  // Full health check with dependency status
  app.get('/health', async (_req, res) => {
    try {
      const health = await healthService.getHealthCheck();
      const statusCode =
        health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch {
      res.status(503).json({
        status: 'unhealthy',
        service: 'websocket-server',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  });

  // Readiness check - is the service ready to accept traffic?
  app.get('/health/ready', async (_req, res) => {
    try {
      const readiness = await healthService.getReadinessCheck();
      const statusCode = readiness.ready ? 200 : 503;
      res.status(statusCode).json(readiness);
    } catch {
      res.status(503).json({
        ready: false,
        service: 'websocket-server',
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed',
      });
    }
  });

  // Liveness check - minimal check for Cloud Run probes
  app.get('/health/live', async (_req, res) => {
    try {
      const liveness = await healthService.getLivenessCheck();
      res.status(200).json(liveness);
    } catch {
      res.status(503).json({
        status: 'unhealthy',
        service: 'websocket-server',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Metrics endpoint
  app.get('/metrics', (_req, res) => {
    try {
      const metrics = metricsService.getMetricsSummary();
      const alerts = metricsService.getAlertStatus();

      res.json({
        service: 'websocket-server',
        timestamp: new Date().toISOString(),
        metrics,
        alerts,
        activeConnections: wsServer.getActiveConnectionCount(),
      });
    } catch (error) {
      logger.error('[websocket-server] Failed to get metrics', { error });
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        service: 'websocket-server',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Create native WebSocket server
  const wsServer = new NativeWebSocketServer(
    httpServer,
    authService,
    sessionService,
    metricsService
  );

  // Register connection handler
  wsServer.onConnection((connectionId, connection) => {
    logger.info('[websocket-server] New connection', {
      connectionId,
      sessionId: connection.sessionId,
      userId: connection.userId,
      timestamp: Date.now(),
    });

    // Notify WebSocketController
    wsController.handleConnection(connectionId, connection);

    // Update health service with connection count
    healthService.setActiveConnections(wsServer.getActiveConnectionCount());
  });

  // Register disconnection handler
  wsServer.onDisconnection((connectionId, code, reason) => {
    logger.info('[websocket-server] Connection closed', {
      connectionId,
      code,
      reason,
      timestamp: Date.now(),
    });

    // Notify WebSocketController
    wsController.handleDisconnection(connectionId, code, reason);

    // Update health service with connection count
    healthService.setActiveConnections(wsServer.getActiveConnectionCount());
  });

  // Register message handlers for client messages
  wsServer.onMessage('message', async (connectionId, message) => {
    const connection = wsServer.getConnectionManager().getConnection(connectionId);
    if (connection?.sessionId) {
      await wsController.handleMessage(connectionId, message, connection.sessionId);
    }
  });

  wsServer.onMessage('audio_chunk', async (connectionId, message) => {
    const connection = wsServer.getConnectionManager().getConnection(connectionId);
    if (connection?.sessionId) {
      await wsController.handleMessage(connectionId, message, connection.sessionId);
    }
  });

  wsServer.onMessage('interruption', async (connectionId, message) => {
    const connection = wsServer.getConnectionManager().getConnection(connectionId);
    if (connection?.sessionId) {
      await wsController.handleMessage(connectionId, message, connection.sessionId);
    }
  });

  wsServer.onMessage('end_utterance', async (connectionId, message) => {
    const connection = wsServer.getConnectionManager().getConnection(connectionId);
    if (connection?.sessionId) {
      await wsController.handleMessage(connectionId, message, connection.sessionId);
    }
  });

  wsServer.onMessage('retry_asr', async (connectionId, message) => {
    const connection = wsServer.getConnectionManager().getConnection(connectionId);
    if (connection?.sessionId) {
      await wsController.handleMessage(connectionId, message, connection.sessionId);
    }
  });

  // Start the WebSocket server
  wsServer.start();

  // Start HTTP server - bind to 0.0.0.0 to accept connections from network
  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    logger.info(`WebSocket server listening on port ${PORT} (0.0.0.0)`);
    logger.info(`CORS origin: ${CORS_ORIGIN}`);
    logger.info('Using native WebSocket (ws library)');
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[websocket-server] ${signal} received, shutting down...`);

    // Close WebSocket server
    await wsServer.close();
    logger.info('[websocket-server] WebSocket server closed');

    // Close HTTP server
    httpServer.close(() => {
      logger.info('[websocket-server] HTTP server closed');
      DatabaseConnection.disconnect().then(() => {
        logger.info('[websocket-server] Database connection closed');
        process.exit(0);
      });
    });

    // Force exit after 3 seconds
    setTimeout(() => process.exit(0), 3000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
