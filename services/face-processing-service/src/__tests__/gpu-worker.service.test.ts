import { GPUWorkerService } from '../services/gpu-worker.service';

describe('GPUWorkerService', () => {
  let service: GPUWorkerService;

  beforeEach(() => {
    service = new GPUWorkerService();
  });

  describe('submitJob', () => {
    it('should submit a new job', async () => {
      const job = await service.submitJob('face_detection', 'user_123', { imageData: 'test' });

      expect(job.id).toBeDefined();
      expect(job.type).toBe('face_detection');
      expect(job.userId).toBe('user_123');
      expect(job.status).toBe('queued');
      expect(job.priority).toBe('normal');
    });

    it('should accept custom priority', async () => {
      const job = await service.submitJob('face_embedding', 'user_123', {}, { priority: 'high' });

      expect(job.priority).toBe('high');
    });

    it('should set estimated duration based on job type', async () => {
      const job = await service.submitJob('model_training', 'user_123', {});

      expect(job.estimatedDurationMs).toBeGreaterThan(0);
    });
  });

  describe('getJob', () => {
    it('should retrieve job by ID', async () => {
      const submitted = await service.submitJob('face_detection', 'user_123', {});
      const retrieved = await service.getJob(submitted.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(submitted.id);
    });

    it('should return null for non-existent job', async () => {
      const result = await service.getJob('non_existent');
      expect(result).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should cancel queued job', async () => {
      const job = await service.submitJob('face_detection', 'user_123', {});
      const cancelled = await service.cancelJob(job.id);

      expect(cancelled).toBe(true);
      const updated = await service.getJob(job.id);
      expect(updated?.status).toBe('cancelled');
    });

    it('should return false for non-existent job', async () => {
      const result = await service.cancelJob('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('registerWorker', () => {
    it('should register a new worker', () => {
      const worker = service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

      expect(worker.workerId).toBe('worker_1');
      expect(worker.gpuType).toBe('T4');
      expect(worker.status).toBe('idle');
      expect(worker.memoryTotalMB).toBe(16000);
    });
  });

  describe('assignJobToWorker', () => {
    it('should assign job to idle worker', async () => {
      await service.submitJob('face_detection', 'user_123', {});
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

      const job = await service.assignJobToWorker('worker_1');

      expect(job).not.toBeNull();
      expect(job?.status).toBe('processing');
      expect(job?.workerId).toBe('worker_1');
    });

    it('should return null if no jobs in queue', async () => {
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);
      const job = await service.assignJobToWorker('worker_1');

      expect(job).toBeNull();
    });

    it('should prioritize high priority jobs', async () => {
      await service.submitJob('face_detection', 'user_123', {}, { priority: 'low' });
      await service.submitJob('face_embedding', 'user_123', {}, { priority: 'high' });
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

      const job = await service.assignJobToWorker('worker_1');

      expect(job?.type).toBe('face_embedding');
      expect(job?.priority).toBe('high');
    });
  });

  describe('completeJob', () => {
    it('should complete a job', async () => {
      const submitted = await service.submitJob('face_detection', 'user_123', {});
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);
      await service.assignJobToWorker('worker_1');

      await service.completeJob(submitted.id, { result: 'success' });

      const job = await service.getJob(submitted.id);
      expect(job?.status).toBe('completed');
      expect(job?.result).toEqual({ result: 'success' });
      expect(job?.actualDurationMs).toBeDefined();
    });

    it('should update worker status on completion', async () => {
      await service.submitJob('face_detection', 'user_123', {});
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);
      const job = await service.assignJobToWorker('worker_1');

      await service.completeJob(job!.id, {});

      const worker = service.getWorkerStatus('worker_1');
      expect(worker?.status).toBe('idle');
      expect(worker?.jobsCompleted).toBe(1);
    });
  });

  describe('failJob', () => {
    it('should retry failed job', async () => {
      const submitted = await service.submitJob('face_detection', 'user_123', {});
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);
      await service.assignJobToWorker('worker_1');

      await service.failJob(submitted.id, 'Test error');

      const job = await service.getJob(submitted.id);
      expect(job?.status).toBe('queued');
      expect(job?.retryCount).toBe(1);
    });

    it('should fail permanently after max retries', async () => {
      const submitted = await service.submitJob(
        'face_detection',
        'user_123',
        {},
        { maxRetries: 1 }
      );
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

      // First attempt
      await service.assignJobToWorker('worker_1');
      await service.failJob(submitted.id, 'Error 1');

      // Second attempt (should fail permanently)
      await service.assignJobToWorker('worker_1');
      await service.failJob(submitted.id, 'Error 2');

      const job = await service.getJob(submitted.id);
      expect(job?.status).toBe('failed');
      expect(job?.error).toBe('Error 2');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      await service.submitJob('face_detection', 'user_123', {});
      await service.submitJob('face_embedding', 'user_123', {});

      const stats = service.getQueueStats();

      expect(stats.pendingJobs).toBe(2);
      expect(stats).toHaveProperty('processingJobs');
      expect(stats).toHaveProperty('completedJobs');
      expect(stats).toHaveProperty('failedJobs');
      expect(stats).toHaveProperty('averageWaitTimeMs');
      expect(stats).toHaveProperty('throughputPerMinute');
    });
  });

  describe('getResourceMetrics', () => {
    it('should return resource metrics', () => {
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);
      service.registerWorker('worker_2', 'gpu-pool', 'V100', 32000);

      const metrics = service.getResourceMetrics();

      expect(metrics.totalWorkers).toBe(2);
      expect(metrics.idleWorkers).toBe(2);
      expect(metrics.totalMemoryMB).toBe(48000);
      expect(metrics).toHaveProperty('estimatedCostPerHour');
    });
  });

  describe('checkAutoScaling', () => {
    it('should suggest scale up when queue is long', async () => {
      // Create service with very short cooldown for testing
      const testService = new GPUWorkerService({
        autoScaling: {
          minWorkers: 1,
          maxWorkers: 10,
          scaleUpThreshold: 5,
          scaleDownThreshold: 300000,
          cooldownPeriodMs: 0, // No cooldown for testing
          preemptibleEnabled: true,
        },
      });

      // Register one worker (below max)
      testService.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

      // Submit many jobs to exceed threshold
      for (let i = 0; i < 10; i++) {
        await testService.submitJob('face_detection', 'user_123', {});
      }

      const result = await testService.checkAutoScaling();

      expect(result.action).toBe('scale_up');
    });

    it('should return none when no scaling needed', async () => {
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

      const result = await service.checkAutoScaling();

      expect(result.action).toBe('none');
    });
  });

  describe('estimateWaitTime', () => {
    it('should return 0 when workers are idle', () => {
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

      const waitTime = service.estimateWaitTime('normal');

      expect(waitTime).toBe(0);
    });

    it('should estimate wait time based on queue', async () => {
      await service.submitJob('face_detection', 'user_123', {});
      await service.submitJob('face_detection', 'user_123', {});
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);
      await service.assignJobToWorker('worker_1'); // Make worker busy

      const waitTime = service.estimateWaitTime('normal');

      expect(waitTime).toBeGreaterThan(0);
    });
  });

  describe('getCostAnalytics', () => {
    it('should return cost analytics', () => {
      service.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

      const analytics = service.getCostAnalytics();

      expect(analytics).toHaveProperty('totalCost');
      expect(analytics).toHaveProperty('costByGpuType');
      expect(analytics).toHaveProperty('costByJobType');
      expect(analytics).toHaveProperty('efficiency');
    });
  });

  describe('configuration', () => {
    it('should return configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('defaultPriority');
      expect(config).toHaveProperty('maxRetries');
      expect(config).toHaveProperty('jobTimeoutMs');
      expect(config).toHaveProperty('autoScaling');
    });

    it('should accept custom configuration', () => {
      const customService = new GPUWorkerService({
        maxRetries: 5,
        defaultPriority: 'high',
      });

      const config = customService.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.defaultPriority).toBe('high');
    });
  });
});
