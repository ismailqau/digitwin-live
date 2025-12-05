import { createLogger } from '@clone/logger';
// TODO: RAG service should be called via gRPC, not imported directly
// import { RAGOrchestrator } from '@clone/rag-service';
import { Response, NextFunction } from 'express';

import { AuthRequest } from '../middleware/auth.middleware';

const logger = createLogger('RAGController');

// TODO: Define proper RAG service interface
interface RAGService {
  processQuery: (params: {
    query: string;
    userId: string;
    conversationHistory: unknown[];
    userProfile: { name: string; personalityTraits: unknown[] };
    filters?: { sourceType: string };
  }) => Promise<{ sources: unknown[]; context: string }>;
  healthCheck: () => Promise<unknown>;
}

export class RAGController {
  private ragService: RAGService; // TODO: Replace with gRPC client

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  async search(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, knowledgeBaseId } = req.body;
      const userId = req.user?.id || 'anonymous';

      logger.debug('RAG search request', { query, userId });

      // Use the RAG orchestrator to perform search
      const results = await this.ragService.processQuery({
        query,
        userId,
        conversationHistory: [],
        userProfile: {
          name: req.user?.email || 'Anonymous',
          personalityTraits: [],
        },
        filters: knowledgeBaseId ? { sourceType: 'document' } : undefined,
      });

      res.status(200).json({
        results: results.sources,
        query,
        totalResults: results.sources.length,
        context: results.context,
      });
    } catch (error) {
      logger.error('RAG search failed', { error });
      next(error);
    }
  }

  async getStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await this.ragService.healthCheck();

      res.status(200).json({
        service: 'rag',
        health,
      });
    } catch (error) {
      logger.error('Failed to get RAG stats', { error });
      next(error);
    }
  }
}
