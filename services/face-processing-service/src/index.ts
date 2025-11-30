import { loadConfig } from '@clone/config';
import { BaseError } from '@clone/errors';
import { createLogger } from '@clone/logger';
import express, { Request, Response, NextFunction } from 'express';
import type { Express } from 'express';

import faceEmbeddingRoutes from './routes/face-embedding.routes';
import faceValidationRoutes from './routes/face-validation.routes';

// Export services for external use
export { FaceDetectionService } from './services/face-detection.service';
export { FaceQualityService } from './services/face-quality.service';
export { FacePreprocessingService } from './services/face-preprocessing.service';
export { BatchProcessorService } from './services/batch-processor.service';
export { MediaPipeAdapterService } from './services/mediapipe-adapter.service';
export { FaceEmbeddingService } from './services/face-embedding.service';
export { ExpressionTemplateService } from './services/expression-template.service';
export { FaceModelStorageService } from './services/face-model-storage.service';
export { FaceModelPreviewService } from './services/face-model-preview.service';
export { GPUWorkerService } from './services/gpu-worker.service';

export const FACE_PROCESSING_SERVICE_VERSION = '1.0.0';

const logger = createLogger('face-processing-service');
const config = loadConfig();
const app: Express = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    contentLength: req.headers['content-length'],
  });
  next();
});

// Routes
app.use('/api/v1/face', faceValidationRoutes);
app.use('/api/v1/face/embedding', faceEmbeddingRoutes);

// Root health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    service: 'face-processing-service',
    version: FACE_PROCESSING_SERVICE_VERSION,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
  });

  if (err instanceof BaseError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        recoverable: err.recoverable,
        details: err.details,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      recoverable: false,
    },
  });
});

// Start server if running standalone
if (require.main === module) {
  const port = config.port || 3006;

  app.listen(port, () => {
    logger.info(`Face Processing Service started`, {
      port,
      version: FACE_PROCESSING_SERVICE_VERSION,
      env: config.env,
    });
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;
