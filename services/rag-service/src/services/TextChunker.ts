/**
 * TextChunker - Splits text into overlapping chunks for embedding
 */

export interface TextChunk {
  content: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
}

export interface ChunkerConfig {
  chunkSize: number; // Target tokens per chunk (500-1000)
  overlap: number; // Overlap tokens (100)
  minChunkSize?: number; // Minimum chunk size (default: 100)
}

export class TextChunker {
  private config: Required<ChunkerConfig>;

  constructor(config: ChunkerConfig) {
    this.config = {
      ...config,
      minChunkSize: config.minChunkSize || 100,
    };
  }

  /**
   * Split text into overlapping chunks
   */
  chunk(text: string): TextChunk[] {
    // Clean and normalize text
    const cleanedText = this.cleanText(text);

    // Split into sentences for better chunk boundaries
    const sentences = this.splitIntoSentences(cleanedText);

    const chunks: TextChunk[] = [];
    let currentChunk: string[] = [];
    let currentTokenCount = 0;
    let chunkIndex = 0;
    let startOffset = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      // If adding this sentence exceeds chunk size, save current chunk
      if (currentTokenCount + sentenceTokens > this.config.chunkSize && currentChunk.length > 0) {
        const chunkText = currentChunk.join(' ');
        chunks.push({
          content: chunkText,
          chunkIndex,
          startOffset,
          endOffset: startOffset + chunkText.length,
          tokenCount: currentTokenCount,
        });

        // Calculate overlap
        const overlapSentences = this.getOverlapSentences(currentChunk, this.config.overlap);
        currentChunk = overlapSentences;
        currentTokenCount = this.estimateTokens(currentChunk.join(' '));
        startOffset = startOffset + chunkText.length - currentChunk.join(' ').length;
        chunkIndex++;
      }

      currentChunk.push(sentence);
      currentTokenCount += sentenceTokens;
    }

    // Add remaining chunk if it meets minimum size
    if (currentChunk.length > 0 && currentTokenCount >= this.config.minChunkSize) {
      const chunkText = currentChunk.join(' ');
      chunks.push({
        content: chunkText,
        chunkIndex,
        startOffset,
        endOffset: startOffset + chunkText.length,
        tokenCount: currentTokenCount,
      });
    }

    return chunks;
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return (
      text
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove control characters
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/gu, '')
        // Trim
        .trim()
    );
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting (can be improved with NLP library)
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

    return sentences;
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    // This is a rough approximation; for production, use tiktoken or similar
    return Math.ceil(text.length / 4);
  }

  /**
   * Get sentences for overlap
   */
  private getOverlapSentences(sentences: string[], targetTokens: number): string[] {
    const overlap: string[] = [];
    let tokenCount = 0;

    // Take sentences from the end until we reach target overlap
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentenceTokens = this.estimateTokens(sentences[i]);
      if (tokenCount + sentenceTokens > targetTokens) {
        break;
      }
      overlap.unshift(sentences[i]);
      tokenCount += sentenceTokens;
    }

    return overlap;
  }

  /**
   * Get chunker statistics
   */
  getStats(chunks: TextChunk[]): {
    totalChunks: number;
    avgTokensPerChunk: number;
    minTokens: number;
    maxTokens: number;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        avgTokensPerChunk: 0,
        minTokens: 0,
        maxTokens: 0,
      };
    }

    const tokenCounts = chunks.map((c) => c.tokenCount);
    return {
      totalChunks: chunks.length,
      avgTokensPerChunk: tokenCounts.reduce((a, b) => a + b, 0) / chunks.length,
      minTokens: Math.min(...tokenCounts),
      maxTokens: Math.max(...tokenCounts),
    };
  }
}
