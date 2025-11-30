import { FaceProcessingError } from '@clone/errors';
import { createLogger } from '@clone/logger';

const logger = createLogger('gpu-worker-service');

/**
 * GPU job types
 */
export type GPUJobType =
  | 'face_detection'
  | 'face_embedding'
  | 'expression_extraction'
  | 'model_training'
  | 'preview_generation'
  | 'lipsync_generation';

/**
 * GPU job status
 */
export type GPUJobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * GPU job priority
 */
export type GPUJobPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * GPU job definition
 */
export interface GPUJob {
  id: string;
  type: GPUJobType;
  userId: string;
  priority: GPUJobPriority;
  status: GPUJobStatus;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDurationMs: number;
  actualDurationMs?: number;
  retryCount: number;
  maxRetries: number;
  workerId?: string;
}

/**
 * GPU worker status
 */
export interface GPUWorkerStatus {
  workerId: string;
  nodePool: string;
  gpuType: 'T4' | 'V100' | 'A100';
  status: 'idle' | 'busy' | 'offline' | 'draining';
  currentJobId?: string;
  memoryUsedMB: number;
  memoryTotalMB: number;
  utilizationPercent: number;
  lastHeartbeat: Date;
  jobsCompleted: number;
  jobsFailed: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageWaitTimeMs: number;
  averageProcessingTimeMs: number;
  throughputPerMinute: number;
}

/**
 * GPU resource metrics
 */
export interface GPUResourceMetrics {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  offlineWorkers: number;
  totalMemoryMB: number;
  usedMemoryMB: number;
  averageUtilization: number;
  estimatedCostPerHour: number;
}

/**
 * Auto-scaling configuration
 */
export interface AutoScalingConfig {
  minWorkers: number;
  maxWorkers: number;
  scaleUpThreshold: number; // Queue length to trigger scale up
  scaleDownThreshold: number; // Idle time (ms) to trigger scale down
  cooldownPeriodMs: number;
  preemptibleEnabled: boolean;
}

/**
 * GPU worker configuration
 */
export interface GPUWorkerConfig {
  defaultPriority: GPUJobPriority;
  maxRetries: number;
  jobTimeoutMs: number;
  heartbeatIntervalMs: number;
  autoScaling: AutoScalingConfig;
  costPerHourT4: number;
  costPerHourV100: number;
  costPerHourA100: number;
}

const DEFAULT_CONFIG: GPUWorkerConfig = {
  defaultPriority: 'normal',
  maxRetries: 3,
  jobTimeoutMs: 300000, // 5 minutes
  heartbeatIntervalMs: 30000, // 30 seconds
  autoScaling: {
    minWorkers: 1,
    maxWorkers: 10,
    scaleUpThreshold: 5,
    scaleDownThreshold: 300000, // 5 minutes idle
    cooldownPeriodMs: 60000, // 1 minute
    preemptibleEnabled: true,
  },
  costPerHourT4: 0.35,
  costPerHourV100: 2.48,
  costPerHourA100: 3.67,
};

/**
 * Estimated job durations by type (in ms)
 */
const ESTIMATED_DURATIONS: Record<GPUJobType, number> = {
  face_detection: 500,
  face_embedding: 1000,
  expression_extraction: 2000,
  model_training: 60000,
  preview_generation: 5000,
  lipsync_generation: 100, // per frame
};

/**
 * GPU Worker Service
 * Manages GPU job queuing, scheduling, and worker orchestration
 */
export class GPUWorkerService {
  private config: GPUWorkerConfig;

  // In-memory storage (in production, use Redis/BullMQ)
  private jobs: Map<string, GPUJob> = new Map();
  private workers: Map<string, GPUWorkerStatus> = new Map();
  private jobQueue: string[] = []; // Job IDs in priority order
  private lastScaleAction: Date = new Date(0);

  constructor(config: Partial<GPUWorkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('GPUWorkerService initialized', { config: this.config });
  }

  /**
   * Submit a new GPU job
   */
  async submitJob(
    type: GPUJobType,
    userId: string,
    payload: Record<string, unknown>,
    options: { priority?: GPUJobPriority; maxRetries?: number } = {}
  ): Promise<GPUJob> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: GPUJob = {
      id: jobId,
      type,
      userId,
      priority: options.priority || this.config.defaultPriority,
      status: 'pending',
      payload,
      createdAt: new Date(),
      estimatedDurationMs: ESTIMATED_DURATIONS[type],
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
    };

    this.jobs.set(jobId, job);
    this.enqueueJob(job);

