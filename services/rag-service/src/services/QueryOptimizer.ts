import { logger } from '@clone/logger';

import { SearchResult } from './VectorSearchService';

export interface QueryOptimizationConfig {
  enablePreprocessing: boolean;
  enableQueryExpansion: boolean;
  enableReranking: boolean;
  enableDeduplication: boolean;
  relevanceThreshold: number;
  maxResults: number;
}

export interface OptimizedQuery {
  original: string;
  normalized: string;
  expanded: string[];
  keywords: string[];
}

export interface QueryAnalytics {
  query: string;
  userId: string;
  timestamp: Date;
  resultsCount: number;
  avgRelevanceScore: number;
  hasLowConfidence: boolean;
}

/**
 * Query Optimizer - Handles query preprocessing, expansion, and result optimization
 */
export class QueryOptimizer {
  private config: QueryOptimizationConfig;
  private stopWords: Set<string>;
  private acronymMap: Map<string, string>;
  private synonymMap: Map<string, string[]>;

  constructor(config: QueryOptimizationConfig) {
    this.config = config;
    this.stopWords = this.initializeStopWords();
    this.acronymMap = this.initializeAcronymMap();
    this.synonymMap = this.initializeSynonymMap();
  }

  /**
   * Preprocess query: normalize, remove stop words, expand acronyms
   */
  preprocessQuery(query: string): OptimizedQuery {
    if (!this.config.enablePreprocessing) {
      return {
        original: query,
        normalized: query,
        expanded: [query],
        keywords: [query],
      };
    }

    logger.info('Preprocessing query', { query });

    // Step 1: Normalize (lowercase, trim, remove extra spaces)
    let normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');

    // Step 2: Expand acronyms
    const words = normalized.split(' ');
    const expandedWords = words.map((word) => {
      const expansion = this.acronymMap.get(word.toUpperCase());
      return expansion || word;
    });
    normalized = expandedWords.join(' ');

    // Step 3: Extract keywords (remove stop words)
    const keywords = words.filter((word) => !this.stopWords.has(word) && word.length > 2);

    // Step 4: Generate expanded queries
    const expanded = this.config.enableQueryExpansion
      ? this.expandQuery(normalized, keywords)
      : [normalized];

    logger.info('Query preprocessed', {
      original: query,
      normalized,
      keywordsCount: keywords.length,
      expandedCount: expanded.length,
    });

    return {
      original: query,
      normalized,
      expanded,
      keywords,
    };
  }

  /**
   * Expand query using synonyms and related terms
   */
  private expandQuery(query: string, keywords: string[]): string[] {
    const expanded: string[] = [query];

    // Add synonym variations
    for (const keyword of keywords) {
      const synonyms = this.synonymMap.get(keyword);
      if (synonyms && synonyms.length > 0) {
        // Replace keyword with each synonym to create variations
        for (const synonym of synonyms.slice(0, 2)) {
          // Limit to 2 synonyms per keyword
          const variation = query.replace(keyword, synonym);
          if (variation !== query) {
            expanded.push(variation);
          }
        }
      }
    }

    // Limit total expanded queries to avoid performance issues
    return expanded.slice(0, 5);
  }

  /**
   * Re-rank search results based on recency, source priority, and relevance
   */
  rerankResults(
    results: SearchResult[],
    sourcePriority: Record<string, number>,
    conversationContext?: string[]
  ): SearchResult[] {
    if (!this.config.enableReranking || results.length === 0) {
      return results;
    }

    logger.info('Re-ranking search results', { count: results.length });

    const reranked = results.map((result) => {
      let adjustedScore = result.score;

      // Factor 1: Source priority (FAQs > documents > conversations)
      const sourceType = (result.metadata.sourceType as string) || 'document';
      const priorityBoost = sourcePriority[sourceType] || 1.0;
      adjustedScore *= priorityBoost;

      // Factor 2: Recency boost (newer content gets slight boost)
      const createdAt = result.metadata.createdAt as string;
      if (createdAt) {
        const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0.9, 1.0 - ageInDays / 365); // Decay over 1 year
        adjustedScore *= recencyBoost;
      }

      // Factor 3: Conversation context relevance
      if (conversationContext && conversationContext.length > 0) {
        const contextRelevance = this.calculateContextRelevance(
          result.content,
          conversationContext
        );
        adjustedScore *= 1.0 + contextRelevance * 0.2; // Up to 20% boost
      }

      return {
        ...result,
        score: adjustedScore,
        metadata: {
          ...result.metadata,
          originalScore: result.score,
          adjustedScore,
        },
      };
    });

    // Sort by adjusted score
    reranked.sort((a, b) => b.score - a.score);

    logger.info('Results re-ranked', {
      topScore: reranked[0]?.score,
      bottomScore: reranked[reranked.length - 1]?.score,
    });

