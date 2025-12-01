/**
 * Health Service
 * Provides health check and readiness check functionality for API Gateway
 */

import { DatabaseConnection } from '@clone/database';
import type {
  HealthCheckResponse,
  ReadinessCheckResponse,
  ComponentHealth,
  HealthStatus,
  DependencyConfig,
  DependencyHealthResult,
} from '@clone/shared-types';

const SERVICE_NAME = 'api-gateway';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const startTime = Date.now();

/**
 * Health Service class for managing health checks
 */
export class HealthService {
  private dependencies: DependencyConfig[] = [];

  constructor() {
    this.setupDefaultDependencies();
  }

  /**
   * Setup default dependency checks
   */
  private setupDefaultDependencies(): void {
    // Database check
    this.dependencies.push({
      name: 'database',
      type: 'database',
      required: true,
      timeoutMs: 5000,
      checkFn: async () => {
        return await DatabaseConnection.healthCheck();
      },
    });
  }

  /**
   * Add a custom dependency check
   */
  addDependency(config: DependencyConfig): void {
    this.dependencies.push(config);
  }

  /**
   * Check a single dependency with timeout
   */
  private async checkDependency(config: DependencyConfig): Promise<DependencyHealthResult> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), config.timeoutMs);
      });

      const healthy = await Promise.race([config.checkFn(), timeoutPromise]);
      const latencyMs = Date.now() - startTime;

      return {
        name: config.name,
        type: config.type,
        healthy,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        name: config.name,
        type: config.type,
        healthy: false,
        latencyMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check all dependencies
   */
  private async checkAllDependencies(): Promise<DependencyHealthResult[]> {
    const results = await Promise.all(this.dependencies.map((dep) => this.checkDependency(dep)));
    return results;
  }

  /**
   * Determine overall health status from dependency results
   */
  private determineOverallStatus(results: DependencyHealthResult[]): HealthStatus {
    const requiredDeps = this.dependencies.filter((d) => d.required);
    const requiredResults = results.filter((r) => requiredDeps.some((d) => d.name === r.name));

    // If any required dependency is unhealthy, status is unhealthy
    const allRequiredHealthy = requiredResults.every((r) => r.healthy);
    if (!allRequiredHealthy) {
      return 'unhealthy';
    }

    // If any optional dependency is unhealthy, status is degraded
    const allHealthy = results.every((r) => r.healthy);
    if (!allHealthy) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Convert dependency results to component health map
   */
  private toComponentHealth(results: DependencyHealthResult[]): Record<string, ComponentHealth> {
    const components: Record<string, ComponentHealth> = {};

    for (const result of results) {
      components[result.name] = {
        name: result.name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        latencyMs: result.latencyMs,
        message: result.error,
        lastChecked: new Date().toISOString(),
      };
    }

    return components;
  }

  /**
   * Basic liveness check - is the service running?
   */
  async getLivenessCheck(): Promise<HealthCheckResponse> {
    return {
      status: 'healthy',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
  }

  /**
   * Full health check with dependency status
   */
  async getHealthCheck(): Promise<HealthCheckResponse> {
    const results = await this.checkAllDependencies();
    const status = this.determineOverallStatus(results);
    const components = this.toComponentHealth(results);

    return {
      status,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      components,
    };
  }

  /**
   * Readiness check - is the service ready to accept traffic?
   */
  async getReadinessCheck(): Promise<ReadinessCheckResponse> {
    const results = await this.checkAllDependencies();
    const requiredDeps = this.dependencies.filter((d) => d.required);

    const checks: Record<string, { ready: boolean; message?: string }> = {};

    for (const result of results) {
      checks[result.name] = {
        ready: result.healthy,
        message: result.error || (result.healthy ? 'OK' : 'Unhealthy'),
      };
    }

    // Service is ready only if all required dependencies are healthy
    const ready = results
      .filter((r) => requiredDeps.some((d) => d.name === r.name))
      .every((r) => r.healthy);

    return {
      ready,
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

// Singleton instance
let healthServiceInstance: HealthService | null = null;

/**
 * Get the health service singleton
 */
export function getHealthService(): HealthService {
  if (!healthServiceInstance) {
    healthServiceInstance = new HealthService();
  }
  return healthServiceInstance;
}

/**
 * Add external API health check
 */
export function addExternalApiCheck(
  name: string,
  checkFn: () => Promise<boolean>,
  required = false,
  timeoutMs = 5000
): void {
  const service = getHealthService();
  service.addDependency({
    name,
    type: 'external_api',
    required,
    timeoutMs,
    checkFn,
  });
}

/**
 * Add storage health check
 */
export function addStorageCheck(
  name: string,
  checkFn: () => Promise<boolean>,
  required = true,
  timeoutMs = 5000
): void {
  const service = getHealthService();
  service.addDependency({
    name,
    type: 'storage',
    required,
    timeoutMs,
    checkFn,
  });
}
