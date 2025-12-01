import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './config/swagger';
// import { compressionMiddleware } from './middleware/compression.middleware'; // TODO: Fix Express v5 type conflicts
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { etagMiddleware } from './middleware/etag.middleware';
import { fieldFilteringMiddleware } from './middleware/fieldFiltering.middleware';
import { paginationMiddleware } from './middleware/pagination.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { correlationIdMiddleware, requestLogger } from './middleware/requestLogger.middleware';
import v1Routes from './routes/v1';

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Response compression (gzip/brotli)
// TODO: Enable compression middleware after fixing Express v5 type conflicts
// app.use(compressionMiddleware);

// Request logging and correlation
app.use(correlationIdMiddleware);
app.use(requestLogger);

// Response optimization
app.use(etagMiddleware); // ETag for conditional requests
app.use(paginationMiddleware); // Pagination helpers
app.use(fieldFilteringMiddleware); // Field filtering for partial responses

// Rate limiting
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Conversational Clone API Documentation',
  })
);

// Serve OpenAPI spec as JSON
app.get('/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api/v1', v1Routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/docs`);
  console.log(`OpenAPI spec available at http://localhost:${PORT}/docs.json`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`[api-gateway] ${signal} received, shutting down...`);
  server.close(() => {
    console.log('[api-gateway] Server closed');
    process.exit(0);
  });
  // Force exit after 3 seconds
  setTimeout(() => process.exit(0), 3000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
