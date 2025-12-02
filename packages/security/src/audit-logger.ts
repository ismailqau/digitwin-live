/**
 * Audit Logger for tracking sensitive operations
 */

import { logger as defaultLogger } from '@clone/logger';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'winston';

import { AuditLogEntry, AuditAction } from './types';

export class AuditLogger {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma: PrismaClient, logger?: Logger) {
    this.prisma = prisma;
    this.logger = logger || defaultLogger;
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          result: entry.result,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          metadata: entry.metadata || {},
        },
      });

      this.logger.info('Audit log created', {
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        result: entry.result,
      });
    } catch (error) {
      this.logger.error('Failed to create audit log', {
        error,
        entry,
      });
      // Don't throw - audit logging should not break the application
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(
    userId: string,
    action: AuditAction,
    result: 'success' | 'failure',
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'authentication',
      result,
      ipAddress,
      userAgent,
      metadata,
    });
  }

  /**
   * Log document operation
   */
  async logDocumentOperation(
    userId: string,
    action: AuditAction,
    documentId: string,
    result: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: `document:${documentId}`,
      result,
      metadata,
    });
  }

  /**
   * Log voice model operation
   */
  async logVoiceModelOperation(
    userId: string,
    action: AuditAction,
    voiceModelId: string,
    result: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: `voice_model:${voiceModelId}`,
      result,
      metadata,
    });
  }

  /**
   * Log face model operation
   */
  async logFaceModelOperation(
    userId: string,
    action: AuditAction,
    faceModelId: string,
    result: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: `face_model:${faceModelId}`,
      result,
      metadata,
    });
  }

  /**
   * Log rate limit violation
   */
  async logRateLimitViolation(
    userId: string,
    endpoint: string,
    ipAddress?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.RATE_LIMIT_EXCEEDED,
      resource: `endpoint:${endpoint}`,
      result: 'failure',
      ipAddress,
      metadata,
    });
  }

  /**
   * Log content policy violation
   */
  async logContentPolicyViolation(
    userId: string,
    content: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.CONTENT_POLICY_VIOLATION,
      resource: 'content',
      result: 'failure',
      metadata: {
        ...metadata,
        reason,
        contentLength: content.length,
        // Don't log full content for privacy
      },
    });
  }

  /**
   * Log unauthorized access attempt
   */
  async logUnauthorizedAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    ipAddress?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.UNAUTHORIZED_ACCESS,
      resource: `${resourceType}:${resourceId}`,
      result: 'failure',
      ipAddress,
      metadata,
    });
  }

  /**
   * Log cross-user access attempt
   */
  async logCrossUserAccessAttempt(
    userId: string,
    targetUserId: string,
    resourceType: string,
    resourceId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.CROSS_USER_ACCESS_ATTEMPT,
      resource: `${resourceType}:${resourceId}`,
      result: 'failure',
      ipAddress,
      metadata: {
        targetUserId,
        attemptedResource: resourceId,
      },
    });
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: any = { userId };

    if (options?.action) {
      where.action = options.action;
    }

    if (options?.startDate || options?.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = options.startDate;
      }
      if (options.endDate) {
        where.timestamp.lte = options.endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }
}
