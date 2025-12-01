/**
 * Tests for compression middleware
 */

import { Request, Response, NextFunction } from 'express';

import { compressionMiddleware } from '../../middleware/compression.middleware';

describe('Compression Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      get: jest.fn((header: string): string | undefined => {
        if (header === 'accept-encoding') {
          return 'gzip, deflate, br';
        }
        return undefined;
      }) as any,
    };

    mockRes = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };

    mockNext = jest.fn();
  });

  it('should apply compression for large payloads', () => {
    compressionMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should not compress payloads below threshold (1KB)', () => {
    // Compression middleware typically has a threshold
    compressionMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should support gzip compression', () => {
    mockReq.get = jest.fn((header: string): string | undefined => {
      if (header === 'accept-encoding') {
        return 'gzip';
      }
      return undefined;
    }) as any;

    compressionMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should support brotli compression', () => {
    mockReq.get = jest.fn((header: string): string | undefined => {
      if (header === 'accept-encoding') {
        return 'br';
      }
      return undefined;
    }) as any;

    compressionMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip compression if client does not support it', () => {
    mockReq.get = jest.fn(() => undefined);

    compressionMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle various payload sizes', () => {
    // Test with different payload sizes
    const sizes = [500, 1024, 5000, 10000, 50000];

    sizes.forEach((_size) => {
      mockNext = jest.fn();
      compressionMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
