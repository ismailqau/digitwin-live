import 'reflect-metadata';
import { createServer } from 'http';
import { resolve } from 'path';

import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../../.env') });

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

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'websocket-server',
      timestamp: new Date().toISOString(),
    });
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

  // Handle WebSocket connections
  io.on('connection', (socket) => {
    wsController.handleConnection(socket);
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
