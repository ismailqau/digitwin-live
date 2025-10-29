export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeoutMs: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && new Date() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN');
      }
      // Try to transition to HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      this.failureCount = 0;
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout)
      ),
    ]);
  }

  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.lastFailureTime = new Date();
    this.totalFailures++;
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeoutMs);
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeoutMs);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
  }
}
