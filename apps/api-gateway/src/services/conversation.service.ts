import { PrismaClient } from '@clone/database';
import { APIError } from '@clone/errors';
import { logger } from '@clone/logger';

const prisma = new PrismaClient();

export interface ConversationTurnData {
  sessionId: string;
  userTranscript: string;
  transcriptConfidence: number;
  userAudioDurationMs: number;
  llmResponse: string;
  responseAudioDurationMs: number;
  retrievedChunks: string[]; // Array of chunk IDs used as sources
  asrLatencyMs: number;
  ragLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
  totalLatencyMs: number;
  asrCost: number;
  llmCost: number;
  ttsCost: number;
  totalCost: number;
}

export interface DocumentUsageStats {
  documentId: string;
  documentTitle: string;
  referenceCount: number;
  lastReferenced: Date;
}

export interface KnowledgeBaseAnalytics {
  totalQueries: number;
  queriesWithSources: number;
  knowledgeBaseUsageRate: number;
  mostReferencedDocuments: DocumentUsageStats[];
  faqHitRate: number;
  queriesWithNoSources: number;
  averageSourcesPerQuery: number;
}

/**
 * Service for managing conversation turns and source tracking
 */
export class ConversationService {
  /**
   * Store a conversation turn with source metadata
   */
  async storeTurn(turnData: ConversationTurnData): Promise<string> {
    try {
      logger.info('Storing conversation turn', {
        sessionId: turnData.sessionId,
        sourcesCount: turnData.retrievedChunks.length,
        totalLatencyMs: turnData.totalLatencyMs,
      });

      const turn = await prisma.conversationTurn.create({
        data: {
          sessionId: turnData.sessionId,
          userTranscript: turnData.userTranscript,
          transcriptConfidence: turnData.transcriptConfidence,
          userAudioDurationMs: turnData.userAudioDurationMs,
          llmResponse: turnData.llmResponse,
          responseAudioDurationMs: turnData.responseAudioDurationMs,
          retrievedChunks: turnData.retrievedChunks,
          asrLatencyMs: turnData.asrLatencyMs,
          ragLatencyMs: turnData.ragLatencyMs,
          llmLatencyMs: turnData.llmLatencyMs,
          ttsLatencyMs: turnData.ttsLatencyMs,
          totalLatencyMs: turnData.totalLatencyMs,
          asrCost: turnData.asrCost,
          llmCost: turnData.llmCost,
          ttsCost: turnData.ttsCost,
          totalCost: turnData.totalCost,
        },
      });

      // Update session statistics
      await this.updateSessionStats(turnData.sessionId);

      // Update document usage statistics (async)
      if (turnData.retrievedChunks.length > 0) {
        this.updateDocumentUsageStats(turnData.retrievedChunks).catch((error) => {
          logger.error('Failed to update document usage stats', { error });
        });
      }

      logger.info('Conversation turn stored successfully', {
        turnId: turn.id,
        sessionId: turnData.sessionId,
      });

      return turn.id;
    } catch (error) {
      logger.error('Failed to store conversation turn', { error, sessionId: turnData.sessionId });
      throw new APIError('Failed to store conversation turn', 500);
    }
  }

  /**
   * Update session statistics after adding a turn
   */
  private async updateSessionStats(sessionId: string): Promise<void> {
    try {
      // Get all turns for the session to calculate stats
      const turns = await prisma.conversationTurn.findMany({
        where: { sessionId },
        select: {
          totalLatencyMs: true,
          totalCost: true,
        },
      });

      const totalTurns = turns.length;
      const averageLatencyMs =
        totalTurns > 0 ? turns.reduce((sum, turn) => sum + turn.totalLatencyMs, 0) / totalTurns : 0;
      const totalCost = turns.reduce((sum, turn) => sum + turn.totalCost, 0);

      await prisma.conversationSession.update({
        where: { id: sessionId },
        data: {
          totalTurns,
          averageLatencyMs,
          totalCost,
        },
      });
    } catch (error) {
      logger.error('Failed to update session stats', { error, sessionId });
      // Don't throw - this is a background operation
    }
  }

  /**
   * Update document usage statistics for analytics
   */
  private async updateDocumentUsageStats(chunkIds: string[]): Promise<void> {
    try {
      // Get document IDs from chunk IDs
      const chunks = await prisma.documentChunk.findMany({
        where: {
          id: { in: chunkIds },
        },
        select: {
          documentId: true,
        },
      });

      const documentIds = [...new Set(chunks.map((chunk) => chunk.documentId))];

      // Update reference count for each document
      for (const documentId of documentIds) {
        await prisma.knowledgeDocument.update({
          where: { id: documentId },
          data: {
            // Use a JSON field to track usage stats
            // This is a simplified approach - in production, you might want a separate analytics table
            // For now, we'll just update the document's metadata
          },
        });
      }
    } catch (error) {
      logger.error('Failed to update document usage stats', { error, chunkIds });
      // Don't throw - this is a background operation
    }
  }

