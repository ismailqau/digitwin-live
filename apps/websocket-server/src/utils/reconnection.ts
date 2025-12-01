/**
 * Reconnection logic with exponential backoff
 * Handles WebSocket disconnections and automatic reconnection
 */

import { logger } from '@clone/logger';

export interface ReconnectionConfig {
  initialDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  maxAttempts: number; // Maximum reconnection attempts (0 = infinite)
  backoffMultiplier: number; // Multiplier for exponential backoff
}

export class ReconnectionManager {
  private config: ReconnectionConfig;
  private attempts: number = 0;
  private currentDelay: number;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;

  constructor(config?: Partial<ReconnectionConfig>) {
    this.config = {
      initialDelay: config?.initialDelay || 1000, // 1 second
      maxDelay: config?.maxDelay || 30000, // 30 seconds
      maxAttempts: config?.maxAttempts || 0, // Infinite
      backoffMultiplier: config?.backoffMultiplier || 2,
    };

    this.currentDelay = this.config.initialDelay;
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect(reconnectCallback: () => Promise<boolean>): void {
    if (this.isReconnecting) {
      logger.debug('Reconnection already in progress');
      return;
    }

    // Check if max attempts reached
    if (this.config.maxAttempts > 0 && this.attempts >= this.config.maxAttempts) {
      logger.error('Max reconnection attempts reached', {
        attempts: this.attempts,
        maxAttempts: this.config.maxAttempts,
      });
      return;
    }

    this.isReconnecting = true;
    this.attempts++;

    logger.info('Scheduling reconnection', {
      attempt: this.attempts,
      delay: this.currentDelay,
    });

    this.reconnectTimeout = setTimeout(async () => {
      try {
        logger.info('Attempting reconnection', { attempt: this.attempts });

        const success = await reconnectCallback();

        if (success) {
          logger.info('Reconnection successful', { attempt: this.attempts });
          this.reset();
        } else {
          logger.warn('Reconnection failed', { attempt: this.attempts });
          this.increaseDelay();
          this.isReconnecting = false;
          this.scheduleReconnect(reconnectCallback);
        }
      } catch (error) {
        logger.error('Reconnection error', {
          attempt: this.attempts,
          error: (error as Error).message,
        });
        this.increaseDelay();
        this.isReconnecting = false;
        this.scheduleReconnect(reconnectCallback);
      }
    }, this.currentDelay);
  }

  /**
   * Cancel scheduled reconnection
   */
  cancel(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isReconnecting = false;
    logger.info('Reconnection cancelled', { attempts: this.attempts });
  }

  /**
   * Reset reconnection state
   */
  reset(): void {
    this.cancel();
    this.attempts = 0;
    this.currentDelay = this.config.initialDelay;
    logger.info('Reconnection state reset');
  }

  /**
   * Increase delay with exponential backoff
   */
  private increaseDelay(): void {
    this.currentDelay = Math.min(
      this.currentDelay * this.config.backoffMultiplier,
      this.config.maxDelay
    );

    logger.debug('Reconnection delay increased', {
      currentDelay: this.currentDelay,
      maxDelay: this.config.maxDelay,
    });
  }

  /**
   * Get current reconnection state
   */
  getState(): {
    attempts: number;
    currentDelay: number;
    isReconnecting: boolean;
  } {
    return {
      attempts: this.attempts,
      currentDelay: this.currentDelay,
      isReconnecting: this.isReconnecting,
    };
  }
}
