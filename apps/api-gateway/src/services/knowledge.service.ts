/**
 * KnowledgeService - Handles knowledge source priority and configuration
 */

import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';

export interface KnowledgeSourcePriority {
  documents: number;
  faqs: number;
  conversations: number;
}

export interface KnowledgeSourcesResponse {
  sources: Array<{
    type: string;
    priority: number;
    enabled: boolean;
  }>;
}

export class KnowledgeService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get knowledge sources with priorities
   */
  async getKnowledgeSources(userId: string): Promise<KnowledgeSourcesResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const settings = user.settings as any;
    const knowledgeSources = settings.knowledgeSources || {
      documents: 1,
      faqs: 2,
      conversations: 3,
    };

    return {
      sources: [
        {
          type: 'documents',
          priority: knowledgeSources.documents,
          enabled: true,
        },
        {
          type: 'faqs',
          priority: knowledgeSources.faqs,
          enabled: true,
        },
        {
          type: 'conversations',
          priority: knowledgeSources.conversations,
          enabled: true,
        },
      ],
    };
  }

  /**
   * Update knowledge source priorities
   */
  async updateSourcePriorities(
    userId: string,
    priorities: KnowledgeSourcePriority
  ): Promise<KnowledgeSourcesResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const settings = user.settings as any;
    const updatedSettings = {
      ...settings,
      knowledgeSources: priorities,
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: { settings: updatedSettings },
    });

    logger.info('Knowledge source priorities updated', { userId, priorities });

    return this.getKnowledgeSources(userId);
  }

  /**
   * Preview search results with current priorities
   */
  async previewSearchResults(userId: string, query: string) {
    // Get current priorities
    const sources = await this.getKnowledgeSources(userId);

    // Simulate search results from each source
    // TODO: Implement actual vector search with priority weighting
    const preview = {
      query,
      sources: sources.sources,
      results: {
        documents: [],
        faqs: [],
        conversations: [],
      },
      message: 'Preview functionality will be implemented with vector search',
    };

    return preview;
  }
}
