/**
 * Tests for AuditLogger
 */

import { PrismaClient } from '@prisma/client';
import type { Logger } from 'winston';

import { AuditLogger } from './audit-logger';
import { AuditAction } from './types';

// Mock Prisma
const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogger = new AuditLogger(mockPrisma, mockLogger);
  });

  describe('log', () => {
    it('should create audit log entry', async () => {
      const entry = {
        userId: 'user-123',
        action: AuditAction.DOCUMENT_UPLOAD,
        resource: 'document:doc-123',
        result: 'success' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { filename: 'test.pdf' },
      };

      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'log-123',
        ...entry,
      });

      await auditLogger.log(entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: entry,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Audit log created',
        expect.objectContaining({
          userId: entry.userId,
          action: entry.action,
        })
      );
    });

    it('should not throw on audit log failure', async () => {
      const entry = {
        userId: 'user-123',
        action: AuditAction.DOCUMENT_UPLOAD,
        resource: 'document:doc-123',
        result: 'success' as const,
      };

      (mockPrisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(auditLogger.log(entry)).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('logAuth', () => {
    it('should log authentication event', async () => {
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await auditLogger.logAuth(
        'user-123',
        AuditAction.USER_LOGIN,
        'success',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.USER_LOGIN,
          resource: 'authentication',
          result: 'success',
        }),
      });
    });
  });

  describe('logDocumentOperation', () => {
    it('should log document operation', async () => {
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await auditLogger.logDocumentOperation(
        'user-123',
        AuditAction.DOCUMENT_UPLOAD,
        'doc-123',
        'success',
        { filename: 'test.pdf' }
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.DOCUMENT_UPLOAD,
          resource: 'document:doc-123',
          result: 'success',
        }),
      });
    });
  });

  describe('logRateLimitViolation', () => {
    it('should log rate limit violation', async () => {
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await auditLogger.logRateLimitViolation('user-123', '/api/v1/documents', '192.168.1.1');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.RATE_LIMIT_EXCEEDED,
          resource: 'endpoint:/api/v1/documents',
          result: 'failure',
        }),
      });
    });
  });

  describe('logContentPolicyViolation', () => {
    it('should log content policy violation without full content', async () => {
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const content = 'inappropriate content here';
      await auditLogger.logContentPolicyViolation('user-123', content, 'profanity detected');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.CONTENT_POLICY_VIOLATION,
          metadata: expect.objectContaining({
            reason: 'profanity detected',
            contentLength: content.length,
          }),
        }),
      });

      // Ensure full content is not logged
      const call = (mockPrisma.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(call.data.metadata).not.toHaveProperty('content');
    });
  });

  describe('logCrossUserAccessAttempt', () => {
    it('should log cross-user access attempt', async () => {
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await auditLogger.logCrossUserAccessAttempt(
        'user-123',
        'user-456',
        'document',
        'doc-789',
        '192.168.1.1'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.CROSS_USER_ACCESS_ATTEMPT,
          resource: 'document:doc-789',
          result: 'failure',
          metadata: expect.objectContaining({
            targetUserId: 'user-456',
            attemptedResource: 'doc-789',
          }),
        }),
      });
    });
  });

  describe('getUserAuditLogs', () => {
    it('should retrieve user audit logs with filters', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-123',
          action: AuditAction.DOCUMENT_UPLOAD,
          timestamp: new Date(),
        },
      ];

      (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const result = await auditLogger.getUserAuditLogs('user-123', {
        limit: 50,
        action: AuditAction.DOCUMENT_UPLOAD,
      });

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          action: AuditAction.DOCUMENT_UPLOAD,
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should apply date range filters', async () => {
      (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await auditLogger.getUserAuditLogs('user-123', {
        startDate,
        endDate,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });
  });
});
