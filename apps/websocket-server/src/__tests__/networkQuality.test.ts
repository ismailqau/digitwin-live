/**
 * Tests for NetworkQualityMonitor
 */

import { NetworkQualityMonitor, NetworkQuality, VideoQuality } from '../utils/networkQuality';

describe('NetworkQualityMonitor', () => {
  let monitor: NetworkQualityMonitor;

  beforeEach(() => {
    monitor = new NetworkQualityMonitor();
    jest.useFakeTimers();
  });

  afterEach(() => {
    monitor.stopMonitoring();
    jest.useRealTimers();
  });

  describe('startMonitoring', () => {
    it('should start monitoring with ping callback', () => {
      const pingCallback = jest.fn();

      monitor.startMonitoring(pingCallback, 5000);

      // Fast-forward time
      jest.advanceTimersByTime(5000);
      expect(pingCallback).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5000);
      expect(pingCallback).toHaveBeenCalledTimes(2);
    });

    it('should stop monitoring when stopMonitoring is called', () => {
      const pingCallback = jest.fn();

      monitor.startMonitoring(pingCallback, 5000);
      monitor.stopMonitoring();

      jest.advanceTimersByTime(10000);
      expect(pingCallback).not.toHaveBeenCalled();
    });
  });

  describe('recordPong', () => {
    it('should calculate latency from ping/pong', () => {
      const pingCallback = jest.fn();
      monitor.startMonitoring(pingCallback, 5000);

      // Trigger ping
      jest.advanceTimersByTime(5000);

      // Simulate pong after 50ms
      jest.advanceTimersByTime(50);
      monitor.recordPong();

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics!.latency).toBeGreaterThan(0);
    });
  });

  describe('updateMetrics', () => {
    it('should update network metrics', () => {
      monitor.updateMetrics({
        bandwidth: 5000,
        latency: 30,
        packetLoss: 0.5,
        jitter: 5,
      });

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toEqual({
        bandwidth: 5000,
        latency: 30,
        packetLoss: 0.5,
        jitter: 5,
        timestamp: expect.any(Number),
      });
    });

    it('should keep only recent metrics (max 10)', () => {
      for (let i = 0; i < 15; i++) {
        monitor.updateMetrics({ bandwidth: i * 100, latency: i * 10 });
      }

      const history = monitor.getMetricsHistory();
      expect(history.length).toBe(10);
    });
  });

  describe('estimateBandwidth', () => {
    it('should calculate bandwidth from data transfer', () => {
      const bytesTransferred = 100000; // 100 KB
      const durationMs = 1000; // 1 second

      const bandwidth = monitor.estimateBandwidth(bytesTransferred, durationMs);

      // 100 KB in 1 second = 800 Kbps
      expect(bandwidth).toBe(800);
    });

    it('should handle zero duration', () => {
      const bandwidth = monitor.estimateBandwidth(100000, 0);
      expect(bandwidth).toBe(0);
    });
  });

  describe('getNetworkQuality', () => {
    it('should return EXCELLENT for high bandwidth and low latency', () => {
      monitor.updateMetrics({
        bandwidth: 6000,
        latency: 30,
        packetLoss: 0,
      });

      const quality = monitor.getNetworkQuality();
      expect(quality).toBe(NetworkQuality.EXCELLENT);
    });

    it('should return GOOD for decent bandwidth and acceptable latency', () => {
      monitor.updateMetrics({
        bandwidth: 2000,
        latency: 100,
        packetLoss: 1,
      });

      const quality = monitor.getNetworkQuality();
      expect(quality).toBe(NetworkQuality.GOOD);
    });

    it('should return FAIR for limited bandwidth', () => {
      monitor.updateMetrics({
        bandwidth: 700,
        latency: 200,
        packetLoss: 3,
      });

      const quality = monitor.getNetworkQuality();
      expect(quality).toBe(NetworkQuality.FAIR);
    });

    it('should return POOR for low bandwidth or high latency', () => {
      monitor.updateMetrics({
        bandwidth: 300,
        latency: 400,
        packetLoss: 8,
      });

      const quality = monitor.getNetworkQuality();
      expect(quality).toBe(NetworkQuality.POOR);
    });
  });

  describe('getRecommendedSettings', () => {
    it('should recommend HIGH quality for excellent network', () => {
      monitor.updateMetrics({
        bandwidth: 6000,
        latency: 30,
        packetLoss: 0,
      });

      const settings = monitor.getRecommendedSettings();

      expect(settings).toEqual({
        videoQuality: VideoQuality.HIGH,
        audioQuality: 'high',
        compressionLevel: 4,
        bufferSize: 200,
      });
    });

    it('should recommend MEDIUM quality for good network', () => {
      monitor.updateMetrics({
        bandwidth: 2000,
        latency: 100,
        packetLoss: 1,
      });

      const settings = monitor.getRecommendedSettings();

      expect(settings).toEqual({
        videoQuality: VideoQuality.MEDIUM,
        audioQuality: 'high',
        compressionLevel: 6,
        bufferSize: 500,
      });
    });

    it('should recommend LOW quality for fair network', () => {
      monitor.updateMetrics({
        bandwidth: 700,
        latency: 200,
        packetLoss: 3,
      });

      const settings = monitor.getRecommendedSettings();

      expect(settings).toEqual({
        videoQuality: VideoQuality.LOW,
        audioQuality: 'medium',
        compressionLevel: 7,
        bufferSize: 1000,
      });
    });

    it('should recommend audio-only for poor network', () => {
      monitor.updateMetrics({
        bandwidth: 300,
        latency: 400,
        packetLoss: 8,
      });

      const settings = monitor.getRecommendedSettings();

      expect(settings).toEqual({
        videoQuality: VideoQuality.OFF,
        audioQuality: 'low',
        compressionLevel: 9,
        bufferSize: 2000,
      });
    });
  });

  describe('getMetricsHistory', () => {
    it('should return copy of metrics history', () => {
      monitor.updateMetrics({ bandwidth: 1000, latency: 50 });
      monitor.updateMetrics({ bandwidth: 2000, latency: 60 });

      const history = monitor.getMetricsHistory();

      expect(history.length).toBe(2);
      expect(history[0].bandwidth).toBe(1000);
      expect(history[1].bandwidth).toBe(2000);

      // Verify it's a copy
      history.push({
        bandwidth: 3000,
        latency: 70,
        packetLoss: 0,
        jitter: 0,
        timestamp: Date.now(),
      });

      expect(monitor.getMetricsHistory().length).toBe(2);
    });
  });
});
