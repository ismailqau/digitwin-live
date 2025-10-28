export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function exponentialBackoff(attempt: number, baseDelayMs: number = 1000): number {
  return Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30000);
}
