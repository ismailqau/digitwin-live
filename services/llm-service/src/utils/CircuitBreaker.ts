/**
 * Circuit Breaker Implementation
 * Provides fault tolerance and fallback logic for LLM providers
 */

import { logger } from '../temp-types';

export enum CircuitState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Circuit is open, requests fail fast
  HALF_OPEN = 'half_open', // Testing if service is back
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before trying again (ms)
  monitoringPeriod: number; // Time window for failure counting (ms)
  successThreshold: number; // Successes needed to close from half-open
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 300000, // 5 minutes
      successThreshold: config.successThreshold || 3,
    };

    logger.debug('Circuit breaker initialized', { name, config: this.config });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to half-open', { name: this.name });
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if the circuit breaker allows requests
   */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    // OPEN state - check if we should attempt reset
    return this.shouldAttemptReset();
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    logger.info('Circuit breaker reset', { name: this.name });
  }

  /**
   * Force the circuit breaker to open state
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    logger.warn('Circuit breaker forced open', { name: this.name });
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.failureCount = 0; // Reset failure count on success

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info('Circuit breaker closed after successful recovery', { name: this.name });
      }
    }
  }

  private onFailure(): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open on failure in half-open state
      this.state = CircuitState.OPEN;
      logger.warn('Circuit breaker opened from half-open state', { name: this.name });
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.shouldOpen()) {
        this.state = CircuitState.OPEN;
        logger.warn('Circuit breaker opened due to failures', {
          name: this.name,
          failureCount: this.failureCount,
          threshold: this.config.failureThreshold,
        });
      }
    }
  }

  private shouldOpen(): boolean {
    // Open if failure count exceeds threshold within monitoring period
    if (this.failureCount >= this.config.failureThreshold) {
      const now = Date.now();
      const monitoringStart = now - this.config.monitoringPeriod;

      // If last failure was within monitoring period, open the circuit
      return this.lastFailureTime !== null && this.lastFailureTime > monitoringStart;
    }

    return false;
  }

  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) {
      return true;
    }

    const now = Date.now();
    return now - this.lastFailureTime >= this.config.recoveryTimeout;
  }
}