  /**
   * Get knowledge base analytics for a user
   */
  async getKnowledgeBaseAnalytics(
    userId: string,
    days: number = 30
  ): Promise<KnowledgeBaseAnalytics> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get conversation turns for the user within the date range
      const turns = await prisma.conversationTurn.findMany({
        where: {
          session: {
            userId: userId,
          },
          timestamp: {
            gte: startDate,
          },
        },
        include: {
          session: {
            select: {
              userId: true,
            },
          },
        },
      });

      const totalQueries = turns.length;
      const queriesWithSources = turns.filter((turn) => turn.retrievedChunks.length > 0).length;
      const knowledgeBaseUsageRate = totalQueries > 0 ? queriesWithSources / totalQueries : 0;
      const queriesWithNoSources = totalQueries - queriesWithSources;

      // Calculate total sources used
      const totalSources = turns.reduce((sum, turn) => sum + turn.retrievedChunks.length, 0);
      const averageSourcesPerQuery = queriesWithSources > 0 ? totalSources / queriesWithSources : 0;

      // Get most referenced documents
      const documentUsage: Record<string, { count: number; lastReferenced: Date }> = {};

      for (const turn of turns) {
        if (turn.retrievedChunks.length > 0) {
          // Get document IDs for this turn's chunks
          const chunks = await prisma.documentChunk.findMany({
            where: {
              id: { in: turn.retrievedChunks },
              userId: userId,
            },
            select: {
              documentId: true,
            },
          });

          for (const chunk of chunks) {
            if (!documentUsage[chunk.documentId]) {
              documentUsage[chunk.documentId] = { count: 0, lastReferenced: turn.timestamp };
            }
            documentUsage[chunk.documentId].count++;
            if (turn.timestamp > documentUsage[chunk.documentId].lastReferenced) {
              documentUsage[chunk.documentId].lastReferenced = turn.timestamp;
            }
          }
        }
      }

      // Get document titles for the most referenced documents
      const topDocumentIds = Object.entries(documentUsage)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([docId]) => docId);

      const documents = await prisma.knowledgeDocument.findMany({
        where: {
          id: { in: topDocumentIds },
          userId: userId,
        },
        select: {
          id: true,
          title: true,
          filename: true,
        },
      });

      const mostReferencedDocuments: DocumentUsageStats[] = documents.map((doc) => ({
        documentId: doc.id,
        documentTitle: doc.title || doc.filename,
        referenceCount: documentUsage[doc.id].count,
        lastReferenced: documentUsage[doc.id].lastReferenced,
      }));

      // TODO: Calculate FAQ hit rate when FAQ search is implemented
      const faqHitRate = 0;

      return {
        totalQueries,
        queriesWithSources,
        knowledgeBaseUsageRate,
        mostReferencedDocuments,
        faqHitRate,
        queriesWithNoSources,
        averageSourcesPerQuery,
      };
    } catch (error) {
      logger.error('Failed to get knowledge base analytics', { error, userId });
      throw new APIError('Failed to get knowledge base analytics', 500);
    }
  }

  /**
   * Get conversation sessions for a user with source usage indicators
   */
  async getUserConversations(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    sessions: Array<{
      id: string;
      startedAt: Date;
      endedAt: Date | null;
      durationSeconds: number;
      totalTurns: number;
      turnsWithSources: number;
      knowledgeBaseUsageRate: number;
      averageLatencyMs: number;
      totalCost: number;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const offset = (page - 1) * limit;

      // Get sessions with turn counts
      const [sessions, total] = await Promise.all([
        prisma.conversationSession.findMany({
          where: {
            userId: userId,
          },
          include: {
            turns: {
              select: {
                retrievedChunks: true,
              },
            },
          },
          orderBy: {
            startedAt: 'desc',
          },
          skip: offset,
          take: limit,
        }),
        prisma.conversationSession.count({
          where: {
            userId: userId,
          },
        }),
      ]);

      const sessionsWithStats = sessions.map((session) => {
        const turnsWithSources = session.turns.filter(
          (turn) => turn.retrievedChunks.length > 0
        ).length;
        const knowledgeBaseUsageRate =
          session.totalTurns > 0 ? turnsWithSources / session.totalTurns : 0;

        return {
          id: session.id,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationSeconds: session.durationSeconds,
          totalTurns: session.totalTurns,
          turnsWithSources,
          knowledgeBaseUsageRate,
          averageLatencyMs: session.averageLatencyMs,
          totalCost: session.totalCost,
        };
      });

      return {
        sessions: sessionsWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get user conversations', { error, userId });
      throw new APIError('Failed to get user conversations', 500);
    }
  }
}
