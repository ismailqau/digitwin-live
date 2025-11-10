import { Metadata } from '@grpc/grpc-js';
import jwt from 'jsonwebtoken';

export interface ServiceTokenPayload {
  serviceId: string;
  serviceName: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface ServiceAuthConfig {
  jwtSecret: string;
  tokenExpirySeconds: number;
}

export class ServiceAuthManager {
  private jwtSecret: string;
  private tokenExpirySeconds: number;

  constructor(config: ServiceAuthConfig) {
    this.jwtSecret = config.jwtSecret;
    this.tokenExpirySeconds = config.tokenExpirySeconds;
  }

  /**
   * Generate a JWT token for service-to-service authentication
   */
  generateServiceToken(serviceId: string, serviceName: string, permissions: string[]): string {
    const payload: Omit<ServiceTokenPayload, 'iat' | 'exp'> = {
      serviceId,
      serviceName,
      permissions,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpirySeconds,
      issuer: 'clone-system',
      audience: 'clone-services',
    });
  }

  /**
   * Verify a service token
   */
  verifyServiceToken(token: string): ServiceTokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'clone-system',
        audience: 'clone-services',
      }) as ServiceTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Service token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid service token');
      }
      throw error;
    }
  }

  /**
   * Create gRPC metadata with service token
   */
  createAuthMetadata(serviceId: string, serviceName: string, permissions: string[]): Metadata {
    const token = this.generateServiceToken(serviceId, serviceName, permissions);
    const metadata = new Metadata();
    metadata.set('authorization', `Bearer ${token}`);
    return metadata;
  }

  /**
   * Extract and verify token from gRPC metadata
   */
  verifyMetadata(metadata: Metadata): ServiceTokenPayload {
    const authHeader = metadata.get('authorization')[0];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    return this.verifyServiceToken(token);
  }

  /**
   * Check if service has required permission
   */
  hasPermission(payload: ServiceTokenPayload, requiredPermission: string): boolean {
    return payload.permissions.includes(requiredPermission) || payload.permissions.includes('*');
  }
}
