/**
 * Context Manager
 * Manages conversation history and context window optimization
 */

import { PrismaClient } from '../temp-types';
import { logger } from '../temp-types';

import { ConversationTurn } from './PromptTemplateService';

export interface ContextConfig {
  maxTurns: number; // Maximum conversation turns to keep
  maxTokens: number; // Maximum tokens for context
  compressionThreshold: number; // When to start compressing old context
  retentionHours: number; // How long to keep conversation history
}

export interface ConversationContext {
  sessionId: string;
  userId: string;
  turns: ConversationTurn[];
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContextSummary {
  sessionId: string;
  summary: string;
  originalTurns: number;
  compressedAt: Date;
}

export class ContextManager {
  private db: PrismaClient;
  private config: ContextConfig;
  private activeContexts = new Map<string, ConversationContext>();

  constructor(db: PrismaClient, config: Partial<ContextConfig> = {}) {
    this.db = db;
    this.config = {
      maxTurns: config.maxTurns || 10,
      maxTokens: config.maxTokens || 4000,
      compressionThreshold: config.compressionThreshold || 20,
      retentionHours: config.retentionHours || 24,
    };

    logger.info('Context Manager initialized', { config: this.config });
  }

  /**
   * Add a new turn to the conversation context
   */
  async addTurn(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    sources?: string[]
  ): Promise<void> {
    let context = this.activeContexts.get(sessionId);

    if (!context) {
      context = await this.loadOrCreateContext(sessionId, userId);
    }

    const newTurn: ConversationTurn = {
      role,
      content,
      timestamp: new Date(),
      sources,
    };

    context.turns.push(newTurn);
    context.updatedAt = new Date();
    context.totalTokens = this.estimateContextTokens(context.turns);

    // Optimize context if needed
    if (
      context.turns.length > this.config.maxTurns ||
      context.totalTokens > this.config.maxTokens
    ) {
      await this.optimizeContext(context);
    }

    // Update in memory and database
    this.activeContexts.set(sessionId, context);
    await this.persistContext(context);

    logger.debug('Turn added to context', {
      sessionId,
      role,
      totalTurns: context.turns.length,
      totalTokens: context.totalTokens,
    });
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string, maxTurns?: number): Promise<ConversationTurn[]> {
    let context = this.activeContexts.get(sessionId);

    if (!context) {
      const loadedContext = await this.loadContext(sessionId);
      if (loadedContext) {
        context = loadedContext;
        this.activeContexts.set(sessionId, context);
      }
    }

    if (!context) {
      return [];
    }

    const turns = context.turns;
    const limit = maxTurns || this.config.maxTurns;

    // Return the most recent turns
    return turns.slice(-limit);
  }

  /**
   * Get formatted conversation history as string
   */
  async getFormattedHistory(
    sessionId: string,
    maxTurns?: number,
    includeTimestamps = false
  ): Promise<string> {
    const turns = await this.getConversationHistory(sessionId, maxTurns);

    if (turns.length === 0) {
      return 'No previous conversation.';
    }

    return turns
      .map((turn) => {
        const role = turn.role === 'user' ? 'User' : 'Assistant';
        const timestamp = includeTimestamps ? ` (${turn.timestamp.toLocaleTimeString()})` : '';
        const sources =
          turn.sources && turn.sources.length > 0 ? ` [Sources: ${turn.sources.join(', ')}]` : '';

        return `${role}${timestamp}: ${turn.content}${sources}`;
      })
      .join('\n\n');
  }

  /**
   * Clear conversation history for a session
   */
  async clearHistory(sessionId: string): Promise<void> {
    this.activeContexts.delete(sessionId);

    await this.db.conversationSession.update({
      where: { id: sessionId },
      data: {
        turns: {
          deleteMany: {},
        },
      },
    });

    logger.info('Conversation history cleared', { sessionId });
  }

  /**
   * Get context statistics
   */
  async getContextStats(sessionId: string): Promise<{
    totalTurns: number;
    totalTokens: number;
    oldestTurn: Date | null;
    newestTurn: Date | null;
  }> {
    const context = this.activeContexts.get(sessionId) || (await this.loadContext(sessionId));

    if (!context || context.turns.length === 0) {
      return {
        totalTurns: 0,
        totalTokens: 0,
        oldestTurn: null,
        newestTurn: null,
      };
    }

    return {
      totalTurns: context.turns.length,
      totalTokens: context.totalTokens,
      oldestTurn: context.turns[0]?.timestamp || null,
      newestTurn: context.turns[context.turns.length - 1]?.timestamp || null,
    };
  }

  /**
   * Compress old conversation history
   */
  async compressHistory(sessionId: string): Promise<void> {
    const context = this.activeContexts.get(sessionId) || (await this.loadContext(sessionId));

    if (!context || context.turns.length < this.config.compressionThreshold) {
      return;
    }

    // Keep recent turns, compress older ones
    const recentTurns = context.turns.slice(-this.config.maxTurns);
    const oldTurns = context.turns.slice(0, -this.config.maxTurns);

    if (oldTurns.length === 0) {
      return;
    }

    // Create summary of old turns
    const summary = this.createTurnsSummary(oldTurns);

    // Store summary
    await this.storeSummary(sessionId, summary, oldTurns.length);

    // Update context with only recent turns
    context.turns = recentTurns;
    context.totalTokens = this.estimateContextTokens(context.turns);
    context.updatedAt = new Date();

    this.activeContexts.set(sessionId, context);
    await this.persistContext(context);

    logger.info('Context compressed', {
      sessionId,
      compressedTurns: oldTurns.length,
      remainingTurns: recentTurns.length,
    });
  }

