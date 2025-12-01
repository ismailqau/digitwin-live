/**
 * WebSocket compression utilities
 * Implements per-message deflate compression for WebSocket messages
 */

import { logger } from '@clone/logger';

export interface CompressionOptions {
  enabled: boolean;
  threshold: number; // Minimum message size to compress (bytes)
  level: number; // Compression level (0-9)
}

export class WebSocketCompression {
  private options: CompressionOptions;

  constructor(options?: Partial<CompressionOptions>) {
    this.options = {
      enabled: options?.enabled ?? true,
      threshold: options?.threshold ?? 1024, // 1KB
      level: options?.level ?? 6,
    };
  }

  /**
   * Check if message should be compressed
   */
  shouldCompress(message: string | Buffer): boolean {
    if (!this.options.enabled) {
      return false;
    }

    const size = typeof message === 'string' ? Buffer.byteLength(message) : message.length;

    return size >= this.options.threshold;
  }

  /**
   * Get compression options for Socket.io
   */
  getSocketIOOptions(): Record<string, unknown> {
    return {
      perMessageDeflate: this.options.enabled
        ? {
            threshold: this.options.threshold,
            zlibDeflateOptions: {
              level: this.options.level,
            },
            zlibInflateOptions: {
              chunkSize: 10 * 1024, // 10KB chunks
            },
          }
        : false,
    };
  }

  /**
   * Update compression options
   */
  updateOptions(options: Partial<CompressionOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };

    logger.info('Compression options updated', this.options);
  }

  /**
   * Get current options
   */
  getOptions(): CompressionOptions {
    return { ...this.options };
  }
}

/**
 * Adaptive compression based on network quality
 */
export function getAdaptiveCompressionLevel(networkQuality: string): number {
  switch (networkQuality) {
    case 'excellent':
      return 4; // Lower compression for speed
    case 'good':
      return 6; // Balanced
    case 'fair':
      return 7; // Higher compression
    case 'poor':
      return 9; // Maximum compression
    default:
      return 6;
  }
}
