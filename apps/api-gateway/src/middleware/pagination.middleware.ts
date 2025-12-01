/**
 * Pagination middleware and utilities for API Gateway
 * Provides consistent pagination across all list endpoints
 */

import { logger } from '@clone/logger';
import { Request, Response, NextFunction } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponseData<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Default pagination configuration
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse pagination parameters from request query
 */
export function parsePaginationParams(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;
  const sortBy = (req.query.sortBy as string) || undefined;
  const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

  return {
    page,
    limit,
    offset,
    sortBy,
    sortOrder,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponseData<T> {
  const totalPages = Math.ceil(total / params.limit);
  const hasNext = params.page < totalPages;
  const hasPrev = params.page > 1;

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
}

// Extend Express Request and Response types
export interface PaginatedRequest extends Request {
  pagination?: PaginationParams;
}

export interface PaginatedResponse extends Response {
  paginate?<T>(data: T[], total: number): void;
}

/**
 * Pagination middleware that adds pagination helpers to request
 */
export function paginationMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const paginatedReq = req as PaginatedRequest;
    const paginatedRes = res as PaginatedResponse;

    // Parse pagination params and attach to request
    paginatedReq.pagination = parsePaginationParams(req);

    // Add helper function to create paginated response
    paginatedRes.paginate = function <T>(data: T[], total: number): void {
      const paginationParams = paginatedReq.pagination as PaginationParams;
      const response = createPaginatedResponse(data, total, paginationParams);

      // Add pagination headers
      res.setHeader('X-Total-Count', total.toString());
      res.setHeader('X-Page', paginationParams.page.toString());
      res.setHeader('X-Per-Page', paginationParams.limit.toString());
      res.setHeader('X-Total-Pages', response.pagination.totalPages.toString());

      // Send response
      res.json(response);
    };

    next();
  } catch (error) {
    logger.error('Pagination middleware error', { error: (error as Error).message });
    next(error);
  }
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(req: Request, res: Response, next: NextFunction) {
  const page = parseInt(req.query.page as string, 10);
  const limit = parseInt(req.query.limit as string, 10);

  if (req.query.page && (isNaN(page) || page < 1)) {
    res.status(400).json({
      error: 'Invalid pagination parameter',
      message: 'Page must be a positive integer',
    });
    return;
  }

  if (req.query.limit && (isNaN(limit) || limit < 1 || limit > MAX_LIMIT)) {
    res.status(400).json({
      error: 'Invalid pagination parameter',
      message: `Limit must be between 1 and ${MAX_LIMIT}`,
    });
    return;
  }

  next();
}
