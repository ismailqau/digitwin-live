import { injectable } from 'tsyringe';

import logger from '../../infrastructure/logging/logger';

/**
 * Connection metrics tracked by the service
 */
export interface ConnectionMetrics {
  // Connection success metrics
  totalConnectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  connectionSuccessRate: number;

  // Authentication failure tracking
  authFailures: {
    AUTH_REQUIRED: number;
    AUTH_INVALID: number;
    AUTH_EXPIRED: number;
    SESSION_CREATE_FAILED: number;
  };

  // Timing metrics
  totalConnectionTime: number;
  averageConnectionTime: number;
  minConnectionTime: number;
  maxConnectionTime: number;

  // Timeout metrics
  totalTimeouts: number;
  timeoutRate: number;

  // Current state
  activeConnections: number;
  peakConnections: number;

  // Time window
  windowStartTime: number;
  lastResetTime: number;
}

/**
 * Alert thresholds for monitoring
 */
export interface AlertThresholds {
  minSuccessRate: number; // Default: 0.95 (95%)
  maxAverageConnectionTime: number; // Default: 3000ms (3 seconds)
  maxTimeoutRate: number; // Default: 0.05 (5%)
}

/**
 * Alert status
 */
export interface AlertStatus {
  successRateAlert: boolean;
  connectionTimeAlert: boolean;
  timeoutRateAlert: boolean;
  alerts: string[];
}

/**
 * Service for tracking WebSocket connection metrics and monitoring
 *
 * Tracks:
 * - Connection success rate (Requirement 4.1)
 * - Authentication failure reasons (Requirement 4.2)
 * - Average connection establishment time (Requirement 4.3)
 * - Timeout rate
 * - Active connections
 */
@injectable()
export class MetricsService {
  private metrics: ConnectionMetrics;
  private thresholds: AlertThresholds;
  private connectionTimings: Map<string, number>; // socketId -> startTime
  private metricsLogInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.thresholds = {
      minSuccessRate: 0.95, // 95%
      maxAverageConnectionTime: 3000, // 3 seconds
      maxTimeoutRate: 0.05, // 5%
    };
    this.connectionTimings = new Map();

