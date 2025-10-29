import { ServiceError } from './ServiceError';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export class RetryPolicy {
  constructor(private config: RetryConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.config.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if error is retryable
        if (!this.isRetryable(error as Error)) {
          throw error;
        }

        // Don't delay after last attempt
        if (attempt >= this.config.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Max retry attempts reached');
  }

  private isRetryable(error: Error): boolean {
    if (error instanceof ServiceError) {
      return error.retryable;
    }

    // Check if error message matches retryable patterns
    if (this.config.retryableErrors) {
      return this.config.retryableErrors.some(pattern =>
        error.message.toLowerCase().includes(pattern.toLowerCase())
      );
    }

    return false;
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
