/**
 * Health Check Types
 * Defines types for service health monitoring and readiness checks
 */

/**
 * Health status values
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health status
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  lastChecked: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  components?: Record<string, ComponentHealth>;
}

/**
 * Readiness check response
 */
export interface ReadinessCheckResponse {
  ready: boolean;
  service: string;
  timestamp: string;
  checks: Record<
    string,
    {
      ready: boolean;
      message?: string;
    }
  >;
}

/**
 * Dependency types for health checks
 */
export type DependencyType =
  | 'database'
  | 'cache'
  | 'storage'
  | 'external_api'
  | 'message_queue'
  | 'service';

/**
 * Dependency health check configuration
 */
export interface DependencyConfig {
  name: string;
  type: DependencyType;
  required: boolean;
  timeoutMs: number;
  checkFn: () => Promise<boolean>;
}

/**
 * Health check result for a single dependency
 */
export interface DependencyHealthResult {
  name: string;
  type: DependencyType;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}