    logger.info('GPU job submitted', {
      jobId,
      type,
      userId,
      priority: job.priority,
      estimatedDurationMs: job.estimatedDurationMs,
    });

    // Check if we need to scale up
    await this.checkAutoScaling();

    return job;
  }

  /**
   * Enqueue job in priority order
   */
  private enqueueJob(job: GPUJob): void {
    job.status = 'queued';

    // Priority order: critical > high > normal > low
    const priorityOrder: Record<GPUJobPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    // Find insertion point
    let insertIndex = this.jobQueue.length;
    for (let i = 0; i < this.jobQueue.length; i++) {
      const existingJob = this.jobs.get(this.jobQueue[i]);
      if (existingJob && priorityOrder[job.priority] < priorityOrder[existingJob.priority]) {
        insertIndex = i;
        break;
      }
    }

    this.jobQueue.splice(insertIndex, 0, job.id);
    this.jobs.set(job.id, job);
  }

  /**
   * Get next job from queue
   */
  private dequeueJob(): GPUJob | null {
    while (this.jobQueue.length > 0) {
      const jobId = this.jobQueue.shift();
      if (jobId) {
        const job = this.jobs.get(jobId);
        if (job && job.status === 'queued') {
          return job;
        }
      }
    }
    return null;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<GPUJob | null> {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get jobs by user
   */
  getJobsByUser(userId: string): GPUJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.userId === userId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'processing') {
      // In production, send cancel signal to worker
      logger.warn('Cannot cancel job in progress', { jobId });
      return false;
    }

    job.status = 'cancelled';
    this.jobs.set(jobId, job);

    // Remove from queue
    const queueIndex = this.jobQueue.indexOf(jobId);
    if (queueIndex >= 0) {
      this.jobQueue.splice(queueIndex, 1);
    }

    logger.info('Job cancelled', { jobId });
    return true;
  }

  /**
   * Register a GPU worker
   */
  registerWorker(
    workerId: string,
    nodePool: string,
    gpuType: 'T4' | 'V100' | 'A100',
    memoryTotalMB: number
  ): GPUWorkerStatus {
    const worker: GPUWorkerStatus = {
      workerId,
      nodePool,
      gpuType,
      status: 'idle',
      memoryUsedMB: 0,
      memoryTotalMB,
      utilizationPercent: 0,
      lastHeartbeat: new Date(),
      jobsCompleted: 0,
      jobsFailed: 0,
    };

    this.workers.set(workerId, worker);
    logger.info('GPU worker registered', { workerId, gpuType, nodePool });

    return worker;
  }

  /**
   * Update worker heartbeat
   */
  updateWorkerHeartbeat(
    workerId: string,
    metrics: { memoryUsedMB: number; utilizationPercent: number }
  ): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.lastHeartbeat = new Date();
    worker.memoryUsedMB = metrics.memoryUsedMB;
    worker.utilizationPercent = metrics.utilizationPercent;
    this.workers.set(workerId, worker);
  }

  /**
   * Assign job to worker
   */
  async assignJobToWorker(workerId: string): Promise<GPUJob | null> {
    const worker = this.workers.get(workerId);
    if (!worker || worker.status !== 'idle') {
      return null;
    }

    const job = this.dequeueJob();
    if (!job) return null;

    job.status = 'processing';
    job.startedAt = new Date();
    job.workerId = workerId;
    this.jobs.set(job.id, job);

    worker.status = 'busy';
    worker.currentJobId = job.id;
    this.workers.set(workerId, worker);

    logger.info('Job assigned to worker', { jobId: job.id, workerId });

    return job;
  }

  /**
   * Complete a job
   */
  async completeJob(jobId: string, result: Record<string, unknown>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new FaceProcessingError('Job not found', { jobId });
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.result = result;
    job.actualDurationMs = job.startedAt ? Date.now() - job.startedAt.getTime() : 0;
    this.jobs.set(jobId, job);

    // Update worker status
    if (job.workerId) {
      const worker = this.workers.get(job.workerId);
      if (worker) {
        worker.status = 'idle';
        worker.currentJobId = undefined;
        worker.jobsCompleted++;
        this.workers.set(job.workerId, worker);
      }
    }

    logger.info('Job completed', {
      jobId,
      durationMs: job.actualDurationMs,
    });
  }

  /**
   * Fail a job
   */
  async failJob(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new FaceProcessingError('Job not found', { jobId });
    }

    job.retryCount++;

    if (job.retryCount < job.maxRetries) {
      // Re-queue for retry
      job.status = 'queued';
      job.workerId = undefined;
      this.enqueueJob(job);
      logger.warn('Job failed, retrying', { jobId, retryCount: job.retryCount });
    } else {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error;
      this.jobs.set(jobId, job);
      logger.error('Job failed permanently', { jobId, error });
    }

    // Update worker status
    if (job.workerId) {
      const worker = this.workers.get(job.workerId);
      if (worker) {
        worker.status = 'idle';
        worker.currentJobId = undefined;
        worker.jobsFailed++;
        this.workers.set(job.workerId, worker);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): QueueStats {
    const allJobs = Array.from(this.jobs.values());
    const completedJobs = allJobs.filter((j) => j.status === 'completed');
    const failedJobs = allJobs.filter((j) => j.status === 'failed');
    const processingJobs = allJobs.filter((j) => j.status === 'processing');

    // Calculate average wait time
    const waitTimes = completedJobs
      .filter((j) => j.startedAt)
      .map((j) => j.startedAt!.getTime() - j.createdAt.getTime());
    const averageWaitTimeMs =
      waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;

    // Calculate average processing time
    const processingTimes = completedJobs
      .filter((j) => j.actualDurationMs)
      .map((j) => j.actualDurationMs!);
    const averageProcessingTimeMs =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

    // Calculate throughput (jobs completed in last minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentCompletions = completedJobs.filter(
      (j) => j.completedAt && j.completedAt > oneMinuteAgo
    );

    return {
      pendingJobs: this.jobQueue.length,
      processingJobs: processingJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      averageWaitTimeMs: Math.round(averageWaitTimeMs),
      averageProcessingTimeMs: Math.round(averageProcessingTimeMs),
      throughputPerMinute: recentCompletions.length,
    };
  }

  /**
   * Get GPU resource metrics
   */
  getResourceMetrics(): GPUResourceMetrics {
    const allWorkers = Array.from(this.workers.values());
    const activeWorkers = allWorkers.filter((w) => w.status === 'busy');
    const idleWorkers = allWorkers.filter((w) => w.status === 'idle');
    const offlineWorkers = allWorkers.filter((w) => w.status === 'offline');

    const totalMemory = allWorkers.reduce((sum, w) => sum + w.memoryTotalMB, 0);
    const usedMemory = allWorkers.reduce((sum, w) => sum + w.memoryUsedMB, 0);
    const avgUtilization =
      allWorkers.length > 0
        ? allWorkers.reduce((sum, w) => sum + w.utilizationPercent, 0) / allWorkers.length
        : 0;

    // Calculate estimated cost
    let estimatedCost = 0;
    for (const worker of allWorkers) {
      if (worker.status !== 'offline') {
        switch (worker.gpuType) {
          case 'T4':
            estimatedCost += this.config.costPerHourT4;
            break;
          case 'V100':
            estimatedCost += this.config.costPerHourV100;
            break;
          case 'A100':
            estimatedCost += this.config.costPerHourA100;
            break;
        }
      }
    }

    return {
      totalWorkers: allWorkers.length,
      activeWorkers: activeWorkers.length,
      idleWorkers: idleWorkers.length,
      offlineWorkers: offlineWorkers.length,
      totalMemoryMB: totalMemory,
      usedMemoryMB: usedMemory,
      averageUtilization: Math.round(avgUtilization),
      estimatedCostPerHour: Math.round(estimatedCost * 100) / 100,
    };
  }

  /**
   * Check and perform auto-scaling
   */
  async checkAutoScaling(): Promise<{
    action: 'scale_up' | 'scale_down' | 'none';
    reason: string;
  }> {
    const { autoScaling } = this.config;
    const now = new Date();

    // Check cooldown
    if (now.getTime() - this.lastScaleAction.getTime() < autoScaling.cooldownPeriodMs) {
      return { action: 'none', reason: 'In cooldown period' };
    }

    const metrics = this.getResourceMetrics();
    const queueStats = this.getQueueStats();

    // Scale up if queue is too long
    if (
      queueStats.pendingJobs >= autoScaling.scaleUpThreshold &&
      metrics.totalWorkers < autoScaling.maxWorkers
    ) {
      this.lastScaleAction = now;
      logger.info('Auto-scaling: scale up triggered', {
        pendingJobs: queueStats.pendingJobs,
        currentWorkers: metrics.totalWorkers,
      });
      return {
        action: 'scale_up',
        reason: `Queue length ${queueStats.pendingJobs} exceeds threshold`,
      };
    }

    // Scale down if workers are idle
    if (
      metrics.idleWorkers > 0 &&
      metrics.totalWorkers > autoScaling.minWorkers &&
      queueStats.pendingJobs === 0
    ) {
      // Check if any worker has been idle long enough
      const idleWorker = Array.from(this.workers.values()).find(
        (w) =>
          w.status === 'idle' &&
          now.getTime() - w.lastHeartbeat.getTime() > autoScaling.scaleDownThreshold
      );

      if (idleWorker) {
        this.lastScaleAction = now;
        logger.info('Auto-scaling: scale down triggered', {
          idleWorkers: metrics.idleWorkers,
          currentWorkers: metrics.totalWorkers,
        });
        return { action: 'scale_down', reason: 'Workers idle for too long' };
      }
    }

    return { action: 'none', reason: 'No scaling needed' };
  }

  /**
   * Remove offline workers
   */
  cleanupOfflineWorkers(): number {
    const staleThreshold = this.config.heartbeatIntervalMs * 3;
    const now = Date.now();
    let removed = 0;

    for (const [workerId, worker] of this.workers.entries()) {
      if (now - worker.lastHeartbeat.getTime() > staleThreshold) {
        worker.status = 'offline';
        this.workers.set(workerId, worker);

        // Re-queue any job that was being processed
        if (worker.currentJobId) {
          const job = this.jobs.get(worker.currentJobId);
          if (job && job.status === 'processing') {
            job.status = 'queued';
            job.workerId = undefined;
            this.enqueueJob(job);
            logger.warn('Re-queued job from offline worker', {
              jobId: job.id,
              workerId,
            });
          }
        }

        removed++;
      }
    }

    if (removed > 0) {
      logger.info('Cleaned up offline workers', { count: removed });
    }

    return removed;
  }

  /**
   * Get worker status
   */
  getWorkerStatus(workerId: string): GPUWorkerStatus | null {
    return this.workers.get(workerId) || null;
  }

  /**
   * Get all workers
   */
  getAllWorkers(): GPUWorkerStatus[] {
    return Array.from(this.workers.values());
  }

  /**
   * Estimate wait time for a new job
   */
  estimateWaitTime(priority: GPUJobPriority): number {
    const queueStats = this.getQueueStats();
    const metrics = this.getResourceMetrics();

    if (metrics.idleWorkers > 0) {
      return 0; // Immediate processing
    }

    // Estimate based on queue position and average processing time
    const priorityOrder: Record<GPUJobPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    let jobsAhead = 0;
    for (const jobId of this.jobQueue) {
      const job = this.jobs.get(jobId);
      if (job && priorityOrder[job.priority] <= priorityOrder[priority]) {
        jobsAhead++;
      }
    }

    const avgProcessingTime = queueStats.averageProcessingTimeMs || 5000;
    const activeWorkers = Math.max(1, metrics.activeWorkers);

    return Math.round((jobsAhead * avgProcessingTime) / activeWorkers);
  }

  /**
   * Get cost analytics
   */
  getCostAnalytics(periodMs: number = 3600000): {
    totalCost: number;
    costByGpuType: Record<string, number>;
    costByJobType: Record<string, number>;
    efficiency: number;
  } {
    const periodStart = new Date(Date.now() - periodMs);
    const completedJobs = Array.from(this.jobs.values()).filter(
      (j) => j.status === 'completed' && j.completedAt && j.completedAt > periodStart
    );

    // Calculate cost by GPU type (simplified)
    const costByGpuType: Record<string, number> = { T4: 0, V100: 0, A100: 0 };
    const costByJobType: Record<string, number> = {};

    let totalProcessingTime = 0;
    for (const job of completedJobs) {
      const duration = job.actualDurationMs || 0;
      totalProcessingTime += duration;

      // Estimate cost based on duration (assuming T4 for simplicity)
      const cost = (duration / 3600000) * this.config.costPerHourT4;
      costByGpuType['T4'] += cost;

      if (!costByJobType[job.type]) {
        costByJobType[job.type] = 0;
      }
      costByJobType[job.type] += cost;
    }

    const totalCost = Object.values(costByGpuType).reduce((a, b) => a + b, 0);

    // Calculate efficiency (actual processing time vs total time)
    const metrics = this.getResourceMetrics();
    const totalWorkerTime = metrics.totalWorkers * periodMs;
    const efficiency = totalWorkerTime > 0 ? (totalProcessingTime / totalWorkerTime) * 100 : 0;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      costByGpuType,
      costByJobType,
      efficiency: Math.round(efficiency),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): GPUWorkerConfig {
    return { ...this.config };
  }
}
