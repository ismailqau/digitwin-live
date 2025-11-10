import { logger } from '@clone/logger';

import { SearchResult } from './VectorSearchService';

export interface ConversationTurn {
  userTranscript: string;
  llmResponse: string;
  timestamp: Date;
}

export interface UserProfile {
  name: string;
  personalityTraits: string[];
  speakingStyle?: string;
}

export interface LLMContext {
  systemPrompt: string;
  userPersonality: string;
  relevantKnowledge: string[];
  conversationHistory: string;
  currentQuery: string;
}

export class ContextAssembler {
  private maxConversationTurns: number;
  private maxKnowledgeChunks: number;

  constructor(config: { maxConversationTurns?: number; maxKnowledgeChunks?: number } = {}) {
    this.maxConversationTurns = config.maxConversationTurns || 5;
    this.maxKnowledgeChunks = config.maxKnowledgeChunks || 5;
  }

  /**
   * Assemble context for LLM from search results, conversation history, and user profile
   */
  assembleContext(
    query: string,
    searchResults: SearchResult[],
    conversationHistory: ConversationTurn[],
    userProfile: UserProfile
  ): LLMContext {
    logger.info('Assembling context for LLM', {
      query,
      searchResultsCount: searchResults.length,
      conversationTurnsCount: conversationHistory.length,
    });

    // Format personality traits
    const personalityStr = this.formatPersonality(userProfile);

    // Format relevant knowledge from search results
    const knowledgeChunks = this.formatKnowledge(searchResults);

    // Format conversation history
    const historyStr = this.formatConversationHistory(conversationHistory);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(userProfile);

    const context: LLMContext = {
      systemPrompt,
      userPersonality: personalityStr,
      relevantKnowledge: knowledgeChunks,
      conversationHistory: historyStr,
      currentQuery: query,
    };

    logger.info('Context assembled', {
      knowledgeChunksCount: knowledgeChunks.length,
      conversationTurnsIncluded: Math.min(conversationHistory.length, this.maxConversationTurns),
    });

    return context;
  }

  private formatPersonality(userProfile: UserProfile): string {
    const traits = userProfile.personalityTraits.join(', ');
    const style = userProfile.speakingStyle ? `Speaking style: ${userProfile.speakingStyle}` : '';

    return `Personality traits: ${traits}${style ? '\n' + style : ''}`;
  }

  private formatKnowledge(searchResults: SearchResult[]): string[] {
    // Take top N results based on configuration
    const topResults = searchResults.slice(0, this.maxKnowledgeChunks);

    return topResults.map((result, index) => {
      const source = result.metadata.title || result.metadata.filename || 'Unknown source';
      return `[Source ${index + 1}: ${source} (relevance: ${(result.score * 100).toFixed(1)}%)]\n${result.content}`;
    });
  }

  private formatConversationHistory(conversationHistory: ConversationTurn[]): string {
    // Take last N turns based on configuration
    const recentTurns = conversationHistory.slice(-this.maxConversationTurns);

    if (recentTurns.length === 0) {
      return 'No previous conversation history.';
    }

    return recentTurns
      .map((turn, index) => {
        return `Turn ${index + 1}:\nUser: ${turn.userTranscript}\nAssistant: ${turn.llmResponse}`;
      })
      .join('\n\n');
  }

  private buildSystemPrompt(userProfile: UserProfile): string {
    return `You are ${userProfile.name}'s AI clone with their personality and knowledge.

Your role is to respond to questions as ${userProfile.name} would, using their knowledge base and maintaining their personality and speaking style.

Guidelines:
- Respond naturally as ${userProfile.name} would
- Use the provided knowledge to answer accurately
- Keep responses concise (2-3 sentences for voice delivery)
- If you don't have information in the knowledge base, say so clearly
- Maintain ${userProfile.name}'s tone and speaking style
- Reference sources when using specific information from the knowledge base`;
  }

  /**
   * Build the complete prompt for the LLM
   */
  buildPrompt(context: LLMContext): string {
    const parts: string[] = [context.systemPrompt];

    if (context.userPersonality) {
      parts.push(`\n${context.userPersonality}`);
    }

    if (context.relevantKnowledge.length > 0) {
      parts.push('\nRelevant Knowledge:');
      parts.push(...context.relevantKnowledge);
    } else {
      parts.push('\nNo relevant knowledge found in the knowledge base.');
    }

    if (context.conversationHistory) {
      parts.push(`\nRecent Conversation:\n${context.conversationHistory}`);
    }

    parts.push(`\nCurrent Question: ${context.currentQuery}`);
    parts.push('\nResponse:');

    return parts.join('\n');
  }
}
