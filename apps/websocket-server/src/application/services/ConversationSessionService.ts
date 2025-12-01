import { DatabaseConnection } from '@clone/database';
import { ConversationState, ConversationTurn } from '@clone/shared-types';
import { injectable } from 'tsyringe';

export interface ConversationSessionStats {
  totalSessions: number;
  avgDuration: number;
  avgCost: number;
  totalTurns: number;
}

/**
 * Service for managing ConversationSession database records
 * This is separate from WebSocket Session management
 */
@injectable()
export class ConversationSessionService {
  private get prisma() {
    return DatabaseConnection.getInstance();
  }

  constructor() {
    // Prisma client is accessed via getter
  }

  /**
   * Create a new conversation session in the database
   */
  async createConversationSession(
    userId: string,
    llmProvider: string,
    ttsProvider: string,
    voiceModelId?: string,
    faceModelId?: string
  ): Promise<string> {
    const session = await this.prisma.conversationSession.create({
      data: {
        userId,
        llmProvider,
        ttsProvider,
        voiceModelId,
        faceModelId,
        state: ConversationState.IDLE,
      },
    });

    return session.id;
  }

  /**
   * Update conversation session state
   */
  async updateSessionState(sessionId: string, state: ConversationState): Promise<void> {
    await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: { state },
    });
  }

  /**
   * Add a conversation turn to the session
   */
  async addConversationTurn(
    sessionId: string,
    turn: Omit<ConversationTurn, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<ConversationTurn> {
    const createdTurn = await this.prisma.conversationTurn.create({
      data: {
        sessionId,
        ...turn,
      },
    });

    // Update session metrics
    await this.updateSessionMetrics(sessionId);

    return {
      id: createdTurn.id,
      sessionId: createdTurn.sessionId,
      timestamp: createdTurn.timestamp,
      userAudioDurationMs: createdTurn.userAudioDurationMs,
      userTranscript: createdTurn.userTranscript,
      transcriptConfidence: createdTurn.transcriptConfidence,
      retrievedChunks: createdTurn.retrievedChunks,
      llmResponse: createdTurn.llmResponse,
      responseAudioDurationMs: createdTurn.responseAudioDurationMs,
      asrLatencyMs: createdTurn.asrLatencyMs,
      ragLatencyMs: createdTurn.ragLatencyMs,
      llmLatencyMs: createdTurn.llmLatencyMs,
      ttsLatencyMs: createdTurn.ttsLatencyMs,
      totalLatencyMs: createdTurn.totalLatencyMs,
      asrCost: createdTurn.asrCost,
      llmCost: createdTurn.llmCost,
      ttsCost: createdTurn.ttsCost,
      totalCost: createdTurn.totalCost,
    };
  }

  /**
   * Get conversation history (last N turns)
   */
  async getConversationHistory(sessionId: string, limit: number = 5): Promise<ConversationTurn[]> {
    const turns = await this.prisma.conversationTurn.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return turns.map((turn: any) => ({
      id: turn.id,
      sessionId: turn.sessionId,
      timestamp: turn.timestamp,
      userAudioDurationMs: turn.userAudioDurationMs,
      userTranscript: turn.userTranscript,
      transcriptConfidence: turn.transcriptConfidence,
      retrievedChunks: turn.retrievedChunks,
      llmResponse: turn.llmResponse,
      responseAudioDurationMs: turn.responseAudioDurationMs,
      asrLatencyMs: turn.asrLatencyMs,
      ragLatencyMs: turn.ragLatencyMs,
      llmLatencyMs: turn.llmLatencyMs,
      ttsLatencyMs: turn.ttsLatencyMs,
      totalLatencyMs: turn.totalLatencyMs,
      asrCost: turn.asrCost,
      llmCost: turn.llmCost,
      ttsCost: turn.ttsCost,
      totalCost: turn.totalCost,
    }));
  }

  /**
   * End a conversation session
   */
  async endConversationSession(sessionId: string): Promise<void> {
    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Conversation session ${sessionId} not found`);
    }

    const durationSeconds = Math.floor((new Date().getTime() - session.startedAt.getTime()) / 1000);

    await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        durationSeconds,
        state: ConversationState.IDLE,
      },
    });
  }

  /**
   * Get user's conversation sessions (paginated)
   */
  async getUserSessions(
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
      totalCost: number;
      state: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.prisma.conversationSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          durationSeconds: true,
          totalTurns: true,
          totalCost: true,
          state: true,
        },
      }),
      this.prisma.conversationSession.count({ where: { userId } }),
    ]);

    return {
      sessions,
      total,
      page,
      limit,
    };
  }

  /**
   * Get session details with turns
   */
  async getSessionDetails(sessionId: string): Promise<{
    session: {
      id: string;
      userId: string;
      startedAt: Date;
      endedAt: Date | null;
      durationSeconds: number;
      state: string;
      llmProvider: string;
      ttsProvider: string;
      totalTurns: number;
      averageLatencyMs: number;
      totalCost: number;
    };
    turns: ConversationTurn[];
  }> {
    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
      include: {
        turns: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error(`Conversation session ${sessionId} not found`);
    }

    return {
      session: {
        id: session.id,
        userId: session.userId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSeconds: session.durationSeconds,
        state: session.state,
        llmProvider: session.llmProvider,
        ttsProvider: session.ttsProvider,
        totalTurns: session.totalTurns,
        averageLatencyMs: session.averageLatencyMs,
        totalCost: session.totalCost,
      },
      turns: session.turns.map((turn: any) => ({
        id: turn.id,
        sessionId: turn.sessionId,
        timestamp: turn.timestamp,
        userAudioDurationMs: turn.userAudioDurationMs,
        userTranscript: turn.userTranscript,
        transcriptConfidence: turn.transcriptConfidence,
        retrievedChunks: turn.retrievedChunks,
        llmResponse: turn.llmResponse,
        responseAudioDurationMs: turn.responseAudioDurationMs,
        asrLatencyMs: turn.asrLatencyMs,
        ragLatencyMs: turn.ragLatencyMs,
        llmLatencyMs: turn.llmLatencyMs,
        ttsLatencyMs: turn.ttsLatencyMs,
        totalLatencyMs: turn.totalLatencyMs,
        asrCost: turn.asrCost,
        llmCost: turn.llmCost,
        ttsCost: turn.ttsCost,
        totalCost: turn.totalCost,
      })),
    };
  }

  /**
   * Delete a conversation session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.conversationSession.delete({
      where: { id: sessionId },
    });
  }

  /**
   * Get conversation statistics for a user
   */
  async getConversationStats(userId: string): Promise<ConversationSessionStats> {
    const sessions = await this.prisma.conversationSession.findMany({
      where: { userId },
      select: {
        durationSeconds: true,
        totalCost: true,
        totalTurns: true,
      },
    });

    const totalSessions = sessions.length;
    const avgDuration =
      totalSessions > 0
        ? sessions.reduce((sum: number, s: any) => sum + s.durationSeconds, 0) / totalSessions
        : 0;
    const avgCost =
      totalSessions > 0
        ? sessions.reduce((sum: number, s: any) => sum + s.totalCost, 0) / totalSessions
        : 0;
    const totalTurns = sessions.reduce((sum: number, s: any) => sum + s.totalTurns, 0);

    return {
      totalSessions,
      avgDuration,
      avgCost,
      totalTurns,
    };
  }

  /**
   * Update session metrics (called after adding a turn)
   */
  private async updateSessionMetrics(sessionId: string): Promise<void> {
    const turns = await this.prisma.conversationTurn.findMany({
      where: { sessionId },
    });

    const totalTurns = turns.length;
    const totalLatency = turns.reduce((sum: number, turn: any) => sum + turn.totalLatencyMs, 0);
    const averageLatencyMs = totalTurns > 0 ? totalLatency / totalTurns : 0;
    const totalCost = turns.reduce((sum: number, turn: any) => sum + turn.totalCost, 0);

    await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        totalTurns,
        averageLatencyMs,
        totalCost,
      },
    });
  }

  /**
   * Cleanup expired sessions (sessions older than 24 hours with no activity)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.prisma.conversationSession.deleteMany({
      where: {
        endedAt: {
          lt: twentyFourHoursAgo,
        },
      },
    });

    return result.count;
  }
}
