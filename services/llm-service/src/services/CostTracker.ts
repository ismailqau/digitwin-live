/**
 * Cost Tracker Service
 * Tracks costs per provider and conversation for LLM usage
 */

import { logger } from '../temp-types';
import { LLMProvider, LLMResponse } from '../types';

export interface CostBreakdown {
  provider: LLMProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: Date;
}

export interface ConversationCost {
  sessionId: string;
  userId: string;
  totalCost: number;
  breakdown: CostBreakdown[];
  startTime: Date;
  endTime?: Date;
}

export interface ProviderCostSummary {
  provider: LLMProvider;
  totalCost: number;
  requestCount: number;
  averageCostPerRequest: number;
  totalTokens: number;
  averageCostPerToken: number;
}

export class CostTracker {
  private conversationCosts = new Map<string, ConversationCost>();
  private dailyCosts = new Map<string, number>(); // date -> total cost
  private providerCosts = new Map<LLMProvider, ProviderCostSummary>();

  constructor() {
    logger.info('Cost Tracker initialized');
  }

  /**
   * Track cost for an LLM response
   */
  trackResponse(sessionId: string, userId: string, response: LLMResponse): void {
    const costBreakdown: CostBreakdown = {
      provider: response.provider,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      cost: response.cost,
      timestamp: new Date(),
    };

    // Track conversation cost
    this.trackConversationCost(sessionId, userId, costBreakdown);

    // Track daily cost
    this.trackDailyCost(costBreakdown.cost);

    // Track provider cost
    this.trackProviderCost(costBreakdown);

    logger.debug('Cost tracked', {
      sessionId,
      provider: response.provider,
      cost: response.cost,
      tokens: response.usage.totalTokens,
    });
  }

  /**
   * Get cost breakdown for a conversation
   */
  getConversationCost(sessionId: string): ConversationCost | null {
    return this.conversationCosts.get(sessionId) || null;
  }

  /**
   * Get total cost for a user across all conversations
   */
  getUserTotalCost(userId: string): number {
    let totalCost = 0;

    for (const conversation of this.conversationCosts.values()) {
      if (conversation.userId === userId) {
        totalCost += conversation.totalCost;
      }
    }

    return totalCost;
  }

  /**
   * Get daily cost summary
   */
  getDailyCost(date?: Date): number {
    const dateKey = this.getDateKey(date || new Date());
    return this.dailyCosts.get(dateKey) || 0;
  }

  /**
   * Get cost summary by provider
   */
  getProviderCostSummary(): ProviderCostSummary[] {
    return Array.from(this.providerCosts.values());
  }

  /**
   * Get cost summary for a specific provider
   */
  getProviderCost(provider: LLMProvider): ProviderCostSummary | null {
    return this.providerCosts.get(provider) || null;
  }

  /**
   * Get average cost per conversation
   */
  getAverageCostPerConversation(): number {
    if (this.conversationCosts.size === 0) {
      return 0;
    }

    const totalCost = Array.from(this.conversationCosts.values()).reduce(
      (sum, conv) => sum + conv.totalCost,
      0
    );

    return totalCost / this.conversationCosts.size;
  }

  /**
   * Get cost statistics
   */
  getCostStatistics(): {
    totalConversations: number;
    totalCost: number;
    averageCostPerConversation: number;
    dailyCost: number;
    providerBreakdown: ProviderCostSummary[];
  } {
    const totalCost = Array.from(this.conversationCosts.values()).reduce(
      (sum, conv) => sum + conv.totalCost,
      0
    );

    return {
      totalConversations: this.conversationCosts.size,
      totalCost,
      averageCostPerConversation: this.getAverageCostPerConversation(),
      dailyCost: this.getDailyCost(),
      providerBreakdown: this.getProviderCostSummary(),
    };
  }

  /**
   * End a conversation and finalize its cost tracking
   */
  endConversation(sessionId: string): void {
    const conversation = this.conversationCosts.get(sessionId);
    if (conversation && !conversation.endTime) {
      conversation.endTime = new Date();
      logger.info('Conversation cost tracking ended', {
        sessionId,
        totalCost: conversation.totalCost,
        duration: conversation.endTime.getTime() - conversation.startTime.getTime(),
      });
    }
  }

  /**
   * Clear old conversation data (for memory management)
   */
  clearOldConversations(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let clearedCount = 0;

    for (const [sessionId, conversation] of this.conversationCosts.entries()) {
      if (conversation.startTime < cutoffTime) {
        this.conversationCosts.delete(sessionId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.info('Cleared old conversation cost data', { clearedCount });
    }

    return clearedCount;
  }

  /**
   * Export cost data for analysis
   */
  exportCostData(): {
    conversations: ConversationCost[];
    dailyCosts: Record<string, number>;
    providerSummaries: ProviderCostSummary[];
    exportedAt: Date;
  } {
    return {
      conversations: Array.from(this.conversationCosts.values()),
      dailyCosts: Object.fromEntries(this.dailyCosts.entries()),
      providerSummaries: this.getProviderCostSummary(),
      exportedAt: new Date(),
    };
  }

  private trackConversationCost(
    sessionId: string,
    userId: string,
    costBreakdown: CostBreakdown
  ): void {
    let conversation = this.conversationCosts.get(sessionId);

    if (!conversation) {
      conversation = {
        sessionId,
        userId,
        totalCost: 0,
        breakdown: [],
        startTime: new Date(),
      };
      this.conversationCosts.set(sessionId, conversation);
    }

    conversation.breakdown.push(costBreakdown);
    conversation.totalCost += costBreakdown.cost;
  }

  private trackDailyCost(cost: number): void {
    const dateKey = this.getDateKey(new Date());
    const currentDailyCost = this.dailyCosts.get(dateKey) || 0;
    this.dailyCosts.set(dateKey, currentDailyCost + cost);
  }

  private trackProviderCost(costBreakdown: CostBreakdown): void {
    let providerSummary = this.providerCosts.get(costBreakdown.provider);

    if (!providerSummary) {
      providerSummary = {
        provider: costBreakdown.provider,
        totalCost: 0,
        requestCount: 0,
        averageCostPerRequest: 0,
        totalTokens: 0,
        averageCostPerToken: 0,
      };
      this.providerCosts.set(costBreakdown.provider, providerSummary);
    }

    providerSummary.totalCost += costBreakdown.cost;
    providerSummary.requestCount += 1;
    providerSummary.totalTokens += costBreakdown.promptTokens + costBreakdown.completionTokens;
    providerSummary.averageCostPerRequest =
      providerSummary.totalCost / providerSummary.requestCount;
    providerSummary.averageCostPerToken =
      providerSummary.totalTokens > 0 ? providerSummary.totalCost / providerSummary.totalTokens : 0;
  }

  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
}
