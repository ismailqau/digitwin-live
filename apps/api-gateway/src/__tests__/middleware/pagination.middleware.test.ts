/**
 * Tests for pagination middleware
 */

import { Request, Response, NextFunction } from 'express';

import { paginationMiddleware } from '../../middleware/pagination.middleware';

describe('Pagination Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      query: {},
    };

    mockRes = {
      locals: {},
    };

    mockNext = jest.fn();
  });

  it('should parse page and limit from query params', () => {
    mockReq.query = { page: '2', limit: '20' };

    paginationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).pagination).toEqual({
      page: 2,
      limit: 20,
      offset: 20,
      sortOrder: 'desc',
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use default values when not provided', () => {
    mockReq.query = {};

    paginationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).pagination).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
      sortOrder: 'desc',
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle invalid page number', () => {
    mockReq.query = { page: 'invalid', limit: '10' };

    paginationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).pagination.page).toBe(1);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle invalid limit', () => {
    mockReq.query = { page: '1', limit: 'invalid' };

    paginationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).pagination.limit).toBe(20);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should enforce maximum limit', () => {
    mockReq.query = { page: '1', limit: '1000' };

    paginationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).pagination.limit).toBeLessThanOrEqual(100);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should enforce minimum page number', () => {
    mockReq.query = { page: '0', limit: '10' };

    paginationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).pagination.page).toBeGreaterThanOrEqual(1);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should calculate correct offset', () => {
    const testCases = [
      { page: 1, limit: 10, expectedOffset: 0 },
      { page: 2, limit: 10, expectedOffset: 10 },
      { page: 3, limit: 20, expectedOffset: 40 },
      { page: 5, limit: 25, expectedOffset: 100 },
    ];

    testCases.forEach(({ page, limit, expectedOffset }) => {
      mockReq.query = { page: page.toString(), limit: limit.toString() };
      mockRes.locals = {};
      mockNext = jest.fn();

      paginationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).pagination.offset).toBe(expectedOffset);
    });
  });

  it('should handle sorting parameters', () => {
    mockReq.query = {
      page: '1',
      limit: '10',
      sortBy: 'createdAt',
      order: 'desc',
    };

    paginationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).pagination).toMatchObject({
      page: 1,
      limit: 10,
      offset: 0,
      sortBy: 'createdAt',
    });
    expect(mockNext).toHaveBeenCalled();
  });
});
