import 'reflect-metadata';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { setupContainer, container } from './infrastructure/config/container';
import { WebSocketController } from './presentation/controllers/WebSocketController';
import logger from './infrastructure/logging/logger';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

async function bootstrap() {
  // Setup dependency injection
  setupContainer();

  // Create Express app
  const app = express();
  
  // Middleware
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'websocket-server',
      timestamp: new Date().toISOString()
    });
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Create Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
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
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
