/**
 * Tests for pagination middleware
 */

import { Request, Response } from 'express';

import {
  parsePaginationParams,
  createPaginatedResponse,
  paginationMiddleware,
  validatePaginationParams,
  PaginatedRequest,
  PaginatedResponse,
} from '../../middleware/pagination.middleware';

describe('Pagination Middleware', () => {
  describe('parsePaginationParams', () => {
    it('should parse valid pagination parameters', () => {
      const req = {
        query: {
          page: '2',
          limit: '50',
          sortBy: 'createdAt',
          sortOrder: 'asc',
        },
      } as unknown as Request;

      const params = parsePaginationParams(req);

      expect(params).toEqual({
        page: 2,
        limit: 50,
        offset: 50,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });
    });

    it('should use default values for missing parameters', () => {
      const req = { query: {} } as unknown as Request;

      const params = parsePaginationParams(req);

      expect(params).toEqual({
        page: 1,
        limit: 20,
        offset: 0,
        sortBy: undefined,
        sortOrder: 'desc',
      });
    });

    it('should enforce maximum limit of 100', () => {
      const req = {
        query: { limit: '200' },
      } as unknown as Request;

      const params = parsePaginationParams(req);

      expect(params.limit).toBe(100);
    });

    it('should enforce minimum page of 1', () => {
      const req = {
        query: { page: '0' },
      } as unknown as Request;

      const params = parsePaginationParams(req);

      expect(params.page).toBe(1);
    });

    it('should calculate correct offset', () => {
      const req = {
        query: { page: '3', limit: '25' },
      } as unknown as Request;

      const params = parsePaginationParams(req);

      expect(params.offset).toBe(50); // (3-1) * 25
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create paginated response with correct metadata', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const total = 100;
      const params = {
        page: 2,
        limit: 20,
        offset: 20,
        sortOrder: 'desc' as const,
      };

      const response = createPaginatedResponse(data, total, params);

      expect(response).toEqual({
        data,
        pagination: {
          page: 2,
          limit: 20,
          total: 100,
          totalPages: 5,
          hasNext: true,
          hasPrev: true,
        },
      });
    });

    it('should indicate no next page on last page', () => {
      const data = [{ id: 1 }];
      const total = 21;
      const params = {
        page: 2,
        limit: 20,
        offset: 20,
        sortOrder: 'desc' as const,
      };

      const response = createPaginatedResponse(data, total, params);

      expect(response.pagination.hasNext).toBe(false);
      expect(response.pagination.hasPrev).toBe(true);
    });

    it('should indicate no previous page on first page', () => {
      const data = [{ id: 1 }];
      const total = 1;
      const params = {
        page: 1,
        limit: 20,
        offset: 0,
        sortOrder: 'desc' as const,
      };

      const response = createPaginatedResponse(data, total, params);

      expect(response.pagination.hasNext).toBe(false);
      expect(response.pagination.hasPrev).toBe(false);
    });
  });

  describe('paginationMiddleware', () => {
    it('should attach pagination params to request', () => {
      const req = {
        query: { page: '2', limit: '30' },
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      paginationMiddleware(req, res, next);

      expect((req as PaginatedRequest).pagination).toEqual({
        page: 2,
        limit: 30,
        offset: 30,
        sortBy: undefined,
        sortOrder: 'desc',
      });
      expect(next).toHaveBeenCalled();
    });

    it('should attach paginate helper to response', () => {
      const req = { query: {} } as unknown as Request;
      const res = {
        setHeader: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      paginationMiddleware(req, res, next);

      expect((res as PaginatedResponse).paginate).toBeDefined();
      expect(typeof (res as PaginatedResponse).paginate).toBe('function');
    });
  });

  describe('validatePaginationParams', () => {
    it('should pass validation for valid parameters', () => {
      const req = {
        query: { page: '1', limit: '50' },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      validatePaginationParams(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid page parameter', () => {
      const req = {
        query: { page: 'invalid' },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      validatePaginationParams(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid pagination parameter',
        message: 'Page must be a positive integer',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject limit exceeding maximum', () => {
      const req = {
        query: { limit: '150' },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      validatePaginationParams(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid pagination parameter',
        message: 'Limit must be between 1 and 100',
      });
    });
  });
});
