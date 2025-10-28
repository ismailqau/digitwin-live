export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: Error) => boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === options.maxAttempts) {
        break;
      }

      if (options.shouldRetry && !options.shouldRetry(lastError)) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
    }
  }

  throw lastError!;
}
