export interface ServiceEndpoint {
  serviceId: string;
  serviceName: string;
  host: string;
  port: number;
  protocol: 'grpc' | 'http' | 'https';
  healthCheckUrl?: string;
  metadata?: Record<string, string>;
  registeredAt: Date;
  lastHealthCheck?: Date;
  healthy: boolean;
}

export interface ServiceRegistryConfig {
  healthCheckIntervalMs: number;
  unhealthyThreshold: number;
}

export class ServiceRegistry {
  private services: Map<string, ServiceEndpoint[]> = new Map();
  private config: ServiceRegistryConfig;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: ServiceRegistryConfig) {
    this.config = config;
  }

  /**
   * Register a service endpoint
   */
  register(endpoint: Omit<ServiceEndpoint, 'registeredAt' | 'lastHealthCheck' | 'healthy'>): void {
    const fullEndpoint: ServiceEndpoint = {
      ...endpoint,
      registeredAt: new Date(),
      healthy: true,
    };

    const existing = this.services.get(endpoint.serviceName) || [];
    
    // Check if this exact endpoint already exists
    const existingIndex = existing.findIndex(
      e => e.host === endpoint.host && e.port === endpoint.port
    );

    if (existingIndex >= 0) {
      // Update existing endpoint
      existing[existingIndex] = fullEndpoint;
    } else {
      // Add new endpoint
      existing.push(fullEndpoint);
    }

    this.services.set(endpoint.serviceName, existing);
  }

  /**
   * Unregister a service endpoint
   */
  unregister(serviceName: string, host: string, port: number): void {
    const endpoints = this.services.get(serviceName);
    if (!endpoints) return;

    const filtered = endpoints.filter(
      e => !(e.host === host && e.port === port)
    );

    if (filtered.length === 0) {
      this.services.delete(serviceName);
    } else {
      this.services.set(serviceName, filtered);
    }
  }

  /**
   * Get all healthy endpoints for a service
   */
  getEndpoints(serviceName: string): ServiceEndpoint[] {
    const endpoints = this.services.get(serviceName) || [];
    return endpoints.filter(e => e.healthy);
  }

  /**
   * Get a single endpoint using round-robin
   */
  getEndpoint(serviceName: string): ServiceEndpoint | null {
    const endpoints = this.getEndpoints(serviceName);
    if (endpoints.length === 0) return null;

    // Simple round-robin: rotate the array
    const endpoint = endpoints[0];
    endpoints.push(endpoints.shift()!);
    this.services.set(serviceName, endpoints);

    return endpoint;
  }

  /**
   * Get endpoint address for gRPC client
   */
  getGrpcAddress(serviceName: string): string | null {
    const endpoint = this.getEndpoint(serviceName);
    if (!endpoint) return null;
    return `${endpoint.host}:${endpoint.port}`;
  }

  /**
   * Mark an endpoint as unhealthy
   */
  markUnhealthy(serviceName: string, host: string, port: number): void {
    const endpoints = this.services.get(serviceName);
    if (!endpoints) return;

    const endpoint = endpoints.find(e => e.host === host && e.port === port);
    if (endpoint) {
      endpoint.healthy = false;
      endpoint.lastHealthCheck = new Date();
    }
  }

  /**
   * Mark an endpoint as healthy
   */
  markHealthy(serviceName: string, host: string, port: number): void {
    const endpoints = this.services.get(serviceName);
    if (!endpoints) return;

    const endpoint = endpoints.find(e => e.host === host && e.port === port);
    if (endpoint) {
      endpoint.healthy = true;
      endpoint.lastHealthCheck = new Date();
    }
  }

  /**
   * Get all registered services
   */
  getAllServices(): Map<string, ServiceEndpoint[]> {
    return new Map(this.services);
  }

  /**
   * Start health check monitoring
   */
  startHealthChecks(healthCheckFn: (endpoint: ServiceEndpoint) => Promise<boolean>): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const [serviceName, endpoints] of this.services.entries()) {
        for (const endpoint of endpoints) {
          try {
            const isHealthy = await healthCheckFn(endpoint);
            if (isHealthy) {
              this.markHealthy(serviceName, endpoint.host, endpoint.port);
            } else {
              this.markUnhealthy(serviceName, endpoint.host, endpoint.port);
            }
          } catch (error) {
            this.markUnhealthy(serviceName, endpoint.host, endpoint.port);
          }
        }
      }
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Stop health check monitoring
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Clear all registered services
   */
  clear(): void {
    this.services.clear();
  }
}