  /**
   * Clean up expired contexts
   */
  async cleanupExpiredContexts(): Promise<number> {
    const cutoffTime = new Date(Date.now() - this.config.retentionHours * 60 * 60 * 1000);

    try {
      const result = await this.db.conversationSession.deleteMany({
        where: {
          updatedAt: {
            lt: cutoffTime,
          },
        },
      });

      // Clean up in-memory contexts
      for (const [sessionId, context] of this.activeContexts.entries()) {
        if (context.updatedAt < cutoffTime) {
          this.activeContexts.delete(sessionId);
        }
      }

      logger.info('Expired contexts cleaned up', { deletedCount: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to clean up expired contexts', { error });
      return 0;
    }
  }

  private async loadOrCreateContext(
    sessionId: string,
    userId: string
  ): Promise<ConversationContext> {
    let context = await this.loadContext(sessionId);

    if (!context) {
      context = {
        sessionId,
        userId,
        turns: [],
        totalTokens: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return context;
  }

  private async loadContext(sessionId: string): Promise<ConversationContext | null> {
    try {
      const session = await this.db.conversationSession.findUnique({
        where: { id: sessionId },
        include: {
          turns: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      if (!session) {
        return null;
      }

      const turns: ConversationTurn[] = session.turns.map((turn: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const turnData = turn as any;
        return {
          role: turnData.userTranscript ? 'user' : 'assistant',
          content: turnData.userTranscript || turnData.llmResponse || '',
          timestamp: turnData.timestamp,
          sources: turnData.retrievedChunks || undefined,
        };
      });

      return {
        sessionId: session.id,
        userId: session.userId,
        turns,
        totalTokens: this.estimateContextTokens(turns),
        createdAt: session.startedAt,
        updatedAt: session.endedAt || new Date(),
      };
    } catch (error) {
      logger.error('Failed to load context', { sessionId, error });
      return null;
    }
  }

  private async persistContext(context: ConversationContext): Promise<void> {
    try {
      // This is a simplified persistence - in practice, you'd update the conversation turns
      // For now, we'll just update the session timestamp
      await this.db.conversationSession.upsert({
        where: { id: context.sessionId },
        update: {
          endedAt: context.updatedAt,
        },
        create: {
          id: context.sessionId,
          userId: context.userId,
          startedAt: context.createdAt,
          endedAt: context.updatedAt,
          state: 'active',
          llmProvider: 'gemini-flash', // Default
          ttsProvider: 'xtts-v2', // Default
          voiceModelId: '', // Will be set by caller
          totalTurns: context.turns.length,
          averageLatencyMs: 0, // Will be calculated
          totalCost: 0, // Will be calculated
        },
      });
    } catch (error) {
      logger.error('Failed to persist context', { sessionId: context.sessionId, error });
    }
  }

  private async optimizeContext(context: ConversationContext): Promise<void> {
    // If we have too many turns, remove the oldest ones (but keep pairs)
    if (context.turns.length > this.config.maxTurns) {
      const turnsToRemove = context.turns.length - this.config.maxTurns;
      // Remove in pairs to maintain conversation flow
      const pairsToRemove = Math.floor(turnsToRemove / 2) * 2;
      context.turns = context.turns.slice(pairsToRemove);
    }

    // If still too many tokens, compress content
    if (context.totalTokens > this.config.maxTokens) {
      await this.compressContextContent(context);
    }

    context.totalTokens = this.estimateContextTokens(context.turns);
  }

  private async compressContextContent(context: ConversationContext): Promise<void> {
    // Simple compression: truncate very long messages
    const maxMessageLength = 200; // characters

    context.turns = context.turns.map((turn) => {
      if (turn.content.length > maxMessageLength) {
        return {
          ...turn,
          content: turn.content.substring(0, maxMessageLength) + '...',
        };
      }
      return turn;
    });
  }

  private estimateContextTokens(turns: ConversationTurn[]): number {
    const totalChars = turns.reduce((sum, turn) => sum + turn.content.length, 0);
    return Math.ceil(totalChars / 4); // Rough estimation: 1 token ≈ 4 characters
  }

  private createTurnsSummary(turns: ConversationTurn[]): string {
    if (turns.length === 0) {
      return 'No conversation history.';
    }

    // Simple summarization - in practice, you might use an LLM for this
    const topics = new Set<string>();
    const keyPoints: string[] = [];

    turns.forEach((turn) => {
      if (turn.role === 'user') {
        // Extract potential topics from user queries
        const words = turn.content.toLowerCase().split(/\s+/);
        words.forEach((word) => {
          if (word.length > 4 && !['what', 'when', 'where', 'how', 'why'].includes(word)) {
            topics.add(word);
          }
        });
      } else {
        // Extract key points from assistant responses
        if (turn.content.length > 50) {
          keyPoints.push(turn.content.substring(0, 100) + '...');
        }
      }
    });

    const topicsArray = Array.from(topics).slice(0, 5);
    const summary =
      `Previous conversation covered: ${topicsArray.join(', ')}. ` +
      `Key points discussed: ${keyPoints.slice(0, 3).join(' | ')}`;

    return summary;
  }

  private async storeSummary(
    sessionId: string,
    summary: string,
    originalTurns: number
  ): Promise<void> {
    try {
      // Store summary in a separate table or as metadata
      // For now, we'll log it - in practice, you'd store this in the database
      logger.info('Context summary created', {
        sessionId,
        summary,
        originalTurns,
        compressedAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to store context summary', { sessionId, error });
    }
  }
}
