import { PrismaClient } from '@clone/database';
import { APIError } from '@clone/errors';
import { logger } from '@clone/logger';

const prisma = new PrismaClient();

export interface DocumentAnalytics {
  documentId: string;
  documentTitle: string;
  filename: string;
  referenceCount: number;
  lastReferenced: Date | null;
  averageRelevanceScore: number;
  uniqueQueries: number;
}

export interface QueryAnalytics {
  query: string;
  count: number;
  averageRelevanceScore: number;
  hasLowConfidence: boolean;
  lastUsed: Date;
}

export interface KnowledgeBaseUsageStats {
  totalQueries: number;
  queriesWithSources: number;
  knowledgeBaseUsageRate: number;
  faqHitRate: number;
  queriesWithNoSources: number;
  averageSourcesPerQuery: number;
  mostReferencedDocuments: DocumentAnalytics[];
  popularQueries: QueryAnalytics[];
  lowConfidenceQueries: QueryAnalytics[];
}

/**
 * Service for tracking and analyzing knowledge base usage
 */
export class AnalyticsService {
  /**
   * Track a query and its results for analytics
   */
  async trackQuery(
    query: string,
    userId: string,
    resultsCount: number,
    avgRelevanceScore: number,
    hasLowConfidence: boolean
  ): Promise<void> {
    try {
      await prisma.queryAnalytics.create({
        data: {
          query,
          userId,
          resultsCount,
          avgRelevanceScore,
          hasLowConfidence,
        },
      });

      logger.debug('Query tracked for analytics', {
        userId,
        query: query.substring(0, 50),
        resultsCount,
        avgRelevanceScore,
        hasLowConfidence,
      });
    } catch (error) {
      logger.error('Failed to track query analytics', { error, userId });
      // Don't throw - analytics tracking should not break the main flow
    }
  }

  /**
   * Update document reference statistics
   */
  async updateDocumentStats(documentIds: string[], relevanceScores: number[]): Promise<void> {
    try {
      for (let i = 0; i < documentIds.length; i++) {
        const documentId = documentIds[i];
        const relevanceScore = relevanceScores[i] || 0;

        // Update document metadata with usage statistics
        // This is a simplified approach - in production, you might want a separate analytics table
        const document = await prisma.knowledgeDocument.findUnique({
          where: { id: documentId },
          select: { metadata: true },
        });

        if (document) {
          const metadata = (document.metadata as Record<string, unknown>) || {};
          const analytics = (metadata.analytics as Record<string, unknown>) || {};

          const referenceCount =
            typeof analytics.referenceCount === 'number' ? analytics.referenceCount : 0;
          const totalRelevanceScore =
            typeof analytics.totalRelevanceScore === 'number' ? analytics.totalRelevanceScore : 0;

          const newReferenceCount = referenceCount + 1;
          const newTotalRelevanceScore = totalRelevanceScore + relevanceScore;

          analytics.referenceCount = newReferenceCount;
          analytics.totalRelevanceScore = newTotalRelevanceScore;
          analytics.lastReferenced = new Date();
          analytics.averageRelevanceScore = newTotalRelevanceScore / newReferenceCount;

          await prisma.knowledgeDocument.update({
            where: { id: documentId },
            data: {
              metadata: {
                ...metadata,
                analytics,
              } as unknown as Record<string, never>,
            },
          });
        }
      }

      logger.debug('Document statistics updated', {
        documentsCount: documentIds.length,
      });
    } catch (error) {
      logger.error('Failed to update document statistics', { error, documentIds });
      // Don't throw - analytics tracking should not break the main flow
    }
  }

