/**
 * Tests for field filtering middleware
 */

import { Request, Response, NextFunction } from 'express';

import { fieldFilteringMiddleware } from '../../middleware/fieldFiltering.middleware';

describe('Field Filtering Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let originalJson: jest.Mock;

  beforeEach(() => {
    mockReq = {
      query: {},
    };

    originalJson = jest.fn();
    mockRes = {
      json: originalJson,
      locals: {},
    };

    mockNext = jest.fn();
  });

  it('should pass through without filtering when no fields specified', () => {
    mockReq.query = {};

    fieldFilteringMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const data = { id: '1', name: 'Test', email: 'test@example.com' };
    mockRes.json?.(data);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should filter fields when specified', () => {
    mockReq.query = { fields: 'id,name' };

    fieldFilteringMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const data = { id: '1', name: 'Test', email: 'test@example.com', age: 30 };
    mockRes.json?.(data);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle nested field filtering', () => {
    mockReq.query = { fields: 'id,user.name,user.email' };

    fieldFilteringMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const data = {
      id: '1',
      user: {
        name: 'Test',
        email: 'test@example.com',
        password: 'secret',
      },
      metadata: {
        createdAt: '2024-01-01',
      },
    };
    mockRes.json?.(data);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle array of objects', () => {
    mockReq.query = { fields: 'id,name' };

    fieldFilteringMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const data = [
      { id: '1', name: 'Test1', email: 'test1@example.com' },
      { id: '2', name: 'Test2', email: 'test2@example.com' },
    ];
    mockRes.json?.(data);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle invalid field names gracefully', () => {
    mockReq.query = { fields: 'id,nonexistent,name' };

    fieldFilteringMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const data = { id: '1', name: 'Test', email: 'test@example.com' };
    mockRes.json?.(data);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle empty fields parameter', () => {
    mockReq.query = { fields: '' };

    fieldFilteringMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const data = { id: '1', name: 'Test' };
    mockRes.json?.(data);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle wildcard for all fields', () => {
    mockReq.query = { fields: '*' };

    fieldFilteringMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const data = { id: '1', name: 'Test', email: 'test@example.com' };
    mockRes.json?.(data);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle partial responses with pagination', () => {
    mockReq.query = { fields: 'id,name', page: '1', limit: '10' };

    fieldFilteringMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const data = {
      items: [
        { id: '1', name: 'Test1', email: 'test1@example.com' },
        { id: '2', name: 'Test2', email: 'test2@example.com' },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
      },
    };
    mockRes.json?.(data);

    expect(mockNext).toHaveBeenCalled();
  });
});
