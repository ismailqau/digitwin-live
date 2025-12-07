import { MetricsService } from '../application/services/MetricsService';

describe('MetricsService', () => {
  let metricsService: MetricsService;
  let originalDateNow: () => number;
  let mockTime: number;

  beforeEach(() => {
    // Mock Date.now() for timing tests
    mockTime = Date.now();
    originalDateNow = Date.now;
    Date.now = jest.fn(() => mockTime);

    metricsService = new MetricsService();
  });

  afterEach(() => {
    // Restore Date.now()
    Date.now = originalDateNow;
  });

  describe('Connection Attempt Tracking', () => {
    it('should record connection attempts', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionAttempt('socket-2');

      const metrics = metricsService.getMetrics();
      expect(metrics.totalConnectionAttempts).toBe(2);
    });
  });

  describe('Connection Success Tracking', () => {
    it('should record successful connections', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionSuccess('socket-1');

      const metrics = metricsService.getMetrics();
      expect(metrics.successfulConnections).toBe(1);
      expect(metrics.activeConnections).toBe(1);
      expect(metrics.connectionSuccessRate).toBe(1.0);
    });

    it('should track peak connections', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionSuccess('socket-1');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionSuccess('socket-2');

      const metrics = metricsService.getMetrics();
      expect(metrics.activeConnections).toBe(2);
      expect(metrics.peakConnections).toBe(2);

      metricsService.recordDisconnection('socket-1');
      const metricsAfterDisconnect = metricsService.getMetrics();
      expect(metricsAfterDisconnect.activeConnections).toBe(1);
      expect(metricsAfterDisconnect.peakConnections).toBe(2); // Peak should remain
    });

    it('should calculate average connection time', () => {
      metricsService.recordConnectionAttempt('socket-1');
      // Simulate 100ms connection time
      mockTime += 100;
      metricsService.recordConnectionSuccess('socket-1');

      const metrics = metricsService.getMetrics();
      expect(metrics.averageConnectionTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Connection Failure Tracking', () => {
    it('should record AUTH_REQUIRED failures', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionFailure('socket-1', 'AUTH_REQUIRED');

      const metrics = metricsService.getMetrics();
      expect(metrics.failedConnections).toBe(1);
      expect(metrics.authFailures.AUTH_REQUIRED).toBe(1);
      expect(metrics.connectionSuccessRate).toBe(0);
    });

    it('should record AUTH_INVALID failures', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionFailure('socket-1', 'AUTH_INVALID');

      const metrics = metricsService.getMetrics();
      expect(metrics.authFailures.AUTH_INVALID).toBe(1);
    });

    it('should record AUTH_EXPIRED failures', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionFailure('socket-1', 'AUTH_EXPIRED');

      const metrics = metricsService.getMetrics();
      expect(metrics.authFailures.AUTH_EXPIRED).toBe(1);
    });

    it('should record SESSION_CREATE_FAILED failures', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionFailure('socket-1', 'SESSION_CREATE_FAILED');

      const metrics = metricsService.getMetrics();
      expect(metrics.authFailures.SESSION_CREATE_FAILED).toBe(1);
    });

    it('should track multiple failure types', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionFailure('socket-1', 'AUTH_REQUIRED');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionFailure('socket-2', 'AUTH_INVALID');
      metricsService.recordConnectionAttempt('socket-3');
      metricsService.recordConnectionFailure('socket-3', 'AUTH_EXPIRED');

      const metrics = metricsService.getMetrics();
      expect(metrics.failedConnections).toBe(3);
      expect(metrics.authFailures.AUTH_REQUIRED).toBe(1);
      expect(metrics.authFailures.AUTH_INVALID).toBe(1);
      expect(metrics.authFailures.AUTH_EXPIRED).toBe(1);
    });
  });

  describe('Connection Success Rate', () => {
    it('should calculate success rate correctly with mixed results', () => {
      // 3 successes, 1 failure = 75% success rate
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionSuccess('socket-1');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionSuccess('socket-2');
      metricsService.recordConnectionAttempt('socket-3');
      metricsService.recordConnectionSuccess('socket-3');
      metricsService.recordConnectionAttempt('socket-4');
      metricsService.recordConnectionFailure('socket-4', 'AUTH_INVALID');

      const metrics = metricsService.getMetrics();
      expect(metrics.connectionSuccessRate).toBe(0.75);
    });

    it('should handle 100% success rate', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionSuccess('socket-1');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionSuccess('socket-2');

      const metrics = metricsService.getMetrics();
      expect(metrics.connectionSuccessRate).toBe(1.0);
    });

    it('should handle 0% success rate', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionFailure('socket-1', 'AUTH_INVALID');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionFailure('socket-2', 'AUTH_REQUIRED');

      const metrics = metricsService.getMetrics();
      expect(metrics.connectionSuccessRate).toBe(0);
    });
  });

  describe('Timeout Tracking', () => {
    it('should record connection timeouts', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionTimeout('socket-1');

      const metrics = metricsService.getMetrics();
      expect(metrics.totalTimeouts).toBe(1);
    });

    it('should calculate timeout rate', () => {
      // 1 timeout out of 3 attempts = 33.33% timeout rate
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionTimeout('socket-1');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionSuccess('socket-2');
      metricsService.recordConnectionAttempt('socket-3');
      metricsService.recordConnectionSuccess('socket-3');

      const metrics = metricsService.getMetrics();
      expect(metrics.totalTimeouts).toBe(1);
      expect(metrics.totalConnectionAttempts).toBe(3);
      expect(metrics.timeoutRate).toBeCloseTo(0.333, 2);
    });
  });

  describe('Alert Thresholds', () => {
    it('should trigger success rate alert when below threshold', () => {
      // Set threshold to 95%
      metricsService.setAlertThresholds({ minSuccessRate: 0.95 });

      // Create 10 connections with 90% success rate (below threshold)
      for (let i = 0; i < 9; i++) {
        metricsService.recordConnectionAttempt(`socket-${i}`);
        metricsService.recordConnectionSuccess(`socket-${i}`);
      }
      metricsService.recordConnectionAttempt('socket-9');
      metricsService.recordConnectionFailure('socket-9', 'AUTH_INVALID');

      const alerts = metricsService.getAlertStatus();
      expect(alerts.successRateAlert).toBe(true);
      expect(alerts.alerts.length).toBeGreaterThan(0);
      expect(alerts.alerts[0]).toContain('success rate');
    });

    it('should not trigger success rate alert when above threshold', () => {
      metricsService.setAlertThresholds({ minSuccessRate: 0.95 });

      // Create 10 connections with 100% success rate
      for (let i = 0; i < 10; i++) {
        metricsService.recordConnectionAttempt(`socket-${i}`);
        metricsService.recordConnectionSuccess(`socket-${i}`);
      }

      const alerts = metricsService.getAlertStatus();
      expect(alerts.successRateAlert).toBe(false);
    });

    it('should trigger connection time alert when exceeding threshold', () => {
      metricsService.setAlertThresholds({ maxAverageConnectionTime: 1000 });

      // Simulate slow connections
      metricsService.recordConnectionAttempt('socket-1');
      mockTime += 2000; // 2 seconds
      metricsService.recordConnectionSuccess('socket-1');

      const alerts = metricsService.getAlertStatus();
      expect(alerts.connectionTimeAlert).toBe(true);
      expect(alerts.alerts.some((a) => a.includes('connection time'))).toBe(true);
    });

    it('should trigger timeout rate alert when exceeding threshold', () => {
      metricsService.setAlertThresholds({ maxTimeoutRate: 0.05 });

      // Create 10 connections with 20% timeout rate (above 5% threshold)
      for (let i = 0; i < 8; i++) {
        metricsService.recordConnectionAttempt(`socket-${i}`);
        metricsService.recordConnectionSuccess(`socket-${i}`);
      }
      metricsService.recordConnectionAttempt('socket-8');
      metricsService.recordConnectionTimeout('socket-8');
      metricsService.recordConnectionAttempt('socket-9');
      metricsService.recordConnectionTimeout('socket-9');

      const alerts = metricsService.getAlertStatus();
      expect(alerts.timeoutRateAlert).toBe(true);
      expect(alerts.alerts.some((a) => a.includes('Timeout rate'))).toBe(true);
    });

    it('should not trigger alerts with insufficient data', () => {
      metricsService.setAlertThresholds({ minSuccessRate: 0.95 });

      // Only 5 connections (below minimum of 10 for alerts)
      for (let i = 0; i < 5; i++) {
        metricsService.recordConnectionAttempt(`socket-${i}`);
        metricsService.recordConnectionFailure(`socket-${i}`, 'AUTH_INVALID');
      }

      const alerts = metricsService.getAlertStatus();
      expect(alerts.successRateAlert).toBe(false);
    });
  });

  describe('Metrics Summary', () => {
    it('should provide comprehensive metrics summary', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionSuccess('socket-1');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionFailure('socket-2', 'AUTH_INVALID');

      const summary = metricsService.getMetricsSummary();

      expect(summary).toHaveProperty('connectionSuccessRate');
      expect(summary).toHaveProperty('totalConnectionAttempts');
      expect(summary).toHaveProperty('successfulConnections');
      expect(summary).toHaveProperty('failedConnections');
      expect(summary).toHaveProperty('averageConnectionTimeMs');
      expect(summary).toHaveProperty('authFailures');
      expect(summary).toHaveProperty('activeConnections');
      expect(summary).toHaveProperty('peakConnections');
      expect(summary).toHaveProperty('uptimeSeconds');
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionSuccess('socket-1');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionFailure('socket-2', 'AUTH_INVALID');

      metricsService.resetMetrics();

      const metrics = metricsService.getMetrics();
      expect(metrics.totalConnectionAttempts).toBe(0);
      expect(metrics.successfulConnections).toBe(0);
      expect(metrics.failedConnections).toBe(0);
      expect(metrics.activeConnections).toBe(0);
    });
  });

  describe('Active Connections', () => {
    it('should set active connections count', () => {
      metricsService.setActiveConnections(5);

      const metrics = metricsService.getMetrics();
      expect(metrics.activeConnections).toBe(5);
      expect(metrics.peakConnections).toBe(5);
    });

    it('should update peak connections when setting higher count', () => {
      metricsService.setActiveConnections(5);
      metricsService.setActiveConnections(10);

      const metrics = metricsService.getMetrics();
      expect(metrics.activeConnections).toBe(10);
      expect(metrics.peakConnections).toBe(10);
    });

    it('should not update peak connections when setting lower count', () => {
      metricsService.setActiveConnections(10);
      metricsService.setActiveConnections(5);

      const metrics = metricsService.getMetrics();
      expect(metrics.activeConnections).toBe(5);
      expect(metrics.peakConnections).toBe(10);
    });
  });

  describe('Disconnection Tracking', () => {
    it('should decrement active connections on disconnection', () => {
      metricsService.recordConnectionAttempt('socket-1');
      metricsService.recordConnectionSuccess('socket-1');
      metricsService.recordConnectionAttempt('socket-2');
      metricsService.recordConnectionSuccess('socket-2');

      expect(metricsService.getMetrics().activeConnections).toBe(2);

      metricsService.recordDisconnection('socket-1');

      expect(metricsService.getMetrics().activeConnections).toBe(1);
    });

    it('should not go below zero active connections', () => {
      metricsService.recordDisconnection('socket-1');
      metricsService.recordDisconnection('socket-2');

      const metrics = metricsService.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });
  });
});
