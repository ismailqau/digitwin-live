import { PrismaClient } from '@clone/database';
import { createLogger } from '@clone/logger';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import winston from 'winston';

import {
  TrainingJobRequest,
  TrainingJobStatus,
  TrainingJobData,
  TrainingStatus,
  TrainingProgress,
  TrainingLogEntry,
} from '../types';

import { TrainingJobProcessor } from './TrainingJobProcessor';
import { TrainingNotificationService } from './TrainingNotificationService';

export class TrainingJobQueue {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private redis: IORedis;
  private prisma: PrismaClient;
  private logger: winston.Logger;
  private processor: TrainingJobProcessor;
  private notificationService: TrainingNotificationService;

  constructor(prisma: PrismaClient, logger?: winston.Logger, redisUrl?: string) {
    this.prisma = prisma;
    this.logger = logger || createLogger('training-job-queue');

    // Initialize Redis connection
    this.redis = new IORedis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
    });

    // Initialize queue
    this.queue = new Queue('voice-model-training', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
      },
    });

    // Initialize queue events for monitoring
    this.queueEvents = new QueueEvents('voice-model-training', {
      connection: this.redis,
    });

    // Initialize services
    this.processor = new TrainingJobProcessor(this.prisma, this.logger);
    this.notificationService = new TrainingNotificationService(this.prisma, this.logger);

    // Initialize worker
    this.worker = new Worker(
      'voice-model-training',
      async (job: Job<TrainingJobData>) => {
        return await this.processTrainingJob(job);
      },
      {
        connection: this.redis,
        concurrency: parseInt(process.env.TRAINING_CONCURRENCY || '2'), // Max 2 concurrent training jobs
        limiter: {
          max: 5, // Max 5 jobs per minute
          duration: 60000,
        },
      }
    );

    this.setupEventListeners();
  }

  /**
   * Add a new training job to the queue
   */
  async addTrainingJob(request: TrainingJobRequest): Promise<string> {
    try {
      // Validate voice samples exist and belong to user
      const voiceSamples = await this.prisma.voiceSample.findMany({
        where: {
          id: { in: request.voiceSampleIds },
          userId: request.userId,
          status: 'completed',
        },
      });

      if (voiceSamples.length !== request.voiceSampleIds.length) {
        throw new Error('Some voice samples not found or not ready for training');
      }

      // Estimate cost and time
      const estimate = await this.processor.estimateTrainingCost(
        voiceSamples,
        request.provider,
        request.options
      );

      // Create training job record
      const trainingJob = await this.prisma.trainingJob.create({
        data: {
          userId: request.userId,
          provider: request.provider,
          status: TrainingStatus.QUEUED,
          estimatedCost: estimate.estimatedCost,
          estimatedTimeMs: estimate.estimatedTimeMs,
          priority: request.priority || 50,
          jobData: {
            voiceSampleIds: request.voiceSampleIds,
            provider: request.provider,
            options: request.options || {},
            userId: request.userId,
            estimatedCost: estimate.estimatedCost,
            estimatedTimeMs: estimate.estimatedTimeMs,
          } as any,
        },
      });

      // Create many-to-many relationships
      await this.prisma.trainingJobVoiceSample.createMany({
        data: request.voiceSampleIds.map((voiceSampleId) => ({
          trainingJobId: trainingJob.id,
          voiceSampleId,
        })),
      });

      // Add job to queue
      const jobData: TrainingJobData = {
        voiceSamplePaths: voiceSamples.map((sample) => sample.storagePath),
        outputModelPath: `gs://digitwin-live-voice-models/${request.userId}/${trainingJob.id}/model`,
        provider: request.provider,
        options: request.options || {},
        userId: request.userId,
        estimatedCost: estimate.estimatedCost,
        estimatedTimeMs: estimate.estimatedTimeMs,
      };

      await this.queue.add('train-voice-model', jobData, {
        jobId: trainingJob.id,
        priority: request.priority || 50,
        delay: 0, // Start immediately
      });

      this.logger.info('Training job added to queue', {
        jobId: trainingJob.id,
        userId: request.userId,
        provider: request.provider,
        voiceSampleCount: voiceSamples.length,
      });

      return trainingJob.id;
    } catch (error) {
      this.logger.error('Failed to add training job to queue', { error, request });
      throw error;
    }
  }

  /**
   * Get training job status
   */
  async getTrainingJobStatus(jobId: string): Promise<TrainingJobStatus | null> {
    try {
      const trainingJob = await this.prisma.trainingJob.findUnique({
        where: { id: jobId },
        include: {
          trainingJobVoiceSamples: {
            include: {
              voiceSample: true,
            },
          },
        },
      });

      if (!trainingJob) {
        return null;
      }

      return {
        id: trainingJob.id,
        userId: trainingJob.userId,
        status: trainingJob.status as TrainingStatus,
        progress: trainingJob.progress,
        estimatedCost: trainingJob.estimatedCost,
        actualCost: trainingJob.actualCost || undefined,
        estimatedTimeMs: trainingJob.estimatedTimeMs,
        actualTimeMs: trainingJob.actualTimeMs || undefined,
        startedAt: trainingJob.startedAt || undefined,
        completedAt: trainingJob.completedAt || undefined,
        failedAt: trainingJob.failedAt || undefined,
        cancelledAt: trainingJob.cancelledAt || undefined,
        errorMessage: trainingJob.errorMessage || undefined,
        retryCount: trainingJob.retryCount,
        maxRetries: trainingJob.maxRetries,
        priority: trainingJob.priority,
        gpuNodeId: trainingJob.gpuNodeId || undefined,
        logs: (trainingJob.logs as unknown as TrainingLogEntry[]) || [],
        qualityMetrics: trainingJob.qualityMetrics as any,
        createdAt: trainingJob.createdAt,
        updatedAt: trainingJob.updatedAt,
      };
    } catch (error) {
      this.logger.error('Failed to get training job status', { error, jobId });
      throw error;
    }
  }

  /**
   * Cancel a training job
   */
  async cancelTrainingJob(jobId: string, userId: string): Promise<boolean> {
    try {
      // Check if job belongs to user
      const trainingJob = await this.prisma.trainingJob.findFirst({
        where: { id: jobId, userId },
      });

      if (!trainingJob) {
        throw new Error('Training job not found or access denied');
      }

      if (trainingJob.status === TrainingStatus.COMPLETED) {
        throw new Error('Cannot cancel completed training job');
      }

      if (trainingJob.status === TrainingStatus.CANCELLED) {
        return true; // Already cancelled
      }

      // Remove from queue if still queued
      if (trainingJob.status === TrainingStatus.QUEUED) {
        await this.queue.remove(jobId);
      }

      // Update database
      await this.prisma.trainingJob.update({
        where: { id: jobId },
        data: {
          status: TrainingStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // Send notification
      await this.notificationService.sendNotification({
        jobId,
        userId,
        type: 'cancelled',
        message: 'Training job cancelled by user',
      });

      this.logger.info('Training job cancelled', { jobId, userId });
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel training job', { error, jobId, userId });
      throw error;
    }
  }

  /**
   * Get user's training jobs
   */
  async getUserTrainingJobs(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<TrainingJobStatus[]> {
    try {
      const trainingJobs = await this.prisma.trainingJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return trainingJobs.map((job) => ({
        id: job.id,
        userId: job.userId,
        status: job.status as TrainingStatus,
        progress: job.progress,
        estimatedCost: job.estimatedCost,
        actualCost: job.actualCost || undefined,
        estimatedTimeMs: job.estimatedTimeMs,
        actualTimeMs: job.actualTimeMs || undefined,
        startedAt: job.startedAt || undefined,
        completedAt: job.completedAt || undefined,
        failedAt: job.failedAt || undefined,
        cancelledAt: job.cancelledAt || undefined,
        errorMessage: job.errorMessage || undefined,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        priority: job.priority,
        gpuNodeId: job.gpuNodeId || undefined,
        logs: (job.logs as unknown as TrainingLogEntry[]) || [],
        qualityMetrics: job.qualityMetrics as any,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }));
    } catch (error) {
      this.logger.error('Failed to get user training jobs', { error, userId });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      this.logger.error('Failed to get queue stats', { error });
      throw error;
    }
  }

  /**
   * Process a training job
   */
  private async processTrainingJob(job: Job<TrainingJobData>): Promise<void> {
    const jobId = job.id!;
    const startTime = Date.now();

    try {
      // Update job status to running
      await this.prisma.trainingJob.update({
        where: { id: jobId },
        data: {
          status: TrainingStatus.RUNNING,
          startedAt: new Date(),
          gpuNodeId: process.env.GPU_NODE_ID || 'unknown',
        },
      });

      // Send started notification
      await this.notificationService.sendNotification({
        jobId,
        userId: job.data.userId,
        type: 'started',
        message: 'Voice model training started',
      });

      // Process the training job
      const result = await this.processor.processTraining(
        job.data,
        (progress: TrainingProgress) => {
          // Update progress in database
          this.updateTrainingProgress(jobId, progress).catch((error) => {
            this.logger.error('Failed to update training progress', { error, jobId });
          });
        }
      );

      const actualTimeMs = Date.now() - startTime;

      // Update job as completed
      await this.prisma.trainingJob.update({
        where: { id: jobId },
        data: {
          status: TrainingStatus.COMPLETED,
          progress: 100,
          completedAt: new Date(),
          actualTimeMs,
          actualCost: result.actualCost,
          voiceModelId: result.voiceModelId,
          qualityMetrics: JSON.parse(JSON.stringify(result.qualityMetrics)),
        },
      });

      // Send completion notification
      await this.notificationService.sendNotification({
        jobId,
        userId: job.data.userId,
        type: 'completed',
        message: 'Voice model training completed successfully',
        data: {
          voiceModelId: result.voiceModelId,
          qualityScore: result.qualityMetrics.overall,
          actualTimeMs,
          actualCost: result.actualCost,
        },
      });

      this.logger.info('Training job completed successfully', {
        jobId,
        userId: job.data.userId,
        actualTimeMs,
        qualityScore: result.qualityMetrics.overall,
      });
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;

      // Update job as failed
      await this.prisma.trainingJob.update({
        where: { id: jobId },
        data: {
          status: TrainingStatus.FAILED,
          failedAt: new Date(),
          actualTimeMs,
          errorMessage: (error as Error).message,
          retryCount: { increment: 1 },
        },
      });

      // Send failure notification
      await this.notificationService.sendNotification({
        jobId,
        userId: job.data.userId,
        type: 'failed',
        message: `Voice model training failed: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      });

      this.logger.error('Training job failed', {
        jobId,
        userId: job.data.userId,
        error,
        actualTimeMs,
      });

      throw error;
    }
  }

  /**
   * Update training progress
   */
  private async updateTrainingProgress(jobId: string, progress: TrainingProgress): Promise<void> {
    try {
      await this.prisma.trainingJob.update({
        where: { id: jobId },
        data: {
          progress: progress.progress,
          logs: {
            push: {
              timestamp: new Date(),
              level: 'info',
              message: `Training progress: ${progress.progress}% (${progress.stage})`,
              metadata: {
                stage: progress.stage,
                currentEpoch: progress.currentEpoch,
                totalEpochs: progress.totalEpochs,
                loss: progress.loss,
                validationLoss: progress.validationLoss,
                gpuUtilization: progress.gpuUtilization,
                memoryUsage: progress.memoryUsage,
              },
            },
          },
        },
      });

      // Get userId for notification
      const trainingJob = await this.prisma.trainingJob.findUnique({
        where: { id: jobId },
        select: { userId: true },
      });

      if (trainingJob) {
        // Send progress notification
        await this.notificationService.sendNotification({
          jobId,
          userId: trainingJob.userId,
          type: 'progress',
          message: `Training ${progress.progress}% complete`,
          progress: progress.progress,
          data: {
            stage: progress.stage,
            estimatedTimeRemainingMs: progress.estimatedTimeRemainingMs,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to update training progress', { error, jobId, progress });
    }
  }

  /**
   * Setup event listeners for queue monitoring
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId }: { jobId: string }) => {
      this.logger.info('Training job completed', { jobId });
    });

    this.queueEvents.on(
      'failed',
      ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
        this.logger.error('Training job failed', { jobId, failedReason });
      }
    );

    this.queueEvents.on('stalled', ({ jobId }: { jobId: string }) => {
      this.logger.warn('Training job stalled', { jobId });
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error('Training worker error', { error });
    });
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queueEvents.close();
    await this.queue.close();
    await this.redis.quit();
  }
}
