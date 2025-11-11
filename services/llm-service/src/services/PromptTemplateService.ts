/**
 * Prompt Template Service
 * Manages prompt templates for clone personality and knowledge integration
 */

import { logger } from '../temp-types';

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  systemPrompt: string;
  personalitySection: string;
  knowledgeSection: string;
  conversationSection: string;
  responseInstructions: string;
  maxTokens: number;
  temperature: number;
}

export interface PromptVariables {
  userName: string;
  personalityTraits: string[];
  relevantKnowledge: string[];
  conversationHistory: ConversationTurn[];
  currentQuery: string;
  responseStyle?: string;
  contextWindow?: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

export class PromptTemplateService {
  private templates = new Map<string, PromptTemplate>();
  private activeTemplate: string = 'default-v1';

  constructor() {
    this.initializeDefaultTemplates();
    logger.info('Prompt Template Service initialized');
  }

  /**
   * Get the active prompt template
   */
  getActiveTemplate(): PromptTemplate {
    const template = this.templates.get(this.activeTemplate);
    if (!template) {
      throw new Error(`Active template not found: ${this.activeTemplate}`);
    }
    return template;
  }

  /**
   * Set the active prompt template
   */
  setActiveTemplate(templateId: string): void {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template not found: ${templateId}`);
    }
    this.activeTemplate = templateId;
    logger.info('Active template changed', { templateId });
  }

  /**
   * Build complete prompt from template and variables
   */
  buildPrompt(variables: PromptVariables, templateId?: string): string {
    const template = templateId ? this.templates.get(templateId) : this.getActiveTemplate();

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Build personality section
    const personalityText = this.buildPersonalitySection(
      template.personalitySection,
      variables.userName,
      variables.personalityTraits,
      variables.responseStyle
    );

    // Build knowledge section
    const knowledgeText = this.buildKnowledgeSection(
      template.knowledgeSection,
      variables.relevantKnowledge
    );

    // Build conversation history section
    const conversationText = this.buildConversationSection(
      template.conversationSection,
      variables.conversationHistory,
      variables.contextWindow || 5
    );

    // Assemble complete prompt
    const completePrompt = template.systemPrompt
      .replace('{userName}', variables.userName)
      .replace('{personalitySection}', personalityText)
      .replace('{knowledgeSection}', knowledgeText)
      .replace('{conversationSection}', conversationText)
      .replace('{currentQuery}', variables.currentQuery)
      .replace('{responseInstructions}', template.responseInstructions);

    // Optimize for token limit
    return this.optimizePromptLength(completePrompt, template.maxTokens);
  }

  /**
   * Estimate token count for a prompt
   */
  estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Register a new prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    logger.info('Template registered', { id: template.id, version: template.version });
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * A/B test between two templates
   */
  selectTemplateForABTest(userId: string, templateA: string, templateB: string): string {
    // Simple hash-based selection for consistent A/B testing
    const hash = this.hashUserId(userId);
    return hash % 2 === 0 ? templateA : templateB;
  }

  private initializeDefaultTemplates(): void {
    // Default conversational clone template
    const defaultTemplate: PromptTemplate = {
      id: 'default-v1',
      name: 'Default Conversational Clone',
      version: '1.0.0',
      systemPrompt: `You are {userName}'s AI clone, designed to respond as they would based on their personality and knowledge.

{personalitySection}

{knowledgeSection}

{conversationSection}

Current Question: {currentQuery}

{responseInstructions}`,
      personalitySection: `## Personality Profile
You embody {userName}'s communication style and personality traits:
{personalityTraits}

Response Style: {responseStyle}`,
      knowledgeSection: `## Relevant Knowledge
Use the following information to provide accurate, personalized responses:
{relevantKnowledge}`,
      conversationSection: `## Recent Conversation
{conversationHistory}`,
      responseInstructions: `## Response Guidelines
- Respond naturally as {userName} would, maintaining their tone and style
- Use the provided knowledge to give accurate, helpful answers
- Keep responses conversational and concise (2-3 sentences for voice)
- If you don't have specific information, acknowledge this clearly
- Stay in character as {userName}'s digital twin
- Reference sources when using specific knowledge from documents

Response:`,
      maxTokens: 8000,
      temperature: 0.7,
    };

    // Concise template for faster responses
    const conciseTemplate: PromptTemplate = {
      id: 'concise-v1',
      name: 'Concise Response Template',
      version: '1.0.0',
      systemPrompt: `You are {userName}'s AI clone. Respond briefly and naturally.

{personalitySection}

{knowledgeSection}

Question: {currentQuery}

{responseInstructions}`,
      personalitySection: `Personality: {personalityTraits}`,
      knowledgeSection: `Knowledge: {relevantKnowledge}`,
      conversationSection: `Previous: {conversationHistory}`,
      responseInstructions: `Give a brief, natural response as {userName}. Max 2 sentences.`,
      maxTokens: 4000,
      temperature: 0.8,
    };

    // Detailed template for complex queries
    const detailedTemplate: PromptTemplate = {
      id: 'detailed-v1',
      name: 'Detailed Response Template',
      version: '1.0.0',
      systemPrompt: `You are {userName}'s comprehensive AI clone with access to their complete knowledge base.

{personalitySection}

{knowledgeSection}

{conversationSection}

Current Question: {currentQuery}

{responseInstructions}`,
      personalitySection: `## {userName}'s Personality Profile
Communication Style: {responseStyle}
Key Traits: {personalityTraits}

Maintain these characteristics in all responses while being helpful and informative.`,
      knowledgeSection: `## Knowledge Base
The following information is from {userName}'s personal knowledge base:
{relevantKnowledge}

Use this information to provide detailed, accurate responses with proper context.`,
      conversationSection: `## Conversation Context
{conversationHistory}

Consider this context when formulating your response.`,
      responseInstructions: `## Response Instructions
- Provide a comprehensive response as {userName}
- Use specific details from the knowledge base when relevant
- Maintain {userName}'s communication style and personality
- Cite sources when referencing specific documents or information
- Be thorough but conversational
- If information is incomplete, suggest where to find more details

Detailed Response:`,
      maxTokens: 12000,
      temperature: 0.6,
    };

    this.registerTemplate(defaultTemplate);
    this.registerTemplate(conciseTemplate);
    this.registerTemplate(detailedTemplate);
  }

  private buildPersonalitySection(
    template: string,
    userName: string,
    traits: string[],
    responseStyle?: string
  ): string {
    const traitsText =
      traits.length > 0
        ? traits.map((trait) => `- ${trait}`).join('\n')
        : 'Natural, helpful, and authentic communication';

    return template
      .replace('{userName}', userName)
      .replace('{personalityTraits}', traitsText)
      .replace('{responseStyle}', responseStyle || 'conversational and friendly');
  }

  private buildKnowledgeSection(template: string, knowledge: string[]): string {
    if (knowledge.length === 0) {
      return 'No specific knowledge available for this query.';
    }

    const knowledgeText = knowledge.map((item, index) => `${index + 1}. ${item}`).join('\n\n');

    return template.replace('{relevantKnowledge}', knowledgeText);
  }

  private buildConversationSection(
    template: string,
    history: ConversationTurn[],
    maxTurns: number
  ): string {
    if (history.length === 0) {
      return 'This is the start of the conversation.';
    }

    // Take the most recent turns within the limit
    const recentHistory = history.slice(-maxTurns * 2); // *2 for user+assistant pairs

    const historyText = recentHistory
      .map((turn) => {
        const role = turn.role === 'user' ? 'You' : 'Assistant';
        const sources =
          turn.sources && turn.sources.length > 0 ? ` [Sources: ${turn.sources.join(', ')}]` : '';
        return `${role}: ${turn.content}${sources}`;
      })
      .join('\n');

    return template.replace('{conversationHistory}', historyText);
  }

  private optimizePromptLength(prompt: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokenCount(prompt);

    if (estimatedTokens <= maxTokens) {
      return prompt;
    }

    logger.warn('Prompt exceeds token limit, truncating', {
      estimatedTokens,
      maxTokens,
      truncationRatio: maxTokens / estimatedTokens,
    });

    // Simple truncation strategy - keep the beginning and end
    const targetLength = Math.floor(prompt.length * (maxTokens / estimatedTokens));
    const keepStart = Math.floor(targetLength * 0.7);
    const keepEnd = targetLength - keepStart;

    const truncated =
      prompt.substring(0, keepStart) +
      '\n\n[... content truncated for length ...]\n\n' +
      prompt.substring(prompt.length - keepEnd);

    return truncated;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
