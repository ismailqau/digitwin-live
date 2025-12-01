import 'reflect-metadata';
import { createServer } from 'http';
import { resolve } from 'path';

import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../../.env') });

import { getHealthService } from './application/services/health.service';
import { setupContainer, container } from './infrastructure/config/container';
import logger from './infrastructure/logging/logger';
import { WebSocketController } from './presentation/controllers/WebSocketController';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

async function bootstrap() {
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

  // Create HTTP server
  const httpServer = createServer(app);

  // Create Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Get WebSocket controller from DI container
  const wsController = container.resolve(WebSocketController);

  // Handle WebSocket connections and track connection count
  io.on('connection', (socket) => {
    wsController.handleConnection(socket);
    // Update health service with connection count
    healthService.setActiveConnections(io.engine.clientsCount);

    socket.on('disconnect', () => {
      healthService.setActiveConnections(io.engine.clientsCount);
    });
  });

  // Start server
  httpServer.listen(PORT, () => {
    logger.info(`WebSocket server listening on port ${PORT}`);
    logger.info(`CORS origin: ${CORS_ORIGIN}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`[websocket-server] ${signal} received, shutting down...`);
    io.close();
    httpServer.close(() => {
      logger.info('[websocket-server] Server closed');
      process.exit(0);
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
