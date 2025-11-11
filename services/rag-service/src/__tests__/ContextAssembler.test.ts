/**
 * ContextAssembler Tests
 * Tests for context assembly from search results, conversation history, and user profile
 */

import {
  ContextAssembler,
  ConversationTurn,
  UserProfile,
  LLMContext,
} from '../services/ContextAssembler';
import { SearchResult } from '../services/VectorSearchService';

describe('ContextAssembler', () => {
  let contextAssembler: ContextAssembler;
  let mockUserProfile: UserProfile;
  let mockSearchResults: SearchResult[];
  let mockConversationHistory: ConversationTurn[];

  beforeEach(() => {
    contextAssembler = new ContextAssembler({
      maxConversationTurns: 3,
      maxKnowledgeChunks: 5,
    });

    mockUserProfile = {
      name: 'John Doe',
      personalityTraits: ['friendly', 'analytical', 'helpful'],
      speakingStyle: 'casual and informative',
    };

    mockSearchResults = [
      {
        id: 'result-1',
        score: 0.95,
        content: 'Machine learning is a subset of artificial intelligence.',
        metadata: { title: 'AI Basics', sourceType: 'document' },
      },
      {
        id: 'result-2',
        score: 0.87,
        content: 'Neural networks are inspired by biological neural networks.',
        metadata: { filename: 'neural-networks.pdf', sourceType: 'document' },
      },
      {
        id: 'result-3',
        score: 0.82,
        content: 'Deep learning uses multiple layers to model data.',
        metadata: { title: 'Deep Learning Guide', sourceType: 'faq' },
      },
    ];

    mockConversationHistory = [
      {
        userTranscript: 'What is AI?',
        llmResponse:
          'AI stands for Artificial Intelligence, which refers to computer systems that can perform tasks typically requiring human intelligence.',
        timestamp: new Date('2023-01-01T10:00:00Z'),
      },
      {
        userTranscript: 'How does it work?',
        llmResponse:
          'AI works through various techniques like machine learning, where systems learn from data to make predictions or decisions.',
        timestamp: new Date('2023-01-01T10:01:00Z'),
      },
    ];
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const assembler = new ContextAssembler();
      expect(assembler).toBeInstanceOf(ContextAssembler);
    });

    it('should initialize with custom configuration', () => {
      const assembler = new ContextAssembler({
        maxConversationTurns: 10,
        maxKnowledgeChunks: 8,
      });
      expect(assembler).toBeInstanceOf(ContextAssembler);
    });
  });

  describe('assembleContext', () => {
    it('should assemble complete context successfully', () => {
      const query = 'Tell me about machine learning';

      const context = contextAssembler.assembleContext(
        query,
        mockSearchResults,
        mockConversationHistory,
        mockUserProfile
      );

      expect(context).toHaveProperty('systemPrompt');
      expect(context).toHaveProperty('userPersonality');
      expect(context).toHaveProperty('relevantKnowledge');
      expect(context).toHaveProperty('conversationHistory');
      expect(context).toHaveProperty('currentQuery');

      expect(context.currentQuery).toBe(query);
      expect(context.systemPrompt).toContain('John Doe');
      expect(context.userPersonality).toContain('friendly, analytical, helpful');
      expect(context.relevantKnowledge).toHaveLength(3);
      expect(context.conversationHistory).toContain('What is AI?');
    });

    it('should handle empty search results', () => {
      const query = 'Tell me about something unknown';

      const context = contextAssembler.assembleContext(
        query,
        [],
        mockConversationHistory,
        mockUserProfile
      );

      expect(context.relevantKnowledge).toHaveLength(0);
      expect(context.systemPrompt).toContain('John Doe');
      expect(context.conversationHistory).toContain('What is AI?');
    });

    it('should handle empty conversation history', () => {
      const query = 'Tell me about machine learning';

      const context = contextAssembler.assembleContext(
        query,
        mockSearchResults,
        [],
        mockUserProfile
      );

      expect(context.conversationHistory).toBe('No previous conversation history.');
      expect(context.relevantKnowledge).toHaveLength(3);
    });

    it('should limit knowledge chunks to maxKnowledgeChunks', () => {
      const assembler = new ContextAssembler({ maxKnowledgeChunks: 2 });
      const query = 'Tell me about machine learning';

      const context = assembler.assembleContext(
        query,
        mockSearchResults,
        mockConversationHistory,
        mockUserProfile
      );

      expect(context.relevantKnowledge).toHaveLength(2);
      // Should take the top 2 results by score
      expect(context.relevantKnowledge[0]).toContain('Machine learning is a subset');
      expect(context.relevantKnowledge[1]).toContain('Neural networks are inspired');
    });

    it('should limit conversation turns to maxConversationTurns', () => {
      const assembler = new ContextAssembler({ maxConversationTurns: 1 });
      const query = 'Tell me about machine learning';

      const context = assembler.assembleContext(
        query,
        mockSearchResults,
        mockConversationHistory,
        mockUserProfile
      );

      // Should only include the last turn
      expect(context.conversationHistory).toContain('How does it work?');
      expect(context.conversationHistory).not.toContain('What is AI?');
    });

    it('should format personality traits correctly', () => {
      const context = contextAssembler.assembleContext('test query', [], [], mockUserProfile);

      expect(context.userPersonality).toContain(
        'Personality traits: friendly, analytical, helpful'
      );
      expect(context.userPersonality).toContain('Speaking style: casual and informative');
    });

    it('should handle user profile without speaking style', () => {
      const profileWithoutStyle: UserProfile = {
        name: 'Jane Doe',
        personalityTraits: ['professional', 'concise'],
      };

      const context = contextAssembler.assembleContext('test query', [], [], profileWithoutStyle);

      expect(context.userPersonality).toBe('Personality traits: professional, concise');
      expect(context.userPersonality).not.toContain('Speaking style:');
    });

    it('should format knowledge chunks with source information', () => {
      const context = contextAssembler.assembleContext(
        'test query',
        mockSearchResults,
        [],
        mockUserProfile
      );

      expect(context.relevantKnowledge[0]).toContain('[Source 1: AI Basics (relevance: 95.0%)]');
      expect(context.relevantKnowledge[0]).toContain('Machine learning is a subset');

      expect(context.relevantKnowledge[1]).toContain(
        '[Source 2: neural-networks.pdf (relevance: 87.0%)]'
      );
      expect(context.relevantKnowledge[1]).toContain('Neural networks are inspired');
    });

    it('should handle search results without title or filename', () => {
      const resultsWithoutTitle: SearchResult[] = [
        {
          id: 'result-1',
          score: 0.9,
          content: 'Some content without title',
          metadata: { sourceType: 'document' },
        },
      ];

      const context = contextAssembler.assembleContext(
        'test query',
        resultsWithoutTitle,
        [],
        mockUserProfile
      );

      expect(context.relevantKnowledge[0]).toContain(
        '[Source 1: Unknown source (relevance: 90.0%)]'
      );
    });

    it('should format conversation history with turn numbers', () => {
      const context = contextAssembler.assembleContext(
        'test query',
        [],
        mockConversationHistory,
        mockUserProfile
      );

      expect(context.conversationHistory).toContain('Turn 1:');
      expect(context.conversationHistory).toContain('User: What is AI?');
      expect(context.conversationHistory).toContain('Assistant: AI stands for');
      expect(context.conversationHistory).toContain('Turn 2:');
      expect(context.conversationHistory).toContain('User: How does it work?');
    });
  });

  describe('buildPrompt', () => {
    it('should build complete prompt with all sections', () => {
      const context: LLMContext = {
        systemPrompt: "You are John Doe's AI clone.",
        userPersonality: 'Personality traits: friendly, helpful',
        relevantKnowledge: [
          '[Source 1: AI Guide] Machine learning basics',
          '[Source 2: FAQ] Deep learning explanation',
        ],
        conversationHistory: 'Turn 1:\nUser: What is AI?\nAssistant: AI explanation',
        currentQuery: 'Tell me about neural networks',
      };

      const prompt = contextAssembler.buildPrompt(context);

      expect(prompt).toContain("You are John Doe's AI clone.");
      expect(prompt).toContain('Personality traits: friendly, helpful');
      expect(prompt).toContain('Relevant Knowledge:');
      expect(prompt).toContain('[Source 1: AI Guide] Machine learning basics');
      expect(prompt).toContain('[Source 2: FAQ] Deep learning explanation');
      expect(prompt).toContain('Recent Conversation:');
      expect(prompt).toContain('Turn 1:\nUser: What is AI?');
      expect(prompt).toContain('Current Question: Tell me about neural networks');
      expect(prompt).toContain('Response:');
    });

    it('should handle context with no knowledge', () => {
      const context: LLMContext = {
        systemPrompt: "You are John Doe's AI clone.",
        userPersonality: 'Personality traits: friendly',
        relevantKnowledge: [],
        conversationHistory: 'No previous conversation history.',
        currentQuery: 'Tell me something',
      };

      const prompt = contextAssembler.buildPrompt(context);

      expect(prompt).toContain('No relevant knowledge found in the knowledge base.');
      expect(prompt).not.toContain('Relevant Knowledge:');
    });

    it('should handle context with empty personality', () => {
      const context: LLMContext = {
        systemPrompt: 'You are an AI clone.',
        userPersonality: '',
        relevantKnowledge: ['Some knowledge'],
        conversationHistory: 'No previous conversation history.',
        currentQuery: 'Test query',
      };

      const prompt = contextAssembler.buildPrompt(context);

      expect(prompt).toContain('You are an AI clone.');
      expect(prompt).toContain('Relevant Knowledge:');
      expect(prompt).toContain('Some knowledge');
      expect(prompt).toContain('Current Question: Test query');
    });

    it('should maintain proper section order', () => {
      const context: LLMContext = {
        systemPrompt: 'System prompt',
        userPersonality: 'Personality',
        relevantKnowledge: ['Knowledge'],
        conversationHistory: 'History',
        currentQuery: 'Query',
      };

      const prompt = contextAssembler.buildPrompt(context);
      const sections = prompt.split('\n\n');

      expect(sections[0]).toContain('System prompt');
      expect(sections[1]).toContain('Personality');
      expect(sections[2]).toContain('Relevant Knowledge:');
      expect(sections[3]).toContain('Recent Conversation:');
      expect(sections[4]).toContain('Current Question:');
      expect(sections[5]).toContain('Response:');
    });
  });

  describe('edge cases', () => {
    it('should handle very long conversation history', () => {
      const longHistory: ConversationTurn[] = Array(10)
        .fill(0)
        .map((_, i) => ({
          userTranscript: `Question ${i + 1}`,
          llmResponse: `Answer ${i + 1}`,
          timestamp: new Date(),
        }));

      const assembler = new ContextAssembler({ maxConversationTurns: 3 });
      const context = assembler.assembleContext('test query', [], longHistory, mockUserProfile);

      // Should only include last 3 turns
      expect(context.conversationHistory).toContain('Question 8');
      expect(context.conversationHistory).toContain('Question 9');
      expect(context.conversationHistory).toContain('Question 10');
      expect(context.conversationHistory).not.toContain('Question 7');
    });

    it('should handle many search results', () => {
      const manyResults: SearchResult[] = Array(20)
        .fill(0)
        .map((_, i) => ({
          id: `result-${i}`,
          score: 0.9 - i * 0.01,
          content: `Content ${i}`,
          metadata: { title: `Document ${i}` },
        }));

      const assembler = new ContextAssembler({ maxKnowledgeChunks: 5 });
      const context = assembler.assembleContext('test query', manyResults, [], mockUserProfile);

      expect(context.relevantKnowledge).toHaveLength(5);
      // Should take top 5 by score
      expect(context.relevantKnowledge[0]).toContain('Content 0');
      expect(context.relevantKnowledge[4]).toContain('Content 4');
    });

    it('should handle empty user profile name', () => {
      const emptyProfile: UserProfile = {
        name: '',
        personalityTraits: [],
      };

      const context = contextAssembler.assembleContext('test query', [], [], emptyProfile);

      expect(context.systemPrompt).toContain("You are 's AI clone");
      expect(context.userPersonality).toBe('Personality traits: ');
    });

    it('should handle special characters in content', () => {
      const specialResults: SearchResult[] = [
        {
          id: 'special-1',
          score: 0.9,
          content: 'Content with "quotes" and \'apostrophes\' and émojis 🚀',
          metadata: { title: 'Special Characters Doc' },
        },
      ];

      const context = contextAssembler.assembleContext(
        'test query',
        specialResults,
        [],
        mockUserProfile
      );

      expect(context.relevantKnowledge[0]).toContain('Content with "quotes"');
      expect(context.relevantKnowledge[0]).toContain('émojis 🚀');
    });

    it('should handle very long search result content', () => {
      const longContent = 'A'.repeat(10000);
      const longResults: SearchResult[] = [
        {
          id: 'long-1',
          score: 0.9,
          content: longContent,
          metadata: { title: 'Long Document' },
        },
      ];

      const context = contextAssembler.assembleContext(
        'test query',
        longResults,
        [],
        mockUserProfile
      );

      expect(context.relevantKnowledge[0]).toContain(longContent);
      expect(context.relevantKnowledge[0].length).toBeGreaterThan(10000);
    });
  });

  describe('performance', () => {
    it('should handle large context assembly efficiently', () => {
      const largeResults: SearchResult[] = Array(100)
        .fill(0)
        .map((_, i) => ({
          id: `result-${i}`,
          score: 0.9,
          content: `Large content ${i} `.repeat(100),
          metadata: { title: `Document ${i}` },
        }));

      const largeHistory: ConversationTurn[] = Array(50)
        .fill(0)
        .map((_, i) => ({
          userTranscript: `Question ${i}`,
          llmResponse: `Answer ${i}`,
          timestamp: new Date(),
        }));

      const start = Date.now();
      const context = contextAssembler.assembleContext(
        'test query',
        largeResults,
        largeHistory,
        mockUserProfile
      );
      const duration = Date.now() - start;

      expect(context).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should handle concurrent context assembly', async () => {
      const queries = Array(10)
        .fill(0)
        .map((_, i) => `Query ${i}`);

      const start = Date.now();
      const contexts = queries.map((query) =>
        contextAssembler.assembleContext(
          query,
          mockSearchResults,
          mockConversationHistory,
          mockUserProfile
        )
      );
      const duration = Date.now() - start;

      expect(contexts).toHaveLength(10);
      expect(contexts.every((c) => c.currentQuery.startsWith('Query'))).toBe(true);
      expect(duration).toBeLessThan(50);
    });
  });
});