    return reranked;
  }

  /**
   * Calculate relevance to conversation context
   */
  private calculateContextRelevance(content: string, context: string[]): number {
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    let matchCount = 0;
    let totalWords = 0;

    for (const contextItem of context) {
      const contextWords = contextItem.toLowerCase().split(/\s+/);
      totalWords += contextWords.length;
      for (const word of contextWords) {
        if (contentWords.has(word) && !this.stopWords.has(word)) {
          matchCount++;
        }
      }
    }

    return totalWords > 0 ? matchCount / totalWords : 0;
  }

  /**
   * Deduplicate similar results
   */
  deduplicateResults(results: SearchResult[]): SearchResult[] {
    if (!this.config.enableDeduplication || results.length === 0) {
      return results;
    }

    logger.info('Deduplicating results', { count: results.length });

    const deduplicated: SearchResult[] = [];
    const seenContent = new Set<string>();

    for (const result of results) {
      // Create a normalized content signature
      const signature = this.createContentSignature(result.content);

      // Check for similarity with already seen content
      let isDuplicate = false;
      for (const seen of seenContent) {
        if (this.calculateSimilarity(signature, seen) > 0.85) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        deduplicated.push(result);
        seenContent.add(signature);
      }
    }

    logger.info('Results deduplicated', {
      original: results.length,
      deduplicated: deduplicated.length,
      removed: results.length - deduplicated.length,
    });

    return deduplicated;
  }

  /**
   * Create a normalized content signature for similarity comparison
   */
  private createContentSignature(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => !this.stopWords.has(word))
      .sort()
      .join(' ');
  }

  /**
   * Calculate Jaccard similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Filter results by relevance threshold
   */
  filterByRelevance(results: SearchResult[]): SearchResult[] {
    const filtered = results.filter((result) => result.score >= this.config.relevanceThreshold);

    logger.info('Results filtered by relevance', {
      original: results.length,
      filtered: filtered.length,
      threshold: this.config.relevanceThreshold,
    });

    return filtered.slice(0, this.config.maxResults);
  }

  /**
   * Check if results indicate insufficient knowledge
   */
  hasInsufficientKnowledge(results: SearchResult[]): boolean {
    if (results.length === 0) {
      return true;
    }

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    return avgScore < this.config.relevanceThreshold;
  }

  /**
   * Track query analytics
   */
  trackQueryAnalytics(query: string, userId: string, results: SearchResult[]): QueryAnalytics {
    const avgScore =
      results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;

    const analytics: QueryAnalytics = {
      query,
      userId,
      timestamp: new Date(),
      resultsCount: results.length,
      avgRelevanceScore: avgScore,
      hasLowConfidence: avgScore < this.config.relevanceThreshold,
    };

    logger.info('Query analytics tracked', analytics);

    return analytics;
  }

  /**
   * Initialize common English stop words
   */
  private initializeStopWords(): Set<string> {
    return new Set([
      'a',
      'an',
      'and',
      'are',
      'as',
      'at',
      'be',
      'by',
      'for',
      'from',
      'has',
      'he',
      'in',
      'is',
      'it',
      'its',
      'of',
      'on',
      'that',
      'the',
      'to',
      'was',
      'will',
      'with',
      'the',
      'this',
      'but',
      'they',
      'have',
      'had',
      'what',
      'when',
      'where',
      'who',
      'which',
      'why',
      'how',
    ]);
  }

  /**
   * Initialize common acronym expansions
   */
  private initializeAcronymMap(): Map<string, string> {
    return new Map([
      ['AI', 'artificial intelligence'],
      ['ML', 'machine learning'],
      ['NLP', 'natural language processing'],
      ['API', 'application programming interface'],
      ['UI', 'user interface'],
      ['UX', 'user experience'],
      ['DB', 'database'],
      ['SQL', 'structured query language'],
      ['HTTP', 'hypertext transfer protocol'],
      ['URL', 'uniform resource locator'],
      ['JSON', 'javascript object notation'],
      ['XML', 'extensible markup language'],
      ['CSV', 'comma separated values'],
      ['PDF', 'portable document format'],
      ['FAQ', 'frequently asked questions'],
      ['TTS', 'text to speech'],
      ['ASR', 'automatic speech recognition'],
      ['RAG', 'retrieval augmented generation'],
      ['LLM', 'large language model'],
    ]);
  }

  /**
   * Initialize common synonym mappings
   */
  private initializeSynonymMap(): Map<string, string[]> {
    return new Map([
      ['create', ['make', 'build', 'generate']],
      ['delete', ['remove', 'erase', 'destroy']],
      ['update', ['modify', 'change', 'edit']],
      ['find', ['search', 'locate', 'discover']],
      ['show', ['display', 'present', 'reveal']],
      ['get', ['retrieve', 'fetch', 'obtain']],
      ['send', ['transmit', 'deliver', 'dispatch']],
      ['receive', ['get', 'accept', 'obtain']],
      ['start', ['begin', 'initiate', 'launch']],
      ['stop', ['end', 'terminate', 'halt']],
      ['help', ['assist', 'support', 'aid']],
      ['fix', ['repair', 'correct', 'resolve']],
      ['error', ['mistake', 'problem', 'issue']],
      ['fast', ['quick', 'rapid', 'swift']],
      ['slow', ['sluggish', 'delayed', 'gradual']],
    ]);
  }
}
