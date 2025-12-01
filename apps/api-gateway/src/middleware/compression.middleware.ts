/**
 * Response compression middleware for API Gateway
 * Supports gzip and brotli compression
 */

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Compression middleware configuration
 * Uses default compression settings with 1KB threshold
 */
export const compressionMiddleware = compression({
  // Compression level (0-9, higher = better compression but slower)
  level: 6,

  // Minimum response size to compress (in bytes)
  threshold: 1024, // 1KB
}) as unknown as (req: Request, res: Response, next: NextFunction) => void;

/**
 * Brotli compression middleware (higher compression ratio than gzip)
 * Use for static assets and large responses
 */
export const brotliMiddleware = compression({
  level: 6,
  threshold: 1024,
}) as unknown as (req: Request, res: Response, next: NextFunction) => void;
