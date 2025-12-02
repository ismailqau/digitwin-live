/**
 * Data Retention Service for managing data lifecycle and cleanup
 */

import { logger as defaultLogger } from '@clone/logger';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'winston';

import { DataRetentionPolicy } from './types';

export class DataRetentionService {
  private prisma: PrismaClient;
  private logger: Logger;
  private policy: DataRetentionPolicy;

  constructor(prisma: PrismaClient, logger?: Logger, policy?: Partial<DataRetentionPolicy>) {
    this.prisma = prisma;
    this.logger = logger || defaultLogger;
    this.policy = {
      conversationHistoryDays: policy?.conversationHistoryDays || 30,
      auditLogDays: policy?.auditLogDays || 90,
      cacheTTL: {
        short: policy?.cacheTTL?.short || 300, // 5 minutes
        medium: policy?.cacheTTL?.medium || 3600, // 1 hour
        long: policy?.cacheTTL?.long || 86400, // 24 hours
      },
    };
  }

  /**
   * Get retention policy
   */
  getPolicy(): DataRetentionPolicy {
    return this.policy;
  }

  /**
   * Update retention policy
   */
  updatePolicy(policy: Partial<DataRetentionPolicy>): void {
    this.policy = {
      ...this.policy,
      ...policy,
      cacheTTL: {
        ...this.policy.cacheTTL,
        ...policy.cacheTTL,
      },
    };
    this.logger.info('Data retention policy updated', { policy: this.policy });
  }

  /**
   * Clean up expired conversation history
   */
  async cleanupConversationHistory(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.policy.conversationHistoryDays);

    this.logger.info('Cleaning up conversation history', {
      cutoffDate,
      retentionDays: this.policy.conversationHistoryDays,
    });

    // Delete conversation turns first (cascade will handle this, but explicit is better)
    const turnsDeleted = await this.prisma.conversationTurn.deleteMany({
      where: {
        session: {
          endedAt: {
            lt: cutoffDate,
          },
        },
      },
    });

    // Delete conversation sessions
    const sessionsDeleted = await this.prisma.conversationSession.deleteMany({
      where: {
        endedAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.info('Conversation history cleanup complete', {
      sessionsDeleted: sessionsDeleted.count,
      turnsDeleted: turnsDeleted.count,
    });

    return sessionsDeleted.count;
  }

  /**
   * Clean up expired audit logs
   */
  async cleanupAuditLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.policy.auditLogDays);

    this.logger.info('Cleaning up audit logs', {
      cutoffDate,
      retentionDays: this.policy.auditLogDays,
    });

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.info('Audit log cleanup complete', {
      logsDeleted: result.count,
    });

    return result.count;
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<{
    embeddings: number;
    vectorSearches: number;
    llmResponses: number;
    audioChunks: number;
  }> {
    const now = new Date();

    this.logger.info('Cleaning up expired cache entries', { timestamp: now });

    const [embeddings, vectorSearches, llmResponses, audioChunks] = await Promise.all([
      this.prisma.embeddingCache.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.vectorSearchCache.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.lLMResponseCache.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.audioChunkCache.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);

    const result = {
      embeddings: embeddings.count,
      vectorSearches: vectorSearches.count,
      llmResponses: llmResponses.count,
      audioChunks: audioChunks.count,
    };

    this.logger.info('Cache cleanup complete', result);

    return result;
  }

  /**
   * Clean up soft-deleted resources
   * Permanently delete resources that have been soft-deleted for more than 30 days
   */
  async cleanupSoftDeletedResources(): Promise<{
    documents: number;
    voiceModels: number;
    voiceSamples: number;
    faceModels: number;
    faqs: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days grace period

    this.logger.info('Cleaning up soft-deleted resources', { cutoffDate });

    const [documents, voiceModels, voiceSamples, faceModels, faqs] = await Promise.all([
      this.prisma.knowledgeDocument.deleteMany({
        where: {
          deletedAt: {
            lt: cutoffDate,
          },
        },
      }),
      this.prisma.voiceModel.deleteMany({
        where: {
          deletedAt: {
            lt: cutoffDate,
          },
        },
      }),
      this.prisma.voiceSample.deleteMany({
        where: {
          deletedAt: {
            lt: cutoffDate,
          },
        },
      }),
      this.prisma.faceModel.deleteMany({
        where: {
          deletedAt: {
            lt: cutoffDate,
          },
        },
      }),
      this.prisma.fAQ.deleteMany({
        where: {
          deletedAt: {
            lt: cutoffDate,
          },
        },
      }),
    ]);

    const result = {
      documents: documents.count,
      voiceModels: voiceModels.count,
      voiceSamples: voiceSamples.count,
      faceModels: faceModels.count,
      faqs: faqs.count,
    };

    this.logger.info('Soft-deleted resources cleanup complete', result);

    return result;
  }

  /**
   * Clean up old rate limit records
   * Remove rate limit records older than 24 hours
   */
  async cleanupRateLimits(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    this.logger.info('Cleaning up old rate limit records', { cutoffDate });

    const result = await this.prisma.rateLimit.deleteMany({
      where: {
        windowStart: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.info('Rate limit cleanup complete', {
      recordsDeleted: result.count,
    });

    return result.count;
  }

  /**
   * Run all cleanup jobs
   */
  async runAllCleanupJobs(): Promise<{
    conversationSessions: number;
    auditLogs: number;
    cache: {
      embeddings: number;
      vectorSearches: number;
      llmResponses: number;
      audioChunks: number;
    };
    softDeleted: {
      documents: number;
      voiceModels: number;
      voiceSamples: number;
      faceModels: number;
      faqs: number;
    };
    rateLimits: number;
  }> {
    this.logger.info('Running all cleanup jobs');

    const [conversationSessions, auditLogs, cache, softDeleted, rateLimits] = await Promise.all([
      this.cleanupConversationHistory(),
      this.cleanupAuditLogs(),
      this.cleanupExpiredCache(),
      this.cleanupSoftDeletedResources(),
      this.cleanupRateLimits(),
    ]);

    const result = {
      conversationSessions,
      auditLogs,
      cache,
      softDeleted,
      rateLimits,
    };

    this.logger.info('All cleanup jobs complete', result);

    return result;
  }

  /**
   * Get user-specific retention settings
   * Users can configure their own retention periods
   */
  async getUserRetentionSettings(userId: string): Promise<{
    conversationHistoryDays: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const settings = user?.settings as any;
    return {
      conversationHistoryDays:
        settings?.dataRetention?.conversationHistoryDays || this.policy.conversationHistoryDays,
    };
  }

  /**
   * Update user-specific retention settings
   */
  async updateUserRetentionSettings(
    userId: string,
    settings: { conversationHistoryDays: number }
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const currentSettings = (user?.settings as any) || {};

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        settings: {
          ...currentSettings,
          dataRetention: {
            ...currentSettings.dataRetention,
            conversationHistoryDays: settings.conversationHistoryDays,
          },
        },
      },
    });

    this.logger.info('User retention settings updated', {
      userId,
      settings,
    });
  }
}
