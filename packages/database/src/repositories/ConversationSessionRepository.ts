import { PrismaClient, ConversationSession, Prisma } from '@prisma/client';

import { BaseRepository, PaginatedResult, PaginationOptions } from './BaseRepository';

/**
 * Conversation Session Repository
 * Handles all database operations for conversation sessions
 */
export class ConversationSessionRepository implements BaseRepository<ConversationSession> {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ConversationSession | null> {
    return this.prisma.conversationSession.findUnique({
      where: { id },
      include: {
        turns: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  }

  async findMany(where: Prisma.ConversationSessionWhereInput = {}): Promise<ConversationSession[]> {
    return this.prisma.conversationSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
    });
  }

  async findOne(where: Prisma.ConversationSessionWhereInput): Promise<ConversationSession | null> {
    return this.prisma.conversationSession.findFirst({
      where,
    });
  }

  async findByUserId(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ConversationSession> | ConversationSession[]> {
    if (options) {
      return this.findWithPagination({ userId }, options);
    }

    return this.prisma.conversationSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findWithPagination(
    where: Prisma.ConversationSessionWhereInput = {},
    options: PaginationOptions
  ): Promise<PaginatedResult<ConversationSession>> {
    const { page, pageSize, orderBy = { startedAt: 'desc' } } = options;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.conversationSession.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.conversationSession.count({ where }),
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

  async create(data: Prisma.ConversationSessionCreateInput): Promise<ConversationSession> {
    return this.prisma.conversationSession.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.ConversationSessionUpdateInput
  ): Promise<ConversationSession> {
    return this.prisma.conversationSession.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<ConversationSession> {
    // Hard delete for sessions (no soft delete needed)
    return this.prisma.conversationSession.delete({
      where: { id },
    });
  }

  async hardDelete(id: string): Promise<ConversationSession> {
    return this.delete(id);
  }

  async restore(_id: string): Promise<ConversationSession> {
    throw new Error('Restore not supported for ConversationSession');
  }

  async count(where: Prisma.ConversationSessionWhereInput = {}): Promise<number> {
    return this.prisma.conversationSession.count({ where });
  }

  async exists(where: Prisma.ConversationSessionWhereInput): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Update session state
   */
  async updateState(id: string, state: string): Promise<ConversationSession> {
    return this.prisma.conversationSession.update({
      where: { id },
      data: { state },
    });
  }

  /**
   * End a session
   */
  async endSession(id: string): Promise<ConversationSession> {
    const session = await this.findById(id);
    if (!session) {
      throw new Error('Session not found');
    }

    const durationSeconds = Math.floor((new Date().getTime() - session.startedAt.getTime()) / 1000);

    return this.prisma.conversationSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
        durationSeconds,
        state: 'completed',
      },
    });
  }

  /**
   * Update session metrics
   */
  async updateMetrics(
    id: string,
    metrics: {
      totalTurns?: number;
      averageLatencyMs?: number;
      totalCost?: number;
    }
  ): Promise<ConversationSession> {
    return this.prisma.conversationSession.update({
      where: { id },
      data: metrics,
    });
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<ConversationSession[]> {
    return this.prisma.conversationSession.findMany({
      where: {
        userId,
        endedAt: null,
        state: {
          in: ['listening', 'processing', 'speaking'],
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Get session statistics for a user
   */
  async getUserStatistics(userId: string): Promise<{
    totalSessions: number;
    totalDurationMinutes: number;
    totalTurns: number;
    averageLatencyMs: number;
    totalCost: number;
  }> {
    const sessions = await this.prisma.conversationSession.findMany({
      where: { userId },
    });

    const totalSessions = sessions.length;
    const totalDurationMinutes = sessions.reduce((sum, s) => sum + s.durationSeconds / 60, 0);
    const totalTurns = sessions.reduce((sum, s) => sum + s.totalTurns, 0);
    const averageLatencyMs =
      sessions.reduce((sum, s) => sum + s.averageLatencyMs, 0) / (totalSessions || 1);
    const totalCost = sessions.reduce((sum, s) => sum + s.totalCost, 0);

    return {
      totalSessions,
      totalDurationMinutes,
      totalTurns,
      averageLatencyMs,
      totalCost,
    };
  }
}
