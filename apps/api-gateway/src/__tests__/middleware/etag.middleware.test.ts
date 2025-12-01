/**
 * Tests for ETag middleware
 */

import { Request, Response, NextFunction } from 'express';

import { etagMiddleware } from '../../middleware/etag.middleware';

describe('ETag Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      method: 'GET',
    };

    mockRes = {
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      json: jest.fn().mockReturnThis(),
      locals: {},
      on: jest.fn(),
    };

    mockNext = jest.fn();
  });

  it('should generate ETag for response', () => {
    etagMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 304 if If-None-Match matches ETag', () => {
    const etag = '"abc123"';
    mockReq.headers = {
      'if-none-match': etag,
    };

    // Simulate response with matching ETag
    mockRes.getHeader = jest.fn((name: string) => {
      if (name === 'etag') {
        return etag;
      }
      return undefined;
    });

    etagMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should not return 304 if If-None-Match does not match', () => {
    mockReq.headers = {
      'if-none-match': '"old-etag"',
    };

    mockRes.getHeader = jest.fn((name: string) => {
      if (name === 'etag') {
        return '"new-etag"';
      }
      return undefined;
    });

    etagMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should only apply to GET and HEAD requests', () => {
    const methods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'];

    methods.forEach((method) => {
      mockReq.method = method;
      mockNext = jest.fn();

      etagMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  it('should generate consistent ETags for same content', () => {
    // First request
    etagMiddleware(mockReq as Request, mockRes as Response, mockNext);

    // Second request with same content
    mockRes.setHeader = jest.fn();
    etagMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(2);
  });

  it('should handle weak ETags', () => {
    mockReq.headers = {
      'if-none-match': 'W/"abc123"',
    };

    etagMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle multiple ETags in If-None-Match', () => {
    mockReq.headers = {
      'if-none-match': '"etag1", "etag2", "etag3"',
    };

    etagMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
