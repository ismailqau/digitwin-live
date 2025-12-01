/**
 * Audit Service
 *
 * Handles audit logging for security and compliance.
 */

import { PrismaClient } from '@clone/database';

const prisma = new PrismaClient();

interface AuditLogData {
  userId: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        result: data.result,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: (data.metadata || {}) as Record<string, never>,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

export default {
  createAuditLog,
};
