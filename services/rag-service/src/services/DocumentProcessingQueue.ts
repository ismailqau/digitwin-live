/**
 * DocumentProcessingQueue - Background job processing for document processing
 * Uses Bull/BullMQ with Redis for job queue management
 */

import { logger } from '@clone/logger';
import { Queue, Worker, type Job, type JobProgress } from 'bullmq';

import { DocumentProcessor, type ProcessingResult } from './DocumentProcessor';

export interface DocumentProcessingJob {
  documentId: string;
  userId: string;
  retryCount?: number;
}

export interface QueueConfig {
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  maxRetries: number;
  retryDelay: number; // Base delay in ms for exponential backoff
}

export class DocumentProcessingQueue {
  private queue: Queue<DocumentProcessingJob>;
  private worker: Worker<DocumentProcessingJob, ProcessingResult>;
  private documentProcessor: DocumentProcessor;
  private config: QueueConfig;

  constructor(documentProcessor: DocumentProcessor, queueConfig?: Partial<QueueConfig>) {
    this.documentProcessor = documentProcessor;
    this.config = {
      redisHost: queueConfig?.redisHost || process.env.REDIS_HOST || 'localhost',
      redisPort: queueConfig?.redisPort || parseInt(process.env.REDIS_PORT || '6379'),
      redisPassword: queueConfig?.redisPassword || process.env.REDIS_PASSWORD,
      maxRetries: queueConfig?.maxRetries || 3,
      retryDelay: queueConfig?.retryDelay || 1000,
    };

    const connection = {
      host: this.config.redisHost,
      port: this.config.redisPort,
      password: this.config.redisPassword,
    };

    // Initialize queue
    this.queue = new Queue<DocumentProcessingJob>('document-processing-queue', {
      connection,
      defaultJobOptions: {
        attempts: this.config.maxRetries,
        backoff: {
          type: 'exponential',
          delay: this.config.retryDelay,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Initialize worker
    this.worker = new Worker<DocumentProcessingJob, ProcessingResult>(
      'document-processing-queue',
      async (job: Job<DocumentProcessingJob>) => {
        return await this.processJob(job);
      },
      {
        connection,
        concurrency: 5, // Process up to 5 documents concurrently
      }
    );

    // Set up event listeners
    this.setupEventListeners();

    logger.info('Document processing queue initialized', {
      redisHost: this.config.redisHost,
      redisPort: this.config.redisPort,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Add document to processing queue
   */
  async addDocument(documentId: string, userId: string): Promise<string> {
    const job = await this.queue.add(
      'process-document',
      {
        documentId,
        userId,
        retryCount: 0,
      },
      {
        jobId: documentId, // Use documentId as jobId to prevent duplicates
      }
    );

    logger.info('Document added to processing queue', {
      documentId,
      userId,
      jobId: job.id,
    });

    return job.id || documentId;
  }

  /**
   * Process a job
   */
  private async processJob(job: Job<DocumentProcessingJob>): Promise<ProcessingResult> {
    const { documentId, userId } = job.data;

    logger.info('Processing document job', {
      documentId,
      userId,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    });

    try {
      // Update job progress
      await job.updateProgress(10);

      // Process document
      const result = await this.documentProcessor.processDocument(documentId);

      // Update job progress
      await job.updateProgress(100);

      return result;
    } catch (error) {
      logger.error('Document processing job failed', {
        documentId,
        userId,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        error,
      });

      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Job completed
    this.worker.on('completed', (job: Job<DocumentProcessingJob, ProcessingResult>) => {
      logger.info('Document processing job completed', {
        documentId: job.data.documentId,
        jobId: job.id,
        result: job.returnvalue,
      });
    });

    // Job failed
    this.worker.on('failed', (job: Job<DocumentProcessingJob> | undefined, error: Error) => {
      if (job) {
        logger.error('Document processing job failed', {
          documentId: job.data.documentId,
          jobId: job.id,
          attemptsMade: job.attemptsMade,
          error: error.message,
        });
      }
    });

    // Job progress
    this.worker.on('progress', (job: Job<DocumentProcessingJob>, progress: JobProgress) => {
      logger.debug('Document processing job progress', {
        documentId: job.data.documentId,
        jobId: job.id,
        progress,
      });
    });

    // Worker error
    this.worker.on('error', (error: Error) => {
      logger.error('Document processing worker error', { error: error.message });
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: ProcessingResult;
    error?: string;
  }> {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return {
        status: 'not_found',
        progress: 0,
      };
    }

    const state = await job.getState();
    const progress = job.progress as number;

    return {
      status: state,
      progress,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove();
      logger.info('Document processing job cancelled', { jobId });
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
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
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
  async cleanup(): Promise<void> {
    await this.queue.clean(24 * 3600 * 1000, 1000, 'completed'); // Clean completed jobs older than 24 hours
    await this.queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed'); // Clean failed jobs older than 7 days
    logger.info('Queue cleanup completed');
  }

  /**
   * Close queue and worker
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    logger.info('Document processing queue closed');
  }
}
