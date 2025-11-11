/**
 * TextChunker Tests
 * Tests for text chunking with various chunk sizes and overlaps
 */

import { TextChunker, ChunkerConfig, TextChunk } from '../services/TextChunker';

describe('TextChunker', () => {
  describe('constructor', () => {
    it('should initialize with default minChunkSize', () => {
      const config: ChunkerConfig = {
        chunkSize: 500,
        overlap: 100,
      };

      const chunker = new TextChunker(config);
      expect(chunker).toBeInstanceOf(TextChunker);
    });

    it('should initialize with custom minChunkSize', () => {
      const config: ChunkerConfig = {
        chunkSize: 500,
        overlap: 100,
        minChunkSize: 50,
      };

      const chunker = new TextChunker(config);
      expect(chunker).toBeInstanceOf(TextChunker);
    });
  });

  describe('chunk', () => {
    let chunker: TextChunker;

    beforeEach(() => {
      chunker = new TextChunker({
        chunkSize: 100, // Small for testing
        overlap: 20,
        minChunkSize: 10,
      });
    });

    it('should chunk simple text correctly', () => {
      const text =
        'This is a test sentence. This is another test sentence. This is a third test sentence.';

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('content');
      expect(chunks[0]).toHaveProperty('chunkIndex');
      expect(chunks[0]).toHaveProperty('startOffset');
      expect(chunks[0]).toHaveProperty('endOffset');
      expect(chunks[0]).toHaveProperty('tokenCount');
      expect(chunks[0].chunkIndex).toBe(0);
    });

    it('should handle empty text', () => {
      const chunks = chunker.chunk('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle single sentence', () => {
      const text =
        'This is a single sentence with enough content to meet minimum chunk size requirements.';

      const chunks = chunker.chunk(text);

      if (chunks.length > 0) {
        expect(chunks[0].content).toContain('single sentence');
        expect(chunks[0].chunkIndex).toBe(0);
        expect(chunks[0].startOffset).toBe(0);
      }
    });

    it('should create overlapping chunks', () => {
      // Create text that will definitely need multiple chunks
      const sentences = Array(20).fill(
        'This is a test sentence with enough words to create overlap.'
      );
      const text = sentences.join(' ');

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);

      // Check that chunks have some overlapping content
      if (chunks.length > 1) {
        // Check for overlap by looking at the first chunk's end and second chunk's start
        const firstChunkWords = chunks[0].content.split(' ');
        const secondChunkWords = chunks[1].content.split(' ');

        // There should be some overlap (not exact match due to sentence boundaries)
        const hasOverlap = secondChunkWords.some((word) => firstChunkWords.includes(word));
        expect(hasOverlap).toBe(true);
      }
    });

    it('should maintain proper chunk indices', () => {
      const text = Array(50).fill('This is a test sentence.').join(' ');

      const chunks = chunker.chunk(text);

      chunks.forEach((chunk, index) => {
        expect(chunk.chunkIndex).toBe(index);
      });
    });

    it('should calculate token counts', () => {
      const text = Array(20).fill('This is a test sentence with enough content.').join(' ');

      const chunks = chunker.chunk(text);

      if (chunks.length > 0) {
        expect(chunks[0].tokenCount).toBeGreaterThan(0);
        // Rough estimation: ~4 characters per token
        expect(chunks[0].tokenCount).toBeGreaterThan(10);
      }
    });

    it('should handle text with various punctuation', () => {
      const text = 'Hello! How are you? I am fine. What about you... Are you okay?';

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('Hello!');
    });

    it('should clean excessive whitespace', () => {
      const text = 'This   has    excessive     whitespace.    Another   sentence.';

      const chunks = chunker.chunk(text);

      expect(chunks[0].content).not.toMatch(/\s{2,}/);
      expect(chunks[0].content).toBe('This has excessive whitespace. Another sentence.');
    });

    it('should remove control characters', () => {
      const text = Array(20)
        .fill('This has\u0000control\u0001characters\u007F in the text.')
        .join(' ');

      const chunks = chunker.chunk(text);

      if (chunks.length > 0) {
        // eslint-disable-next-line no-control-regex
        expect(chunks[0].content).not.toMatch(/[\u0000-\u001F\u007F]/);
      }
    });

    it('should respect minimum chunk size', () => {
      const chunker = new TextChunker({
        chunkSize: 50,
        overlap: 10,
        minChunkSize: 30,
      });

      const text = 'Short.'; // Very short text

      const chunks = chunker.chunk(text);

      // Should not create chunk if below minimum size
      expect(chunks).toHaveLength(0);
    });

    it('should handle different chunk sizes', () => {
      const text = Array(100).fill('This is a test sentence.').join(' ');

      const smallChunker = new TextChunker({ chunkSize: 50, overlap: 10 });
      const largeChunker = new TextChunker({ chunkSize: 200, overlap: 20 });

      const smallChunks = smallChunker.chunk(text);
      const largeChunks = largeChunker.chunk(text);

      expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
    });

    it('should handle different overlap sizes', () => {
      const text = Array(50).fill('This is a test sentence.').join(' ');

      const noOverlapChunker = new TextChunker({ chunkSize: 100, overlap: 0 });
      const highOverlapChunker = new TextChunker({ chunkSize: 100, overlap: 50 });

      const noOverlapChunks = noOverlapChunker.chunk(text);
      const highOverlapChunks = highOverlapChunker.chunk(text);

      // High overlap should create more chunks
      expect(highOverlapChunks.length).toBeGreaterThanOrEqual(noOverlapChunks.length);
    });

    it('should calculate correct start and end offsets', () => {
      const text = 'First sentence. Second sentence. Third sentence.';

      const chunks = chunker.chunk(text);

      if (chunks.length > 0) {
        expect(chunks[0].startOffset).toBe(0);
        expect(chunks[0].endOffset).toBe(chunks[0].content.length);

        if (chunks.length > 1) {
          // Subsequent chunks should have proper offsets
          expect(chunks[1].startOffset).toBeGreaterThanOrEqual(0);
          expect(chunks[1].endOffset).toBeGreaterThan(chunks[1].startOffset);
        }
      }
    });

    it('should handle very long sentences', () => {
      const longSentence =
        'This is a very long sentence that contains many words and should be handled properly even though it exceeds the normal chunk size and might need special handling to ensure it is processed correctly.';

      const chunks = chunker.chunk(longSentence);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe(longSentence);
    });

    it('should handle text with no sentence endings', () => {
      const text =
        'This text has no proper sentence endings and just continues on and on without any periods or question marks or exclamation points';

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe(text);
    });
  });

  describe('getStats', () => {
    let chunker: TextChunker;

    beforeEach(() => {
      chunker = new TextChunker({
        chunkSize: 100,
        overlap: 20,
        minChunkSize: 10,
      });
    });

    it('should return correct stats for chunks', () => {
      const text = Array(20).fill('This is a test sentence.').join(' ');
      const chunks = chunker.chunk(text);

      const stats = chunker.getStats(chunks);

      expect(stats.totalChunks).toBe(chunks.length);
      expect(stats.avgTokensPerChunk).toBeGreaterThan(0);
      expect(stats.minTokens).toBeGreaterThan(0);
      expect(stats.maxTokens).toBeGreaterThan(0);
      expect(stats.minTokens).toBeLessThanOrEqual(stats.avgTokensPerChunk);
      expect(stats.maxTokens).toBeGreaterThanOrEqual(stats.avgTokensPerChunk);
    });

    it('should handle empty chunks array', () => {
      const stats = chunker.getStats([]);

      expect(stats.totalChunks).toBe(0);
      expect(stats.avgTokensPerChunk).toBe(0);
      expect(stats.minTokens).toBe(0);
      expect(stats.maxTokens).toBe(0);
    });

    it('should calculate correct averages', () => {
      const mockChunks: TextChunk[] = [
        { content: 'test', chunkIndex: 0, startOffset: 0, endOffset: 4, tokenCount: 10 },
        { content: 'test', chunkIndex: 1, startOffset: 4, endOffset: 8, tokenCount: 20 },
        { content: 'test', chunkIndex: 2, startOffset: 8, endOffset: 12, tokenCount: 30 },
      ];

      const stats = chunker.getStats(mockChunks);

      expect(stats.totalChunks).toBe(3);
      expect(stats.avgTokensPerChunk).toBe(20);
      expect(stats.minTokens).toBe(10);
      expect(stats.maxTokens).toBe(30);
    });

    it('should handle single chunk', () => {
      const mockChunks: TextChunk[] = [
        { content: 'test', chunkIndex: 0, startOffset: 0, endOffset: 4, tokenCount: 15 },
      ];

      const stats = chunker.getStats(mockChunks);

      expect(stats.totalChunks).toBe(1);
      expect(stats.avgTokensPerChunk).toBe(15);
      expect(stats.minTokens).toBe(15);
      expect(stats.maxTokens).toBe(15);
    });
  });

  describe('edge cases', () => {
    it('should handle text with only whitespace', () => {
      const chunker = new TextChunker({ chunkSize: 100, overlap: 20 });
      const text = '   \n\t   \n   ';

      const chunks = chunker.chunk(text);

      expect(chunks).toHaveLength(0);
    });

    it('should handle text with mixed line endings', () => {
      const chunker = new TextChunker({ chunkSize: 100, overlap: 20 });
      const text = Array(20)
        .fill('Line with content.\nAnother line with content.\r\nThird line with content.')
        .join(' ');

      const chunks = chunker.chunk(text);

      if (chunks.length > 0) {
        expect(chunks[0].content).toContain('Line with content');
      }
    });

    it('should handle text with special characters', () => {
      const chunker = new TextChunker({ chunkSize: 100, overlap: 20 });
      const text = Array(20)
        .fill('Text with émojis 🚀 and spëcial çharacters! How does it handle thëse?')
        .join(' ');

      const chunks = chunker.chunk(text);

      if (chunks.length > 0) {
        expect(chunks[0].content).toContain('émojis 🚀');
      }
    });

    it('should handle very small chunk sizes', () => {
      const chunker = new TextChunker({ chunkSize: 5, overlap: 1, minChunkSize: 1 });
      const text = 'This is a test.';

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle overlap larger than chunk size', () => {
      const chunker = new TextChunker({ chunkSize: 50, overlap: 100 }); // Overlap > chunk size
      const text = Array(20).fill('This is a test sentence.').join(' ');

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      // Should still work, just with different behavior
    });

    it('should handle zero overlap', () => {
      const chunker = new TextChunker({ chunkSize: 100, overlap: 0 });
      const text = Array(20).fill('This is a test sentence.').join(' ');

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);

      // With zero overlap, chunks should not share content
      if (chunks.length > 1) {
        const allContent = chunks.map((c) => c.content).join('');
        const originalLength = text.replace(/\s+/g, ' ').trim().length;
        expect(allContent.length).toBeLessThanOrEqual(originalLength * 1.1); // Allow some variance
      }
    });
  });

  describe('performance', () => {
    it('should handle large text efficiently', () => {
      const chunker = new TextChunker({ chunkSize: 500, overlap: 100 });
      const largeText = Array(1000)
        .fill('This is a test sentence with enough content to test performance.')
        .join(' ');

      const start = Date.now();
      const chunks = chunker.chunk(largeText);
      const duration = Date.now() - start;

      expect(chunks.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle many small chunks efficiently', () => {
      const chunker = new TextChunker({ chunkSize: 20, overlap: 5 });
      const text = Array(500).fill('Short sentence.').join(' ');

      const start = Date.now();
      const chunks = chunker.chunk(text);
      const duration = Date.now() - start;

      expect(chunks.length).toBeGreaterThan(10);
      expect(duration).toBeLessThan(1000);
    });
  });
});
