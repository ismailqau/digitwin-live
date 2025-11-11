/**
 * Sentence Buffer Service
 * Buffers streaming tokens into complete sentences for TTS processing
 */

import { logger } from '../temp-types';

export interface SentenceChunk {
  text: string;
  isComplete: boolean;
  sequenceNumber: number;
  timestamp: Date;
}

export interface BufferConfig {
  minSentenceLength: number; // Minimum characters for a sentence
  maxBufferTime: number; // Maximum time to buffer before forcing output (ms)
  sentenceEndMarkers: string[]; // Punctuation that ends sentences
  abbreviations: string[]; // Common abbreviations to avoid false splits
}

export class SentenceBuffer {
  private buffer = '';
  private sequenceNumber = 0;
  private lastOutputTime = Date.now();
  private config: BufferConfig;
  private pendingTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<BufferConfig> = {}) {
    this.config = {
      minSentenceLength: config.minSentenceLength || 10,
      maxBufferTime: config.maxBufferTime || 3000, // 3 seconds max
      sentenceEndMarkers: config.sentenceEndMarkers || ['.', '!', '?', ':', ';'],
      abbreviations: config.abbreviations || [
        'Dr',
        'Mr',
        'Mrs',
        'Ms',
        'Prof',
        'Inc',
        'Ltd',
        'Corp',
        'vs',
        'etc',
        'i.e',
        'e.g',
        'a.m',
        'p.m',
        'U.S',
        'U.K',
      ],
    };

    logger.debug('Sentence Buffer initialized', { config: this.config });
  }

  /**
   * Add a token to the buffer and return complete sentences
   */
  addToken(token: string): SentenceChunk[] {
    this.buffer += token;
    const chunks: SentenceChunk[] = [];

    // Clear any pending timeout
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    // Try to extract complete sentences
    const sentences = this.extractSentences();

    for (const sentence of sentences) {
      chunks.push({
        text: sentence,
        isComplete: true,
        sequenceNumber: ++this.sequenceNumber,
        timestamp: new Date(),
      });
    }

    // Set timeout for remaining buffer content
    if (this.buffer.trim().length > 0) {
      this.pendingTimeout = setTimeout(() => {
        const remaining = this.flushBuffer();
        if (remaining) {
          // This would need to be handled by the caller
          logger.debug('Buffer flushed due to timeout', {
            text: remaining.text,
            bufferTime: Date.now() - this.lastOutputTime,
          });
        }
      }, this.config.maxBufferTime);
    }

    if (chunks.length > 0) {
      this.lastOutputTime = Date.now();
    }

    return chunks;
  }

  /**
   * Flush any remaining content in the buffer
   */
  flushBuffer(): SentenceChunk | null {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    const remaining = this.buffer.trim();
    if (remaining.length === 0) {
      return null;
    }

    this.buffer = '';
    this.lastOutputTime = Date.now();

    return {
      text: remaining,
      isComplete: false, // Incomplete sentence
      sequenceNumber: ++this.sequenceNumber,
      timestamp: new Date(),
    };
  }

  /**
   * Reset the buffer
   */
  reset(): void {
    this.buffer = '';
    this.sequenceNumber = 0;
    this.lastOutputTime = Date.now();

    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }

  /**
   * Get current buffer status
   */
  getStatus(): {
    bufferLength: number;
    bufferContent: string;
    timeSinceLastOutput: number;
    sequenceNumber: number;
  } {
    return {
      bufferLength: this.buffer.length,
      bufferContent: this.buffer,
      timeSinceLastOutput: Date.now() - this.lastOutputTime,
      sequenceNumber: this.sequenceNumber,
    };
  }

  private extractSentences(): string[] {
    const sentences: string[] = [];
    let workingBuffer = this.buffer;

    while (workingBuffer.length > 0) {
      const sentenceEnd = this.findSentenceEnd(workingBuffer);

      if (sentenceEnd === -1) {
        // No complete sentence found
        break;
      }

      const sentence = workingBuffer.substring(0, sentenceEnd + 1).trim();

      // Check if sentence meets minimum length requirement
      if (sentence.length >= this.config.minSentenceLength) {
        sentences.push(sentence);
        workingBuffer = workingBuffer.substring(sentenceEnd + 1);
      } else {
        // Sentence too short, might be abbreviation or incomplete
        const nextSpace = workingBuffer.indexOf(' ', sentenceEnd + 1);
        if (nextSpace === -1) {
          // No more content, break
          break;
        }
        // Continue looking from next space
        workingBuffer = workingBuffer.substring(nextSpace);
      }
    }

    // Update buffer with remaining content
    this.buffer = workingBuffer;

    return sentences;
  }

  private findSentenceEnd(text: string): number {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (this.config.sentenceEndMarkers.includes(char)) {
        // Check if this is a real sentence end or an abbreviation
        if (this.isRealSentenceEnd(text, i)) {
          return i;
        }
      }
    }

    return -1;
  }

  private isRealSentenceEnd(text: string, position: number): boolean {
    const char = text[position];

    // Look at the context around the punctuation
    const beforeContext = text.substring(Math.max(0, position - 10), position);
    const afterContext = text.substring(position + 1, Math.min(text.length, position + 10));

    // Check for abbreviations
    const wordBefore = beforeContext.split(/\s+/).pop() || '';
    if (
      this.config.abbreviations.some((abbr) =>
        wordBefore.toLowerCase().startsWith(abbr.toLowerCase())
      )
    ) {
      return false;
    }

    // Period-specific checks
    if (char === '.') {
      // Check for decimal numbers
      const charBefore = text[position - 1];
      const charAfter = text[position + 1];

      if (charBefore && charAfter && /\d/.test(charBefore) && /\d/.test(charAfter)) {
        return false; // Decimal number
      }

      // Check for ellipsis
      if (text.substring(position, position + 3) === '...') {
        return false; // Part of ellipsis
      }

      // Check if followed by lowercase (likely abbreviation)
      if (charAfter && /[a-z]/.test(charAfter)) {
        return false;
      }
    }

    // Check if followed by whitespace and capital letter (good sentence end)
    const nextNonSpace = afterContext.match(/\S/);
    if (nextNonSpace && /[A-Z]/.test(nextNonSpace[0])) {
      return true;
    }

    // Check if at end of text
    if (position === text.length - 1) {
      return true;
    }

    // Check if followed by whitespace (likely sentence end)
    const charAfter = text[position + 1];
    if (charAfter && /\s/.test(charAfter)) {
      return true;
    }

    return false;
  }
}
