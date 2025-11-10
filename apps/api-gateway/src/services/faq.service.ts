/**
 * FAQService - Handles FAQ management
 */

import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';

export interface FAQResponse {
  id: string;
  userId: string;
  question: string;
  answer: string;
  priority: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FAQCreateInput {
  question: string;
  answer: string;
  priority?: number;
  tags?: string[];
}

export interface FAQUpdateInput {
  question?: string;
  answer?: string;
  priority?: number;
  tags?: string[];
}

export interface FAQListResult {
  faqs: FAQResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class FAQService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create FAQ
   */
  async createFAQ(userId: string, input: FAQCreateInput): Promise<FAQResponse> {
    const faq = await this.prisma.fAQ.create({
      data: {
        userId,
        question: input.question,
        answer: input.answer,
        priority: input.priority || 50,
        tags: input.tags || [],
      },
    });

    logger.info('FAQ created', { faqId: faq.id, userId });

    return this.formatFAQResponse(faq);
  }

  /**
   * Get FAQs with pagination
   */
  async getFAQs(userId: string, page: number = 1, limit: number = 20): Promise<FAQListResult> {
    const where = {
      userId,
      deletedAt: null,
    };

    const total = await this.prisma.fAQ.count({ where });

    const faqs = await this.prisma.fAQ.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      faqs: faqs.map((faq) => this.formatFAQResponse(faq)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get FAQ by ID
   */
  async getFAQ(faqId: string, userId: string): Promise<FAQResponse | null> {
    const faq = await this.prisma.fAQ.findFirst({
      where: {
        id: faqId,
        userId,
        deletedAt: null,
      },
    });

    if (!faq) {
      return null;
    }

    return this.formatFAQResponse(faq);
  }

  /**
   * Update FAQ
   */
  async updateFAQ(faqId: string, userId: string, updates: FAQUpdateInput): Promise<FAQResponse> {
    const faq = await this.prisma.fAQ.findFirst({
      where: {
        id: faqId,
        userId,
        deletedAt: null,
      },
    });

    if (!faq) {
      throw new Error('FAQ not found');
    }

    const updated = await this.prisma.fAQ.update({
      where: { id: faqId },
      data: updates,
    });

    logger.info('FAQ updated', { faqId, userId });

    return this.formatFAQResponse(updated);
  }

  /**
   * Delete FAQ
   */
  async deleteFAQ(faqId: string, userId: string): Promise<void> {
    const faq = await this.prisma.fAQ.findFirst({
      where: {
        id: faqId,
        userId,
        deletedAt: null,
      },
    });

    if (!faq) {
      throw new Error('FAQ not found');
    }

    // Soft delete
    await this.prisma.fAQ.update({
      where: { id: faqId },
      data: { deletedAt: new Date() },
    });

    logger.info('FAQ deleted', { faqId, userId });
  }

  /**
   * Reorder FAQs
   */
  async reorderFAQs(userId: string, faqIds: string[]): Promise<void> {
    // Update priorities based on order
    const updates = faqIds.map((id, index) => {
      const priority = 100 - index; // Higher index = lower priority
      return this.prisma.fAQ.update({
        where: { id },
        data: { priority },
      });
    });

    await this.prisma.$transaction(updates);

    logger.info('FAQs reordered', { userId, count: faqIds.length });
  }

  /**
   * Format FAQ response
   */
  private formatFAQResponse(faq: {
    id: string;
    userId: string;
    question: string;
    answer: string;
    priority: number;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }): FAQResponse {
    return {
      id: faq.id,
      userId: faq.userId,
      question: faq.question,
      answer: faq.answer,
      priority: faq.priority,
      tags: faq.tags,
      createdAt: faq.createdAt.toISOString(),
      updatedAt: faq.updatedAt.toISOString(),
    };
  }
}
