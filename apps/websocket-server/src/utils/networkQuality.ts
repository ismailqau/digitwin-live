/**
 * Network quality detection and adaptive quality management
 * Monitors connection quality and adjusts streaming parameters
 */

import { logger } from '@clone/logger';

export enum NetworkQuality {
  EXCELLENT = 'excellent', // > 5 Mbps, < 50ms latency
  GOOD = 'good', // 1-5 Mbps, 50-150ms latency
  FAIR = 'fair', // 500 Kbps - 1 Mbps, 150-300ms latency
  POOR = 'poor', // < 500 Kbps, > 300ms latency
}

export enum VideoQuality {
  HIGH = 'high', // 512x512, 20 FPS
  MEDIUM = 'medium', // 256x256, 15 FPS
  LOW = 'low', // 128x128, 10 FPS
  OFF = 'off', // Audio only
}

export interface NetworkMetrics {
  bandwidth: number; // Estimated bandwidth in Kbps
  latency: number; // Round-trip time in ms
  packetLoss: number; // Packet loss percentage (0-100)
  jitter: number; // Jitter in ms
  timestamp: number;
}

export interface QualitySettings {
  videoQuality: VideoQuality;
  audioQuality: 'high' | 'medium' | 'low';
  compressionLevel: number; // 0-9
  bufferSize: number; // Buffer size in ms
}

export class NetworkQualityMonitor {
  private metrics: NetworkMetrics[] = [];
  private maxMetricsHistory = 10;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;

  /**
   * Start monitoring network quality
   */
  startMonitoring(pingCallback: () => void, intervalMs: number = 10000): void {
    this.pingInterval = setInterval(() => {
      this.lastPingTime = Date.now();
      pingCallback();
    }, intervalMs);

    logger.info('Network quality monitoring started', { intervalMs });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    logger.info('Network quality monitoring stopped');
  }

  /**
   * Record pong response (for latency calculation)
   */
  recordPong(): void {
    if (this.lastPingTime === 0) {
      return;
    }

    const latency = Date.now() - this.lastPingTime;
    this.updateMetrics({ latency });
  }

  /**
   * Update network metrics
   */
  updateMetrics(partial: Partial<NetworkMetrics>): void {
    const metrics: NetworkMetrics = {
      bandwidth: partial.bandwidth || this.getAverageBandwidth(),
      latency: partial.latency || this.getAverageLatency(),
      packetLoss: partial.packetLoss || 0,
      jitter: partial.jitter || 0,
      timestamp: Date.now(),
    };

    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    logger.debug('Network metrics updated', metrics);
  }

  /**
   * Estimate bandwidth from data transfer
   */
  estimateBandwidth(bytesTransferred: number, durationMs: number): number {
    if (durationMs === 0) {
      return 0;
    }

    // Convert to Kbps
    const bandwidth = (bytesTransferred * 8) / (durationMs / 1000) / 1000;
    this.updateMetrics({ bandwidth });
    return bandwidth;
  }

  /**
   * Get current network quality
   */
  getNetworkQuality(): NetworkQuality {
    const avgBandwidth = this.getAverageBandwidth();
    const avgLatency = this.getAverageLatency();
    const avgPacketLoss = this.getAveragePacketLoss();

    // Excellent: High bandwidth, low latency, no packet loss
    if (avgBandwidth > 5000 && avgLatency < 50 && avgPacketLoss < 1) {
      return NetworkQuality.EXCELLENT;
    }

    // Good: Decent bandwidth, acceptable latency
    if (avgBandwidth > 1000 && avgLatency < 150 && avgPacketLoss < 3) {
      return NetworkQuality.GOOD;
    }

    // Fair: Limited bandwidth or higher latency
    if (avgBandwidth > 500 && avgLatency < 300 && avgPacketLoss < 5) {
      return NetworkQuality.FAIR;
    }

    // Poor: Low bandwidth or high latency
    return NetworkQuality.POOR;
  }

  /**
   * Get recommended quality settings based on network quality
   */
  getRecommendedSettings(): QualitySettings {
    const quality = this.getNetworkQuality();

    switch (quality) {
      case NetworkQuality.EXCELLENT:
        return {
          videoQuality: VideoQuality.HIGH,
          audioQuality: 'high',
          compressionLevel: 4,
          bufferSize: 200,
        };

      case NetworkQuality.GOOD:
        return {
          videoQuality: VideoQuality.MEDIUM,
          audioQuality: 'high',
          compressionLevel: 6,
          bufferSize: 500,
        };

      case NetworkQuality.FAIR:
        return {
          videoQuality: VideoQuality.LOW,
          audioQuality: 'medium',
          compressionLevel: 7,
          bufferSize: 1000,
        };

      case NetworkQuality.POOR:
        return {
          videoQuality: VideoQuality.OFF,
          audioQuality: 'low',
          compressionLevel: 9,
          bufferSize: 2000,
        };
    }
  }

  /**
   * Get average bandwidth from recent metrics
   */
  private getAverageBandwidth(): number {
    if (this.metrics.length === 0) {
      return 0;
    }

    const sum = this.metrics.reduce((acc, m) => acc + m.bandwidth, 0);
    return sum / this.metrics.length;
  }

  /**
   * Get average latency from recent metrics
   */
  private getAverageLatency(): number {
    if (this.metrics.length === 0) {
      return 0;
    }

    const sum = this.metrics.reduce((acc, m) => acc + m.latency, 0);
    return sum / this.metrics.length;
  }

  /**
   * Get average packet loss from recent metrics
   */
  private getAveragePacketLoss(): number {
    if (this.metrics.length === 0) {
      return 0;
    }

    const sum = this.metrics.reduce((acc, m) => acc + m.packetLoss, 0);
    return sum / this.metrics.length;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): NetworkMetrics | null {
    if (this.metrics.length === 0) {
      return null;
    }

    return this.metrics[this.metrics.length - 1];
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): NetworkMetrics[] {
    return [...this.metrics];
  }
}