  /**
   * Get comprehensive knowledge base usage statistics for a user
   */
  async getKnowledgeBaseStats(userId: string, days: number = 30): Promise<KnowledgeBaseUsageStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get query analytics
      const queryAnalytics = await prisma.queryAnalytics.findMany({
        where: {
          userId,
          timestamp: {
            gte: startDate,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      const totalQueries = queryAnalytics.length;
      const queriesWithSources = queryAnalytics.filter((q) => q.resultsCount > 0).length;
      const knowledgeBaseUsageRate = totalQueries > 0 ? queriesWithSources / totalQueries : 0;
      const queriesWithNoSources = totalQueries - queriesWithSources;

      // Calculate average sources per query
      const totalSources = queryAnalytics.reduce((sum, q) => sum + q.resultsCount, 0);
      const averageSourcesPerQuery = queriesWithSources > 0 ? totalSources / queriesWithSources : 0;

      // Get most referenced documents
      const documents = await prisma.knowledgeDocument.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          filename: true,
          metadata: true,
        },
      });

      const mostReferencedDocuments: DocumentAnalytics[] = documents
        .map((doc) => {
          const analytics =
            ((doc.metadata as Record<string, unknown>)?.analytics as Record<string, unknown>) || {};
          const referenceCount =
            typeof analytics.referenceCount === 'number' ? analytics.referenceCount : 0;
          const averageRelevanceScore =
            typeof analytics.averageRelevanceScore === 'number'
              ? analytics.averageRelevanceScore
              : 0;
          const uniqueQueries =
            typeof analytics.uniqueQueries === 'number' ? analytics.uniqueQueries : 0;

          let lastReferenced: Date | null = null;
          if (analytics.lastReferenced) {
            if (analytics.lastReferenced instanceof Date) {
              lastReferenced = analytics.lastReferenced;
            } else if (
              typeof analytics.lastReferenced === 'string' ||
              typeof analytics.lastReferenced === 'number'
            ) {
              lastReferenced = new Date(analytics.lastReferenced);
            }
          }

          return {
            documentId: doc.id,
            documentTitle: doc.title || doc.filename,
            filename: doc.filename,
            referenceCount,
            lastReferenced,
            averageRelevanceScore,
            uniqueQueries,
          };
        })
        .filter((doc) => doc.referenceCount > 0)
        .sort((a, b) => b.referenceCount - a.referenceCount)
        .slice(0, 10);

      // Get popular queries
      const queryGroups = new Map<string, QueryAnalytics>();
      for (const query of queryAnalytics) {
        const key = query.query.toLowerCase().trim();
        if (queryGroups.has(key)) {
          const existing = queryGroups.get(key)!;
          existing.count++;
          existing.averageRelevanceScore =
            (existing.averageRelevanceScore * (existing.count - 1) + query.avgRelevanceScore) /
            existing.count;
          if (query.timestamp > existing.lastUsed) {
            existing.lastUsed = query.timestamp;
          }
        } else {
          queryGroups.set(key, {
            query: query.query,
            count: 1,
            averageRelevanceScore: query.avgRelevanceScore,
            hasLowConfidence: query.hasLowConfidence,
            lastUsed: query.timestamp,
          });
        }
      }

      const popularQueries = Array.from(queryGroups.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get low confidence queries
      const lowConfidenceQueries = Array.from(queryGroups.values())
        .filter((q) => q.hasLowConfidence || q.averageRelevanceScore < 0.5)
        .sort((a, b) => a.averageRelevanceScore - b.averageRelevanceScore)
        .slice(0, 10);

      // TODO: Calculate FAQ hit rate when FAQ search is implemented
      const faqHitRate = 0;

      return {
        totalQueries,
        queriesWithSources,
        knowledgeBaseUsageRate,
        faqHitRate,
        queriesWithNoSources,
        averageSourcesPerQuery,
        mostReferencedDocuments,
        popularQueries,
        lowConfidenceQueries,
      };
    } catch (error) {
      logger.error('Failed to get knowledge base statistics', { error, userId });
      throw new APIError('Failed to get knowledge base statistics', 500);
    }
  }

  /**
   * Get document usage trends over time
   */
  async getDocumentUsageTrends(
    userId: string,
    documentId?: string,
    days: number = 30
  ): Promise<Array<{ date: string; referenceCount: number; averageRelevanceScore: number }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // This is a simplified implementation
      // In production, you might want to store daily aggregates for better performance
      const conversations = await prisma.conversationTurn.findMany({
        where: {
          session: {
            userId,
          },
          timestamp: {
            gte: startDate,
          },
          NOT: {
            retrievedChunks: {
              equals: [],
            },
          },
        },
        include: {
          session: {
            select: {
              userId: true,
            },
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      // Group by date and calculate statistics
      const dailyStats = new Map<string, { count: number; totalScore: number }>();

      for (const turn of conversations) {
        const date = turn.timestamp.toISOString().split('T')[0];

        if (!dailyStats.has(date)) {
          dailyStats.set(date, { count: 0, totalScore: 0 });
        }

        const stats = dailyStats.get(date)!;
        stats.count += turn.retrievedChunks.length;
        // TODO: Store actual relevance scores in conversation turns
        stats.totalScore += turn.retrievedChunks.length * 0.8; // Placeholder
      }

      return Array.from(dailyStats.entries()).map(([date, stats]) => ({
        date,
        referenceCount: stats.count,
        averageRelevanceScore: stats.count > 0 ? stats.totalScore / stats.count : 0,
      }));
    } catch (error) {
      logger.error('Failed to get document usage trends', { error, userId, documentId });
      throw new APIError('Failed to get document usage trends', 500);
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldAnalytics(retentionDays: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.queryAnalytics.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Old analytics data cleaned up', {
        deletedRecords: result.count,
        cutoffDate,
      });
    } catch (error) {
      logger.error('Failed to cleanup old analytics data', { error });
      throw new APIError('Failed to cleanup old analytics data', 500);
    }
  }
}
