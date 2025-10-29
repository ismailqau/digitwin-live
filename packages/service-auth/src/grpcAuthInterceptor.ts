import { Metadata, ServerUnaryCall, ServerReadableStream, ServerWritableStream, ServerDuplexStream, status } from '@grpc/grpc-js';
import { ServiceAuthManager } from './ServiceAuthManager';

export type GrpcCall = 
  | ServerUnaryCall<any, any>
  | ServerReadableStream<any, any>
  | ServerWritableStream<any, any>
  | ServerDuplexStream<any, any>;

export interface AuthInterceptorConfig {
  authManager: ServiceAuthManager;
  requiredPermission?: string;
  skipAuth?: boolean;
}

/**
 * gRPC server interceptor for authentication
 */
export function createAuthInterceptor(config: AuthInterceptorConfig) {
  return (call: GrpcCall, callback: (error: Error | null) => void) => {
    // Skip auth if configured
    if (config.skipAuth) {
      return callback(null);
    }

    try {
      const metadata = call.metadata;
      const payload = config.authManager.verifyMetadata(metadata);

      // Check permission if required
      if (config.requiredPermission && !config.authManager.hasPermission(payload, config.requiredPermission)) {
        const error = new Error(`Service ${payload.serviceName} lacks required permission: ${config.requiredPermission}`);
        (error as any).code = status.PERMISSION_DENIED;
        return callback(error);
      }

      // Attach service info to call for downstream use
      (call as any).serviceAuth = payload;
      callback(null);
    } catch (error) {
      const authError = new Error(`Authentication failed: ${(error as Error).message}`);
      (authError as any).code = status.UNAUTHENTICATED;
      callback(authError);
    }
  };
}

/**
 * gRPC client interceptor to add authentication
 */
export function createClientAuthInterceptor(authManager: ServiceAuthManager, serviceId: string, serviceName: string, permissions: string[]) {
  return (options: any, nextCall: any) => {
    return new Proxy(nextCall(options), {
      get(target, prop) {
        if (prop === 'start') {
          return (metadata: Metadata, listener: any, next: any) => {
            // Add auth token to metadata
            const authMetadata = authManager.createAuthMetadata(serviceId, serviceName, permissions);
            
            // Merge with existing metadata
            authMetadata.merge(metadata);
            
            target.start(authMetadata, listener, next);
          };
        }
        return target[prop];
      }
    });
  };
}
