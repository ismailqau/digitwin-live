import { PrismaClient, AuditLog } from '@prisma/client';

import { PaginatedResult, PaginationOptions } from './BaseRepository';

/**
 * Audit Log Repository
 * Handles all audit logging operations
 */
export class AuditLogRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create an audit log entry
   */
  async log(data: {
    userId: string;
    action: string;
    resource: string;
    result: 'success' | 'failure';
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        result: data.result,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Find audit logs by user ID
   */
  async findByUserId(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<AuditLog> | AuditLog[]> {
    if (options) {
      return this.findWithPagination({ userId }, options);
    }

    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Find audit logs by action
   */
  async findByAction(action: string, options?: PaginationOptions): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { action },
      orderBy: { timestamp: 'desc' },
      take: options?.pageSize,
    });
  }

  /**
   * Find audit logs within a time range
   */
  async findByTimeRange(
    startDate: Date,
    endDate: Date,
    options?: PaginationOptions
  ): Promise<PaginatedResult<AuditLog> | AuditLog[]> {
    const where = {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (options) {
      return this.findWithPagination(where, options);
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Find failed actions
   */
  async findFailures(
    userId?: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<AuditLog> | AuditLog[]> {
    const where: any = {
      result: 'failure',
    };

    if (userId) {
      where.userId = userId;
    }

    if (options) {
      return this.findWithPagination(where, options);
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Find with pagination
   */
  async findWithPagination(
    where: any = {},
    options: PaginationOptions
  ): Promise<PaginatedResult<AuditLog>> {
    const { page, pageSize, orderBy = { timestamp: 'desc' } } = options;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Get audit statistics for a user
   */
  async getUserStatistics(
    userId: string,
    daysBack = 30
  ): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    actionsByType: Record<string, number>;
    recentFailures: AuditLog[];
  }> {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId,
        timestamp: {
          gte: cutoffDate,
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    const totalActions = logs.length;
    const successfulActions = logs.filter((l) => l.result === 'success').length;
    const failedActions = logs.filter((l) => l.result === 'failure').length;

    const actionsByType = logs.reduce(
      (acc, l) => {
        acc[l.action] = (acc[l.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const recentFailures = logs.filter((l) => l.result === 'failure').slice(0, 10);

    return {
      totalActions,
      successfulActions,
      failedActions,
      actionsByType,
      recentFailures,
    };
  }

  /**
   * Get system-wide audit statistics
   */
  async getSystemStatistics(daysBack = 7): Promise<{
    totalActions: number;
    successRate: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: cutoffDate,
        },
      },
    });

    const totalActions = logs.length;
    const successfulActions = logs.filter((l) => l.result === 'success').length;
    const successRate = totalActions > 0 ? successfulActions / totalActions : 0;

    // Count by action
    const actionCounts = logs.reduce(
      (acc, l) => {
        acc[l.action] = (acc[l.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count by user
    const userCounts = logs.reduce(
      (acc, l) => {
        acc[l.userId] = (acc[l.userId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalActions,
      successRate,
      topActions,
      topUsers,
    };
  }

  /**
   * Clean old audit logs
   */
  async cleanOldLogs(olderThanDays = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
