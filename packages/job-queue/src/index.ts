/**
 * @clone/job-queue - Background job processing with BullMQ
 *
 * This package provides job queue management for asynchronous tasks:
 * - Document processing
 * - Voice model training
 * - Face model creation
 * - Cache cleanup
 *
 * Uses BullMQ with Redis for reliable job queuing and processing.
 */

export * from './types';
export * from './QueueManager';
export { getQueueManager } from './QueueManager';
