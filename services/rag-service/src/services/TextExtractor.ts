/**
 * TextExtractor - Extract text from various document formats
 */

import * as fs from 'fs/promises';

import { logger } from '@clone/logger';
import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { marked } from 'marked';
import pdf from 'pdf-parse';

export interface ExtractionResult {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    characterCount: number;
    extractedAt: Date;
  };
}

export class TextExtractor {
  /**
   * Extract text from file based on content type
   */
  async extract(filePath: string, contentType: string): Promise<ExtractionResult> {
    logger.info('Extracting text from file', { filePath, contentType });

    try {
      let text: string;
      let pageCount: number | undefined;

      switch (contentType) {
        case 'application/pdf':
          ({ text, pageCount } = await this.extractFromPDF(filePath));
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          text = await this.extractFromDOCX(filePath);
          break;

        case 'text/plain':
          text = await this.extractFromTXT(filePath);
          break;

        case 'text/html':
          text = await this.extractFromHTML(filePath);
          break;

        case 'text/markdown':
        case 'text/x-markdown':
          text = await this.extractFromMarkdown(filePath);
          break;

        default:
          throw new Error(`Unsupported content type: ${contentType}`);
      }

      const result: ExtractionResult = {
        text,
        metadata: {
          pageCount,
          wordCount: this.countWords(text),
          characterCount: text.length,
          extractedAt: new Date(),
        },
      };

      logger.info('Text extraction completed', {
        filePath,
        wordCount: result.metadata.wordCount,
        characterCount: result.metadata.characterCount,
      });

      return result;
    } catch (error) {
      logger.error('Text extraction failed', { filePath, contentType, error });
      throw error;
    }
  }

  /**
   * Extract text from PDF
   */
  private async extractFromPDF(filePath: string): Promise<{ text: string; pageCount: number }> {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);

    return {
      text: data.text,
      pageCount: data.numpages,
    };
  }

  /**
   * Extract text from DOCX
   */
  private async extractFromDOCX(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  /**
   * Extract text from TXT
   */
  private async extractFromTXT(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  /**
   * Extract text from HTML
   */
  private async extractFromHTML(filePath: string): Promise<string> {
    const html = await fs.readFile(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style').remove();

    // Get text content
    return $('body').text().trim();
  }

  /**
   * Extract text from Markdown
   */
  private async extractFromMarkdown(filePath: string): Promise<string> {
    const markdown = await fs.readFile(filePath, 'utf-8');

    // Convert markdown to HTML
    const html = await marked(markdown);

    // Extract text from HTML
    const $ = cheerio.load(html);
    return $.text().trim();
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Validate file before extraction
   */
  async validateFile(
    filePath: string,
    contentType: string,
    maxSizeBytes: number = 50 * 1024 * 1024 // 50MB default
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if file exists
      const stats = await fs.stat(filePath);

      // Check file size
      if (stats.size > maxSizeBytes) {
        return {
          valid: false,
          error: `File size (${stats.size} bytes) exceeds maximum allowed size (${maxSizeBytes} bytes)`,
        };
      }

      // Check if file is empty
      if (stats.size === 0) {
        return {
          valid: false,
          error: 'File is empty',
        };
      }

      // Check if content type is supported
      const supportedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'text/html',
        'text/markdown',
        'text/x-markdown',
      ];

      if (!supportedTypes.includes(contentType)) {
        return {
          valid: false,
          error: `Unsupported content type: ${contentType}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
