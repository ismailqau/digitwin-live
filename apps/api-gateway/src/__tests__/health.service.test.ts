/**
 * Health Service Tests
 */

import { DatabaseConnection } from '@clone/database';

import { HealthService, getHealthService } from '../services/health.service';

// Mock the database connection
jest.mock('@clone/database', () => ({
  DatabaseConnection: {
    healthCheck: jest.fn(),
  },
}));

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh instance for each test
    healthService = new HealthService();
  });

  describe('getLivenessCheck', () => {
    it('should return healthy status with service info', async () => {
      const result = await healthService.getLivenessCheck();

      expect(result.status).toBe('healthy');
      expect(result.service).toBe('api-gateway');
      expect(result.version).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getHealthCheck', () => {
    it('should return healthy status when all dependencies are healthy', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockResolvedValue(true);

      const result = await healthService.getHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result.service).toBe('api-gateway');
      expect(result.components).toBeDefined();
      expect(result.components?.database).toBeDefined();
      expect(result.components?.database.status).toBe('healthy');
    });

    it('should return unhealthy status when required dependency fails', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockResolvedValue(false);

      const result = await healthService.getHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.components?.database.status).toBe('unhealthy');
    });

    it('should return degraded status when optional dependency fails', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockResolvedValue(true);

      // Add an optional dependency that fails
      healthService.addDependency({
        name: 'optional-service',
        type: 'external_api',
        required: false,
        timeoutMs: 1000,
        checkFn: async () => false,
      });

      const result = await healthService.getHealthCheck();

      expect(result.status).toBe('degraded');
      expect(result.components?.database.status).toBe('healthy');
      expect(result.components?.['optional-service'].status).toBe('unhealthy');
    });

    it('should handle timeout errors', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 10000))
      );

      // Add a dependency with short timeout
      const service = new HealthService();
      // The default database check has 5000ms timeout, so this should timeout

      const result = await service.getHealthCheck();

      // Should still return a result (with timeout error)
      expect(result).toBeDefined();
      expect(result.service).toBe('api-gateway');
    });

    it('should include latency measurements', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockResolvedValue(true);

      const result = await healthService.getHealthCheck();

      expect(result.components?.database.latencyMs).toBeDefined();
      expect(result.components?.database.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getReadinessCheck', () => {
    it('should return ready when all required dependencies are healthy', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockResolvedValue(true);

      const result = await healthService.getReadinessCheck();

      expect(result.ready).toBe(true);
      expect(result.service).toBe('api-gateway');
      expect(result.checks.database.ready).toBe(true);
    });

    it('should return not ready when required dependency fails', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockResolvedValue(false);

      const result = await healthService.getReadinessCheck();

      expect(result.ready).toBe(false);
      expect(result.checks.database.ready).toBe(false);
    });

    it('should still be ready when optional dependency fails', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockResolvedValue(true);

      // Add an optional dependency that fails
      healthService.addDependency({
        name: 'optional-service',
        type: 'external_api',
        required: false,
        timeoutMs: 1000,
        checkFn: async () => false,
      });

      const result = await healthService.getReadinessCheck();

      expect(result.ready).toBe(true);
      expect(result.checks.database.ready).toBe(true);
      expect(result.checks['optional-service'].ready).toBe(false);
    });
  });

  describe('addDependency', () => {
    it('should add custom dependency checks', async () => {
      (DatabaseConnection.healthCheck as jest.Mock).mockResolvedValue(true);

      healthService.addDependency({
        name: 'custom-service',
        type: 'service',
        required: true,
        timeoutMs: 1000,
        checkFn: async () => true,
      });

      const result = await healthService.getHealthCheck();

      expect(result.components?.['custom-service']).toBeDefined();
      expect(result.components?.['custom-service'].status).toBe('healthy');
    });
  });

  describe('getHealthService singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getHealthService();
      const instance2 = getHealthService();

      expect(instance1).toBe(instance2);
    });
  });
});
