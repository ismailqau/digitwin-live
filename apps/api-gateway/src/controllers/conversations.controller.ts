import { PrismaClient } from '@clone/database';
import { BaseError } from '@clone/errors';
import { logger } from '@clone/logger';
import { Response } from 'express';

import { AuthRequest } from '../middleware/auth.middleware';
import { AnalyticsService } from '../services/analytics.service';

const prisma = new PrismaClient();
const analyticsService = new AnalyticsService();

export interface ConversationSourceInfo {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  relevanceScore: number;
  sourceType: 'document' | 'faq' | 'conversation';
  contentSnippet: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     ConversationSourceInfo:
 *       type: object
 *       properties:
 *         documentId:
 *           type: string
 *           description: ID of the source document
 *         documentTitle:
 *           type: string
 *           description: Title of the source document
 *         chunkIndex:
 *           type: integer
 *           description: Index of the chunk within the document
 *         relevanceScore:
 *           type: number
 *           format: float
 *           description: Relevance score (0-1)
 *         sourceType:
 *           type: string
 *           enum: [document, faq, conversation]
 *           description: Type of knowledge source
 *         contentSnippet:
 *           type: string
 *           description: Preview of the content (first 200 characters)
 */

/**
 * @swagger
 * /api/v1/conversations/{sessionId}/turns/{turnId}/sources:
 *   get:
 *     summary: Get source information for a conversation turn
 *     description: Retrieves detailed information about knowledge sources used in a specific conversation turn
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation session ID
 *       - in: path
 *         name: turnId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation turn ID
 *     responses:
 *       200:
 *         description: Source information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     turnId:
 *                       type: string
 *                     sessionId:
 *                       type: string
 *                     sources:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ConversationSourceInfo'
 *                     sourceCount:
 *                       type: integer
 *                     hasKnowledgeBase:
 *                       type: boolean
 *       404:
 *         description: Conversation turn not found
 *       403:
 *         description: Access denied - not your conversation
 *       500:
 *         description: Internal server error
 */
export const getTurnSources = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, turnId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    logger.info('Getting turn sources', {
      userId,
      sessionId,
      turnId,
    });

    // First, verify the session belongs to the user
    const session = await prisma.conversationSession.findFirst({
      where: {
        id: sessionId,
        userId: userId,
      },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Conversation session not found',
      });
      return;
    }

    // Get the conversation turn with retrieved chunks
    const turn = await prisma.conversationTurn.findFirst({
      where: {
        id: turnId,
        sessionId: sessionId,
      },
    });

    if (!turn) {
      res.status(404).json({
        success: false,
        error: 'Conversation turn not found',
      });
      return;
    }

    // Parse the retrieved chunks (stored as JSON string array)
    const retrievedChunkIds = turn.retrievedChunks || [];
    const sources: ConversationSourceInfo[] = [];

    if (retrievedChunkIds.length > 0) {
      // Get document chunks with their document information
      const chunks = await prisma.documentChunk.findMany({
        where: {
          id: {
            in: retrievedChunkIds,
          },
          userId: userId, // Ensure user can only see their own data
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              filename: true,
            },
          },
        },
      });

      // Convert chunks to source info
      for (const chunk of chunks) {
        sources.push({
          documentId: chunk.document.id,
          documentTitle: chunk.document.title || chunk.document.filename,
          chunkIndex: chunk.chunkIndex,
          relevanceScore: 0.8, // TODO: Store actual relevance score in retrievedChunks
          sourceType: 'document', // TODO: Support FAQ and conversation sources
          contentSnippet:
            chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
        });
      }

      // TODO: Handle FAQ sources when implemented
      // TODO: Handle conversation history sources when implemented
    }

    const response = {
      success: true,
      data: {
        turnId: turn.id,
        sessionId: turn.sessionId,
        sources,
        sourceCount: sources.length,
        hasKnowledgeBase: sources.length > 0,
      },
    };

    logger.info('Turn sources retrieved successfully', {
      userId,
      sessionId,
      turnId,
      sourceCount: sources.length,
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get turn sources', {
      error,
      sessionId: req.params.sessionId,
      turnId: req.params.turnId,
      userId: req.user?.id,
    });

    if (error instanceof BaseError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
};

