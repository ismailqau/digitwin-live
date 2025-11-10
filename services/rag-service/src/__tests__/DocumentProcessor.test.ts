/**
 * DocumentProcessor Tests
 */

import { TextChunker } from '../services/TextChunker';
import { TextExtractor } from '../services/TextExtractor';

describe('DocumentProcessor', () => {
  // Test individual components

  describe('TextExtractor', () => {
    it('should validate unsupported file types', async () => {
      const textExtractor = new TextExtractor();

      // Unsupported type
      const invalidResult = await textExtractor.validateFile(
        '/tmp/test.exe',
        'application/x-msdownload',
        50 * 1024 * 1024
      );
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });

    it('should validate supported file types', async () => {
      const textExtractor = new TextExtractor();

      // Supported type (but file doesn't exist)
      const result = await textExtractor.validateFile(
        '/tmp/nonexistent.pdf',
        'application/pdf',
        50 * 1024 * 1024
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('TextChunker', () => {
    it('should chunk text correctly', () => {
      const textChunker = new TextChunker({
        chunkSize: 100,
        overlap: 20,
        minChunkSize: 10,
      });

      // Create a longer text that will definitely be chunked
      const text = Array(50)
        .fill('This is a test sentence with enough words to create multiple chunks.')
        .join(' ');
      const chunks = textChunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      if (chunks.length > 0) {
        expect(chunks[0]).toHaveProperty('content');
        expect(chunks[0]).toHaveProperty('chunkIndex');
        expect(chunks[0]).toHaveProperty('tokenCount');
      }
    });

    it('should calculate stats correctly', () => {
      const textChunker = new TextChunker({
        chunkSize: 100,
        overlap: 20,
        minChunkSize: 10,
      });

      const text = Array(50).fill('This is a test sentence with enough words.').join(' ');
      const chunks = textChunker.chunk(text);
      const stats = textChunker.getStats(chunks);

      expect(stats.totalChunks).toBe(chunks.length);
      if (chunks.length > 0) {
        expect(stats.avgTokensPerChunk).toBeGreaterThan(0);
      }
    });
  });
});
