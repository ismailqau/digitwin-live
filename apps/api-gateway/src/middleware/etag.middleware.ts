/**
 * ETag middleware for conditional requests
 * Implements HTTP caching with ETags for efficient bandwidth usage
 */

import crypto from 'crypto';

import { logger } from '@clone/logger';
import { Request, Response, NextFunction } from 'express';

/**
 * Generate ETag from response body
 */
function generateETag(body: unknown): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  return `"${crypto.createHash('md5').update(content).digest('hex')}"`;
}

/**
 * ETag middleware for GET requests
 * Supports If-None-Match conditional requests
 */
export function etagMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only apply to GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to add ETag
  res.json = function (body: unknown): Response {
    // Generate ETag from response body
    const etag = generateETag(body);

    // Set ETag header
    res.setHeader('ETag', etag);

    // Check if client sent If-None-Match header
    const clientETag = req.headers['if-none-match'];

    if (clientETag === etag) {
      // Content hasn't changed, return 304 Not Modified
      logger.debug('ETag match, returning 304', {
        path: req.path,
        etag,
      });

      res.status(304).end();
      return res;
    }

    // Content changed or no ETag from client, return full response
    return originalJson(body);
  };

  next();
}

/**
 * Strong ETag middleware (byte-for-byte comparison)
 * Use for static content that doesn't change
 */
export function strongETagMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function (body: unknown): Response {
    const etag = generateETag(body);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache

    const clientETag = req.headers['if-none-match'];

    if (clientETag === etag) {
      res.status(304).end();
      return res;
    }

    return originalJson(body);
  };

  next();
}

/**
 * Weak ETag middleware (semantic comparison)
 * Use for dynamic content that may have minor differences
 */
export function weakETagMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function (body: unknown): Response {
    const etag = `W/${generateETag(body)}`; // Weak ETag prefix
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes cache

    const clientETag = req.headers['if-none-match'];

    // Weak comparison (ignore W/ prefix)
    const normalizedClientETag = clientETag?.replace(/^W\//, '');
    const normalizedServerETag = etag.replace(/^W\//, '');

    if (normalizedClientETag === normalizedServerETag) {
      res.status(304).end();
      return res;
    }

    return originalJson(body);
  };

  next();
}
