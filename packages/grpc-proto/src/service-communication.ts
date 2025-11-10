/**
 * Service Communication Manager
 *
 * High-level API for inter-service communication with built-in
 * authentication, service discovery, retry, and circuit breaker support
 */

import { ServiceAuthManager } from '@clone/service-auth';
import { ServiceRegistry, ServiceEndpoint } from '@clone/service-discovery';
import { CircuitBreaker, RetryPolicy, ServiceError, ServiceErrorCode } from '@clone/service-errors';

import { GrpcClientFactory } from './client-factory';
import { ServiceConfig } from './types';

export interface ServiceCommunicationConfig {
  serviceId: string;
  serviceName: string;
  jwtSecret: string;
  tokenExpirySeconds?: number;
  healthCheckIntervalMs?: number;
  enableServiceDiscovery?: boolean;
}

export class ServiceCommunicationManager {
  private authManager: ServiceAuthManager;
  private serviceRegistry: ServiceRegistry;
  private clientFactory: GrpcClientFactory;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryPolicies: Map<string, RetryPolicy> = new Map();

  constructor(private config: ServiceCommunicationConfig) {
    // Initialize authentication manager
    this.authManager = new ServiceAuthManager({
      jwtSecret: config.jwtSecret,
      tokenExpirySeconds: config.tokenExpirySeconds || 3600,
    });

    // Initialize service registry
    this.serviceRegistry = new ServiceRegistry({
      healthCheckIntervalMs: config.healthCheckIntervalMs || 30000,
      unhealthyThreshold: 3,
    });

    // Initialize client factory
    this.clientFactory = new GrpcClientFactory({
      authManager: this.authManager,
      serviceRegistry: config.enableServiceDiscovery ? this.serviceRegistry : undefined,
      defaultTimeout: 30000,
      enableTLS: false,
    });
  }

  /**
   * Get authentication manager
   */
  getAuthManager(): ServiceAuthManager {
    return this.authManager;
  }

  /**
   * Get service registry
   */
  getServiceRegistry(): ServiceRegistry {
    return this.serviceRegistry;
  }

  /**
   * Get client factory
   */
  getClientFactory(): GrpcClientFactory {
    return this.clientFactory;
  }

  /**
   * Create ASR service client
   */
  createASRClient(config: ServiceConfig, permissions: string[] = ['asr:read']): any {
    return this.clientFactory.createClient('asr.proto', 'asr', 'ASRService', config, {
      serviceId: this.config.serviceId,
      serviceName: this.config.serviceName,
      permissions,
      enableAuth: true,
      enableRetry: true,
      enableCircuitBreaker: true,
    });
  }

  /**
   * Create LLM service client
   */
  createLLMClient(config: ServiceConfig, permissions: string[] = ['llm:read']): any {
    return this.clientFactory.createClient('llm.proto', 'llm', 'LLMService', config, {
      serviceId: this.config.serviceId,
      serviceName: this.config.serviceName,
      permissions,
      enableAuth: true,
      enableRetry: true,
      enableCircuitBreaker: true,
    });
  }

  /**
   * Create RAG service client
   */
  createRAGClient(config: ServiceConfig, permissions: string[] = ['rag:read', 'rag:write']): any {
    return this.clientFactory.createClient('rag.proto', 'rag', 'RAGService', config, {
      serviceId: this.config.serviceId,
      serviceName: this.config.serviceName,
      permissions,
      enableAuth: true,
      enableRetry: true,
      enableCircuitBreaker: true,
    });
  }

  /**
   * Create TTS service client
   */
  createTTSClient(config: ServiceConfig, permissions: string[] = ['tts:read']): any {
    return this.clientFactory.createClient('tts.proto', 'tts', 'TTSService', config, {
      serviceId: this.config.serviceId,
      serviceName: this.config.serviceName,
      permissions,
      enableAuth: true,
      enableRetry: true,
      enableCircuitBreaker: true,
    });
  }

  /**
   * Create Lip-sync service client
   */
  createLipSyncClient(config: ServiceConfig, permissions: string[] = ['lipsync:read']): any {
    return this.clientFactory.createClient('lipsync.proto', 'lipsync', 'LipSyncService', config, {
      serviceId: this.config.serviceId,
      serviceName: this.config.serviceName,
      permissions,
      enableAuth: true,
      enableRetry: true,
      enableCircuitBreaker: true,
    });
  }

  /**
   * Get or create circuit breaker for a service
   */
  getCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(
        serviceName,
        new CircuitBreaker({
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 30000,
          resetTimeoutMs: 60000,
        })
      );
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Get or create retry policy for a service
   */
  getRetryPolicy(serviceName: string): RetryPolicy {
    if (!this.retryPolicies.has(serviceName)) {
      this.retryPolicies.set(
        serviceName,
        new RetryPolicy({
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 5000,
          backoffMultiplier: 2,
          retryableErrors: ['UNAVAILABLE', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED'],
        })
      );
    }
    return this.retryPolicies.get(serviceName)!;
  }

  /**
   * Execute a service call with circuit breaker and retry
   */
  async executeServiceCall<T>(serviceName: string, operation: () => Promise<T>): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName);
    const retryPolicy = this.getRetryPolicy(serviceName);

    try {
      return await circuitBreaker.execute(() => retryPolicy.execute(operation));
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.SERVICE_UNAVAILABLE,
        `Service call to ${serviceName} failed: ${(error as Error).message}`,
        serviceName,
        {
          retryable: true,
          cause: error as Error,
        }
      );
    }
  }

  /**
   * Start health checks for registered services
   */
  startHealthChecks(): void {
    this.serviceRegistry.startHealthChecks(async (_endpoint: ServiceEndpoint) => {
      try {
        // Implement health check logic based on service type
        // For now, return true (would need actual health check implementation)
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    this.serviceRegistry.stopHealthChecks();
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    this.stopHealthChecks();
    this.clientFactory.closeAll();
    this.circuitBreakers.clear();
    this.retryPolicies.clear();
  }
}
