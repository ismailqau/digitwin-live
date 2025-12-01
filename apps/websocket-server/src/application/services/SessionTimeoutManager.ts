import { injectable, inject } from 'tsyringe';

import { ISessionRepository } from '../../domain/repositories/ISessionRepository';

export interface SessionTimeoutConfig {
  checkIntervalMs: number; // How often to check for expired sessions (default: 5 minutes)
  sessionTimeoutMs: number; // Session timeout duration (default: 2 hours)
  cleanupAfterMs: number; // Cleanup sessions after this duration (default: 24 hours)
}

/**
 * Manages session timeouts and cleanup
 */
@injectable()
export class SessionTimeoutManager {
  private checkInterval: NodeJS.Timeout | null = null;
  private config: SessionTimeoutConfig;

  constructor(@inject('ISessionRepository') private sessionRepository: ISessionRepository) {
    this.config = {
      checkIntervalMs: 5 * 60 * 1000, // 5 minutes
      sessionTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours
      cleanupAfterMs: 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  /**
   * Start the timeout manager
   */
  start(config?: Partial<SessionTimeoutConfig>): void {
    if (this.checkInterval) {
      console.warn('SessionTimeoutManager is already running');
      return;
    }

    // Merge config
    if (config) {
      this.config = { ...this.config, ...config };
    }

    console.log(
      `✅ SessionTimeoutManager started (check interval: ${this.config.checkIntervalMs / 1000}s, timeout: ${this.config.sessionTimeoutMs / 1000}s)`
    );

    // Run immediately
    this.checkExpiredSessions();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkExpiredSessions();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the timeout manager
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('✅ SessionTimeoutManager stopped');
    }
  }

  /**
   * Check for expired sessions and clean them up
   */
  private async checkExpiredSessions(): Promise<void> {
    try {
      const expiredCount = await this.sessionRepository.cleanupExpiredSessions();
      if (expiredCount > 0) {
        console.log(`🧹 Cleaned up ${expiredCount} expired sessions`);
      }
    } catch (error) {
      console.error('❌ Error checking expired sessions:', error);
    }
  }

  /**
   * Manually trigger session cleanup
   */
  async triggerCleanup(): Promise<number> {
    return await this.sessionRepository.cleanupExpiredSessions();
  }
}