    // Log metrics every 5 minutes (only in non-test environments)
    if (process.env.NODE_ENV !== 'test') {
      this.metricsLogInterval = setInterval(() => this.logMetricsSummary(), 5 * 60 * 1000);
    }
  }

  /**
   * Initialize metrics with default values
   */
  private initializeMetrics(): ConnectionMetrics {
    const now = Date.now();
    return {
      totalConnectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      connectionSuccessRate: 1.0,
      authFailures: {
        AUTH_REQUIRED: 0,
        AUTH_INVALID: 0,
        AUTH_EXPIRED: 0,
        SESSION_CREATE_FAILED: 0,
      },
      totalConnectionTime: 0,
      averageConnectionTime: 0,
      minConnectionTime: Infinity,
      maxConnectionTime: 0,
      totalTimeouts: 0,
      timeoutRate: 0,
      activeConnections: 0,
      peakConnections: 0,
      windowStartTime: now,
      lastResetTime: now,
    };
  }

  /**
   * Record a connection attempt
   */
  recordConnectionAttempt(socketId: string): void {
    this.metrics.totalConnectionAttempts++;
    this.connectionTimings.set(socketId, Date.now());

    logger.debug('[MetricsService] Connection attempt recorded', {
      socketId,
      totalAttempts: this.metrics.totalConnectionAttempts,
    });
  }

  /**
   * Record a successful connection
   */
  recordConnectionSuccess(socketId: string): void {
    const startTime = this.connectionTimings.get(socketId);
    if (startTime) {
      const connectionTime = Date.now() - startTime;
      this.updateConnectionTiming(connectionTime);
      this.connectionTimings.delete(socketId);
    }

    this.metrics.successfulConnections++;
    this.metrics.activeConnections++;

    // Update peak connections
    if (this.metrics.activeConnections > this.metrics.peakConnections) {
      this.metrics.peakConnections = this.metrics.activeConnections;
    }

    // Update success rate
    this.updateSuccessRate();

    logger.debug('[MetricsService] Connection success recorded', {
      socketId,
      successfulConnections: this.metrics.successfulConnections,
      successRate: this.metrics.connectionSuccessRate,
      activeConnections: this.metrics.activeConnections,
    });

    // Check for alerts
    this.checkAlerts();
  }

  /**
   * Record a connection failure
   */
  recordConnectionFailure(
    socketId: string,
    reason: 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'AUTH_EXPIRED' | 'SESSION_CREATE_FAILED'
  ): void {
    const startTime = this.connectionTimings.get(socketId);
    if (startTime) {
      const connectionTime = Date.now() - startTime;
      this.updateConnectionTiming(connectionTime);
      this.connectionTimings.delete(socketId);
    }

    this.metrics.failedConnections++;
    this.metrics.authFailures[reason]++;

    // Update success rate
    this.updateSuccessRate();

    logger.debug('[MetricsService] Connection failure recorded', {
      socketId,
      reason,
      failedConnections: this.metrics.failedConnections,
      successRate: this.metrics.connectionSuccessRate,
      authFailures: this.metrics.authFailures,
    });

    // Check for alerts
    this.checkAlerts();
  }

  /**
   * Record a connection timeout
   */
  recordConnectionTimeout(socketId: string): void {
    this.connectionTimings.delete(socketId);
    this.metrics.totalTimeouts++;

    // Update timeout rate
    if (this.metrics.totalConnectionAttempts > 0) {
      this.metrics.timeoutRate = this.metrics.totalTimeouts / this.metrics.totalConnectionAttempts;
    }

    logger.debug('[MetricsService] Connection timeout recorded', {
      socketId,
      totalTimeouts: this.metrics.totalTimeouts,
      timeoutRate: this.metrics.timeoutRate,
    });

    // Check for alerts
    this.checkAlerts();
  }

  /**
   * Record a disconnection
   */
  recordDisconnection(socketId: string): void {
    if (this.metrics.activeConnections > 0) {
      this.metrics.activeConnections--;
    }

    logger.debug('[MetricsService] Disconnection recorded', {
      socketId,
      activeConnections: this.metrics.activeConnections,
    });
  }

  /**
   * Update connection timing metrics
   */
  private updateConnectionTiming(connectionTime: number): void {
    this.metrics.totalConnectionTime += connectionTime;
    this.metrics.averageConnectionTime =
      this.metrics.totalConnectionTime /
      (this.metrics.successfulConnections + this.metrics.failedConnections);

    if (connectionTime < this.metrics.minConnectionTime) {
      this.metrics.minConnectionTime = connectionTime;
    }

    if (connectionTime > this.metrics.maxConnectionTime) {
      this.metrics.maxConnectionTime = connectionTime;
    }
  }

  /**
   * Update success rate
   */
  private updateSuccessRate(): void {
    const totalCompleted = this.metrics.successfulConnections + this.metrics.failedConnections;
    if (totalCompleted > 0) {
      this.metrics.connectionSuccessRate = this.metrics.successfulConnections / totalCompleted;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectionMetrics {
    // Recalculate timeout rate to ensure it's up to date
    if (this.metrics.totalConnectionAttempts > 0) {
      this.metrics.timeoutRate = this.metrics.totalTimeouts / this.metrics.totalConnectionAttempts;
    }

    return { ...this.metrics };
  }

  /**
   * Get metrics summary for logging/monitoring
   */
  getMetricsSummary(): Record<string, any> {
    return {
      connectionSuccessRate: this.metrics.connectionSuccessRate,
      totalConnectionAttempts: this.metrics.totalConnectionAttempts,
      successfulConnections: this.metrics.successfulConnections,
      failedConnections: this.metrics.failedConnections,
      averageConnectionTimeMs: Math.round(this.metrics.averageConnectionTime),
      minConnectionTimeMs:
        this.metrics.minConnectionTime === Infinity ? 0 : this.metrics.minConnectionTime,
      maxConnectionTimeMs: this.metrics.maxConnectionTime,
      timeoutRate: this.metrics.timeoutRate,
      totalTimeouts: this.metrics.totalTimeouts,
      activeConnections: this.metrics.activeConnections,
      peakConnections: this.metrics.peakConnections,
      authFailures: this.metrics.authFailures,
      uptimeSeconds: Math.floor((Date.now() - this.metrics.windowStartTime) / 1000),
    };
  }

  /**
   * Check alert thresholds and log warnings
   */
  private checkAlerts(): void {
    const alerts = this.getAlertStatus();

    if (alerts.alerts.length > 0) {
      logger.warn('[MetricsService] Alert thresholds exceeded', {
        alerts: alerts.alerts,
        metrics: this.getMetricsSummary(),
      });
    }
  }

  /**
   * Get alert status
   */
  getAlertStatus(): AlertStatus {
    const alerts: string[] = [];
    let successRateAlert = false;
    let connectionTimeAlert = false;
    let timeoutRateAlert = false;

    // Check success rate (only if we have enough data)
    if (this.metrics.totalConnectionAttempts >= 10) {
      if (this.metrics.connectionSuccessRate < this.thresholds.minSuccessRate) {
        successRateAlert = true;
        alerts.push(
          `Connection success rate (${(this.metrics.connectionSuccessRate * 100).toFixed(1)}%) is below threshold (${(this.thresholds.minSuccessRate * 100).toFixed(1)}%)`
        );
      }
    }

    // Check average connection time (only if we have data)
    if (
      this.metrics.averageConnectionTime > 0 &&
      this.metrics.averageConnectionTime > this.thresholds.maxAverageConnectionTime
    ) {
      connectionTimeAlert = true;
      alerts.push(
        `Average connection time (${Math.round(this.metrics.averageConnectionTime)}ms) exceeds threshold (${this.thresholds.maxAverageConnectionTime}ms)`
      );
    }

    // Check timeout rate (only if we have enough data)
    if (this.metrics.totalConnectionAttempts >= 10) {
      if (this.metrics.timeoutRate > this.thresholds.maxTimeoutRate) {
        timeoutRateAlert = true;
        alerts.push(
          `Timeout rate (${(this.metrics.timeoutRate * 100).toFixed(1)}%) exceeds threshold (${(this.thresholds.maxTimeoutRate * 100).toFixed(1)}%)`
        );
      }
    }

    return {
      successRateAlert,
      connectionTimeAlert,
      timeoutRateAlert,
      alerts,
    };
  }

  /**
   * Set alert thresholds
   */
  setAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };

    logger.info('[MetricsService] Alert thresholds updated', {
      thresholds: this.thresholds,
    });
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.connectionTimings.clear();

    logger.info('[MetricsService] Metrics reset', {
      resetTime: new Date().toISOString(),
    });
  }

  /**
   * Log metrics summary periodically
   */
  private logMetricsSummary(): void {
    const summary = this.getMetricsSummary();
    const alerts = this.getAlertStatus();

    logger.info('[MetricsService] Periodic metrics summary', {
      ...summary,
      hasAlerts: alerts.alerts.length > 0,
      alerts: alerts.alerts,
    });
  }

  /**
   * Set active connections count (for external updates)
   */
  setActiveConnections(count: number): void {
    this.metrics.activeConnections = count;

    if (count > this.metrics.peakConnections) {
      this.metrics.peakConnections = count;
    }
  }

  /**
   * Cleanup resources (for graceful shutdown)
   */
  cleanup(): void {
    if (this.metricsLogInterval) {
      clearInterval(this.metricsLogInterval);
      this.metricsLogInterval = undefined;
    }
  }
}