/**
 * @swagger
 * /api/v1/conversations/{sessionId}:
 *   get:
 *     summary: Get conversation session details
 *     description: Retrieves conversation session with turns and source usage statistics
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation session ID
 *     responses:
 *       200:
 *         description: Conversation session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     session:
 *                       type: object
 *                     turns:
 *                       type: array
 *                     sourceUsageStats:
 *                       type: object
 *       404:
 *         description: Conversation session not found
 *       500:
 *         description: Internal server error
 */
export const getConversationSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    logger.info('Getting conversation session', {
      userId,
      sessionId,
    });

    // Get session with turns
    const session = await prisma.conversationSession.findFirst({
      where: {
        id: sessionId,
        userId: userId,
      },
      include: {
        turns: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Conversation session not found',
      });
      return;
    }

    // Calculate source usage statistics
    let turnsWithSources = 0;
    let totalSources = 0;
    const documentUsage: Record<string, number> = {};

    for (const turn of session.turns) {
      const retrievedChunks = turn.retrievedChunks || [];
      if (retrievedChunks.length > 0) {
        turnsWithSources++;
        totalSources += retrievedChunks.length;

        // Count document usage (simplified - would need to query chunks for actual document IDs)
        for (const chunkId of retrievedChunks) {
          documentUsage[chunkId] = (documentUsage[chunkId] || 0) + 1;
        }
      }
    }

    const sourceUsageStats = {
      totalTurns: session.turns.length,
      turnsWithSources,
      knowledgeBaseUsageRate:
        session.turns.length > 0 ? turnsWithSources / session.turns.length : 0,
      totalSourcesReferenced: totalSources,
      averageSourcesPerTurn: turnsWithSources > 0 ? totalSources / turnsWithSources : 0,
      mostReferencedSources: Object.entries(documentUsage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([chunkId, count]) => ({ chunkId, referenceCount: count })),
    };

    const response = {
      success: true,
      data: {
        session: {
          id: session.id,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationSeconds: session.durationSeconds,
          state: session.state,
          totalTurns: session.totalTurns,
          averageLatencyMs: session.averageLatencyMs,
          totalCost: session.totalCost,
        },
        turns: session.turns.map((turn) => ({
          id: turn.id,
          timestamp: turn.timestamp,
          userTranscript: turn.userTranscript,
          llmResponse: turn.llmResponse,
          hasKnowledgeBase: (turn.retrievedChunks || []).length > 0,
          sourceCount: (turn.retrievedChunks || []).length,
          totalLatencyMs: turn.totalLatencyMs,
        })),
        sourceUsageStats,
      },
    };

    logger.info('Conversation session retrieved successfully', {
      userId,
      sessionId,
      turnsCount: session.turns.length,
      turnsWithSources,
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get conversation session', {
      error,
      sessionId: req.params.sessionId,
      userId: req.user?.id,
    });

    if (error instanceof BaseError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
};
/**
 * 
@swagger
 * /api/v1/conversations/analytics:
 *   get:
 *     summary: Get knowledge base usage analytics
 *     description: Retrieves comprehensive analytics about knowledge base usage in conversations
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to analyze (default 30)
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalQueries:
 *                       type: integer
 *                     queriesWithSources:
 *                       type: integer
 *                     knowledgeBaseUsageRate:
 *                       type: number
 *                     mostReferencedDocuments:
 *                       type: array
 *                     popularQueries:
 *                       type: array
 *                     lowConfidenceQueries:
 *                       type: array
 *       500:
 *         description: Internal server error
 */
export const getKnowledgeBaseAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    logger.info('Getting knowledge base analytics', {
      userId,
      days,
    });

    const analytics = await analyticsService.getKnowledgeBaseStats(userId, days);

    const response = {
      success: true,
      data: analytics,
    };

    logger.info('Knowledge base analytics retrieved successfully', {
      userId,
      days,
      totalQueries: analytics.totalQueries,
      usageRate: analytics.knowledgeBaseUsageRate,
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get knowledge base analytics', {
      error,
      userId: req.user?.id,
    });

    if (error instanceof BaseError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
};
