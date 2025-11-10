/**
 * gRPC Client Factory
 *
 * Creates gRPC clients with authentication, retry, and circuit breaker support
 */

import path from 'path';

import { ServiceAuthManager } from '@clone/service-auth';
import { ServiceRegistry } from '@clone/service-discovery';
import { CircuitBreaker, RetryPolicy } from '@clone/service-errors';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

import { GrpcClientOptions, ServiceConfig } from './types';

export interface GrpcClientFactoryConfig {
  authManager?: ServiceAuthManager;
  serviceRegistry?: ServiceRegistry;
  defaultTimeout?: number;
  enableTLS?: boolean;
}

export class GrpcClientFactory {
  private authManager?: ServiceAuthManager;
  private serviceRegistry?: ServiceRegistry;
  private defaultTimeout: number;
  private enableTLS: boolean;
  private clients: Map<string, any> = new Map();

  constructor(config: GrpcClientFactoryConfig) {
    this.authManager = config.authManager;
    this.serviceRegistry = config.serviceRegistry;
    this.defaultTimeout = config.defaultTimeout || 30000;
    this.enableTLS = config.enableTLS || false;
  }

  /**
   * Create a gRPC client for a service
   */
  createClient<T = any>(
    protoFile: string,
    packageName: string,
    serviceName: string,
    config: ServiceConfig,
    options?: GrpcClientOptions
  ): T {
    const cacheKey = `${packageName}.${serviceName}:${config.host}:${config.port}`;

    // Return cached client if exists
    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey);
    }

    // Load proto file
    const protoPath = path.join(__dirname, '../../proto', protoFile);
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const servicePackage = (protoDescriptor as any)[packageName];
    const ServiceClient = servicePackage[serviceName];

    // Create credentials
    const credentials =
      config.useTLS || this.enableTLS
        ? grpc.credentials.createSsl()
        : grpc.credentials.createInsecure();

    // Create client
    const address = `${config.host}:${config.port}`;
    const client = new ServiceClient(address, credentials, {
      'grpc.max_receive_message_length': 100 * 1024 * 1024, // 100MB
      'grpc.max_send_message_length': 100 * 1024 * 1024, // 100MB
      'grpc.keepalive_time_ms': 30000,
      'grpc.keepalive_timeout_ms': 10000,
    });

    // Wrap client with interceptors if options provided
    let wrappedClient = client;

    if (options) {
      wrappedClient = this.wrapClientWithInterceptors(client, serviceName, options, config);
    }

    // Cache and return
    this.clients.set(cacheKey, wrappedClient);
    return wrappedClient;
  }

  /**
   * Create client using service discovery
   */
  createClientFromRegistry<T = any>(
    protoFile: string,
    packageName: string,
    serviceName: string,
    options?: GrpcClientOptions
  ): T | null {
    if (!this.serviceRegistry) {
      throw new Error('Service registry not configured');
    }

    const endpoint = this.serviceRegistry.getEndpoint(serviceName);
    if (!endpoint) {
      return null;
    }

    const config: ServiceConfig = {
      host: endpoint.host,
      port: endpoint.port,
      useTLS: endpoint.protocol === 'https',
    };

    return this.createClient(protoFile, packageName, serviceName, config, options);
  }

  /**
   * Wrap client with authentication, retry, and circuit breaker
   */
  private wrapClientWithInterceptors(
    client: any,
    serviceName: string,
    options: GrpcClientOptions,
    config: ServiceConfig
  ): any {
    const wrappedClient: any = {};

    // Get all methods from the client
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client)).filter(
      (name) => name !== 'constructor' && typeof client[name] === 'function'
    );

    for (const method of methods) {
      const originalMethod = client[method].bind(client);

      wrappedClient[method] = (...args: any[]) => {
        // Add authentication metadata if enabled
        if (options.enableAuth && this.authManager) {
          const metadata = this.authManager.createAuthMetadata(
            options.serviceId,
            options.serviceName,
            options.permissions
          );

          // Insert metadata as second-to-last argument (before callback)
          if (args.length > 0) {
            args.splice(args.length - 1, 0, metadata);
          }
        }

        // Wrap with retry if enabled
        if (options.enableRetry) {
          return this.wrapWithRetry(originalMethod, args, config);
        }

        // Wrap with circuit breaker if enabled
        if (options.enableCircuitBreaker) {
          return this.wrapWithCircuitBreaker(originalMethod, args, serviceName);
        }

        return originalMethod(...args);
      };
    }

    return wrappedClient;
  }

  /**
   * Wrap method call with retry logic
   */
  private wrapWithRetry(method: (...args: any[]) => void, args: any[], config: ServiceConfig): any {
    const retryPolicy = new RetryPolicy({
      maxAttempts: config.maxRetries || 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      retryableErrors: ['UNAVAILABLE', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED'],
    });

    return retryPolicy.execute(() => {
      return new Promise((resolve, reject) => {
        method(...args, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
    });
  }

  /**
   * Wrap method call with circuit breaker
   */
  private wrapWithCircuitBreaker(
    method: (...args: any[]) => void,
    args: any[],
    _serviceName: string
  ): any {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: this.defaultTimeout,
      resetTimeoutMs: 60000,
    });

    return circuitBreaker.execute(() => {
      return new Promise((resolve, reject) => {
        method(...args, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
    });
  }

  /**
   * Close all clients
   */
  closeAll(): void {
    for (const client of this.clients.values()) {
      if (client.close) {
        client.close();
      }
    }
    this.clients.clear();
  }

  /**
   * Close specific client
   */
  closeClient(packageName: string, serviceName: string, host: string, port: number): void {
    const cacheKey = `${packageName}.${serviceName}:${host}:${port}`;
    const client = this.clients.get(cacheKey);

    if (client && client.close) {
      client.close();
    }

    this.clients.delete(cacheKey);
  }
}
