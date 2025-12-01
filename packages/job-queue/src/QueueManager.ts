/**
 * Queue Manager for background job processing
 * Uses BullMQ with Redis for reliable job queuing
 */

import { config } from '@clone/config';
import { logger } from '@clone/logger';
import { Queue, QueueEvents, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

import { JobType, JobData, JobOptions, JobResult, JobProgress } from './types';

export class QueueManager {
  private queues: Map<JobType, Queue>;
  private workers: Map<JobType, Worker>;
  private queueEvents: Map<JobType, QueueEvents>;
  private connection: Redis;

  constructor() {
    this.queues = new Map();
    this.workers = new Map();
    this.queueEvents = new Map();

    // Create Redis connection
    this.connection = new Redis({
      host: config.redis?.host || 'localhost',
      port: config.redis?.port || 6379,
      password: config.redis?.password,
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    this.connection.on('error', (error: Error) => {
      logger.error('Redis connection error', { error: error.message });
    });

    this.connection.on('connect', () => {
      logger.info('Redis connected for job queue');
    });
  }

  /**
   * Create a queue for a specific job type
   */
  createQueue(jobType: JobType): Queue {
    if (this.queues.has(jobType)) {
      return this.queues.get(jobType)!;
    }

    const queue = new Queue(jobType, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 100, // Keep last 100 failed jobs
      },
    });

    this.queues.set(jobType, queue);

    // Set up queue events
    const queueEvents = new QueueEvents(jobType, {
      connection: this.connection,
    });

    queueEvents.on('completed', ({ jobId }: { jobId: string }) => {
      logger.info('Job completed', { jobType, jobId });
    });

    queueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      logger.error('Job failed', { jobType, jobId, failedReason });
    });

    queueEvents.on('progress', ({ jobId, data }: { jobId: string; data: unknown }) => {
      logger.debug('Job progress', { jobType, jobId, progress: data });
    });

    this.queueEvents.set(jobType, queueEvents);

    logger.info('Queue created', { jobType });
    return queue;
  }

  /**
   * Add a job to the queue
   */
  async addJob<T extends JobData>(
    jobType: JobType,
    data: T,
    options?: JobOptions
  ): Promise<Job<T>> {
    const queue = this.queues.get(jobType) || this.createQueue(jobType);

    const job = await queue.add(jobType, data, {
      priority: options?.priority,
      delay: options?.delay,
      attempts: options?.attempts,
      backoff: options?.backoff,
      removeOnComplete: options?.removeOnComplete,
      removeOnFail: options?.removeOnFail,
    });

    logger.info('Job added to queue', {
      jobType,
      jobId: job.id,
      userId: data.userId,
    });

    return job as Job<T>;
  }

  /**
   * Create a worker to process jobs
   */
  createWorker<T extends JobData>(
    jobType: JobType,
    processor: (job: Job<T>) => Promise<JobResult>,
    concurrency: number = 1
  ): Worker {
    if (this.workers.has(jobType)) {
      return this.workers.get(jobType)!;
    }

    const worker = new Worker<T, JobResult>(
      jobType,
      async (job: Job<T>) => {
        logger.info('Processing job', {
          jobType,
          jobId: job.id,
          userId: job.data.userId,
        });

        try {
          const result = await processor(job);

          if (result.success) {
            logger.info('Job processed successfully', {
              jobType,
              jobId: job.id,
            });
          } else {
            logger.warn('Job completed with errors', {
              jobType,
              jobId: job.id,
              error: result.error,
            });
          }

          return result;
        } catch (error) {
          logger.error('Job processing error', {
            jobType,
            jobId: job.id,
            error: (error as Error).message,
          });
          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency,
      }
    );

    worker.on('completed', (job: Job<T, JobResult>) => {
      logger.info('Worker completed job', {
        jobType,
        jobId: job.id,
      });
    });

    worker.on('failed', (job: Job<T, JobResult> | undefined, error: Error) => {
      logger.error('Worker failed job', {
        jobType,
        jobId: job?.id,
        error: error.message,
      });
    });

    this.workers.set(jobType, worker);

    logger.info('Worker created', { jobType, concurrency });
    return worker;
  }

  /**
   * Get job by ID
   */
  async getJob(jobType: JobType, jobId: string): Promise<Job | null> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      return null;
    }

    const job = await queue.getJob(jobId);
    return job || null;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobType: JobType, jobId: string): Promise<string | null> {
    const job = await this.getJob(jobType, jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return state;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(job: Job, progress: JobProgress): Promise<void> {
    await job.updateProgress(progress);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobType: JobType, jobId: string): Promise<boolean> {
    const job = await this.getJob(jobType, jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    logger.info('Job cancelled', { jobType, jobId });
    return true;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(jobType: JobType): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(
    jobType: JobType,
    grace: number = 3600000 // 1 hour in milliseconds
  ): Promise<void> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      return;
    }

    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace, 100, 'failed');

    logger.info('Queue cleaned', { jobType, grace });
  }

  /**
   * Pause queue
   */
  async pauseQueue(jobType: JobType): Promise<void> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      return;
    }

    await queue.pause();
    logger.info('Queue paused', { jobType });
  }

  /**
   * Resume queue
   */
  async resumeQueue(jobType: JobType): Promise<void> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      return;
    }

    await queue.resume();
    logger.info('Queue resumed', { jobType });
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    logger.info('Closing queue manager');

    // Close all workers
    for (const [jobType, worker] of this.workers.entries()) {
      await worker.close();
      logger.info('Worker closed', { jobType });
    }

    // Close all queue events
    for (const [jobType, queueEvents] of this.queueEvents.entries()) {
      await queueEvents.close();
      logger.info('Queue events closed', { jobType });
    }

    // Close all queues
    for (const [jobType, queue] of this.queues.entries()) {
      await queue.close();
      logger.info('Queue closed', { jobType });
    }

    // Close Redis connection
    await this.connection.quit();
    logger.info('Redis connection closed');
  }
}

// Singleton instance
let queueManager: QueueManager | null = null;

export function getQueueManager(): QueueManager {
  if (!queueManager) {
    queueManager = new QueueManager();
  }
  return queueManager;
}
