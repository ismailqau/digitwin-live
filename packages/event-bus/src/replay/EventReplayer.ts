import { PubSub, Subscription } from '@google-cloud/pubsub';
import { DomainEvent, EventType } from '../types/events';

export interface EventReplayerConfig {
  projectId: string;
  eventStoreTopic: string;
  replaySubscription: string;
}

export interface ReplayOptions {
  fromTimestamp?: Date;
  toTimestamp?: Date;
  eventTypes?: EventType[];
  aggregateIds?: string[];
  aggregateTypes?: string[];
  batchSize?: number;
}

export type ReplayHandler = (event: DomainEvent) => Promise<void>;

/**
 * Event Replayer for debugging and state reconstruction
 * Allows replaying events from the event store
 */
export class EventReplayer {
  private pubsub: PubSub;
  private config: EventReplayerConfig;
  private isReplaying: boolean;
  private replayedCount: number;

  constructor(config: EventReplayerConfig) {
    this.config = config;
    this.pubsub = new PubSub({
      projectId: config.projectId,
    });
    this.isReplaying = false;
    this.replayedCount = 0;
  }

  /**
   * Replay events with specified options
   */
  async replay(handler: ReplayHandler, options: ReplayOptions = {}): Promise<number> {
    if (this.isReplaying) {
      throw new Error('Replay already in progress');
    }

    this.isReplaying = true;
    this.replayedCount = 0;

    try {
      // Create temporary subscription for replay
      const subscription = await this.createReplaySubscription(options);

      // Process messages
      await this.processReplayMessages(subscription, handler, options);

      // Clean up subscription
      await subscription.delete();

      return this.replayedCount;
    } finally {
      this.isReplaying = false;
    }
  }

  /**
   * Replay events for a specific aggregate
   */
  async replayAggregate(
    aggregateId: string,
    aggregateType: string,
    handler: ReplayHandler,
    options: Omit<ReplayOptions, 'aggregateIds' | 'aggregateTypes'> = {}
  ): Promise<number> {
    return this.replay(handler, {
      ...options,
      aggregateIds: [aggregateId],
      aggregateTypes: [aggregateType],
    });
  }

  /**
   * Replay events of specific types
   */
  async replayEventTypes(
    eventTypes: EventType[],
    handler: ReplayHandler,
    options: Omit<ReplayOptions, 'eventTypes'> = {}
  ): Promise<number> {
    return this.replay(handler, {
      ...options,
      eventTypes,
    });
  }

  /**
   * Replay events within a time range
   */
  async replayTimeRange(
    fromTimestamp: Date,
    toTimestamp: Date,
    handler: ReplayHandler,
    options: Omit<ReplayOptions, 'fromTimestamp' | 'toTimestamp'> = {}
  ): Promise<number> {
    return this.replay(handler, {
      ...options,
      fromTimestamp,
      toTimestamp,
    });
  }

  /**
   * Create temporary subscription for replay
   */
  private async createReplaySubscription(options: ReplayOptions): Promise<Subscription> {
    const subscriptionName = `${this.config.replaySubscription}-${Date.now()}`;

    // Build filter expression
    const filters: string[] = [];

    if (options.eventTypes && options.eventTypes.length > 0) {
      const eventTypeFilter = options.eventTypes
        .map((type) => `attributes.eventType="${type}"`)
        .join(' OR ');
      filters.push(`(${eventTypeFilter})`);
    }

    if (options.aggregateIds && options.aggregateIds.length > 0) {
      const aggregateIdFilter = options.aggregateIds
        .map((id) => `attributes.aggregateId="${id}"`)
        .join(' OR ');
      filters.push(`(${aggregateIdFilter})`);
    }

    if (options.aggregateTypes && options.aggregateTypes.length > 0) {
      const aggregateTypeFilter = options.aggregateTypes
        .map((type) => `attributes.aggregateType="${type}"`)
        .join(' OR ');
      filters.push(`(${aggregateTypeFilter})`);
    }

    const filterExpression = filters.length > 0 ? filters.join(' AND ') : undefined;

    // Create subscription with seek to timestamp if specified
    const [subscription] = await this.pubsub.createSubscription(
      this.config.eventStoreTopic,
      subscriptionName,
      {
        filter: filterExpression,
        retainAckedMessages: true,
        messageRetentionDuration: { seconds: 600 }, // 10 minutes
      }
    );

    // Seek to start timestamp if specified
    if (options.fromTimestamp) {
      await subscription.seek(options.fromTimestamp);
    }

    return subscription;
  }

  /**
   * Process messages from replay subscription
   */
  private async processReplayMessages(
    subscription: Subscription,
    handler: ReplayHandler,
    options: ReplayOptions
  ): Promise<void> {
    const batchSize = options.batchSize || 100;
    const toTimestamp = options.toTimestamp;

    return new Promise((resolve, reject) => {
      let processedInBatch = 0;
      let shouldStop = false;

      subscription.on('message', async (message) => {
        try {
          // Parse event
          const eventData = JSON.parse(message.data.toString());
          const event: DomainEvent = {
            ...eventData,
            timestamp: new Date(eventData.timestamp),
          };

          // Check if we've reached the end timestamp
          if (toTimestamp && event.timestamp > toTimestamp) {
            shouldStop = true;
            message.ack();
            return;
          }

          // Call handler
          await handler(event);

          // Acknowledge message
          message.ack();

          this.replayedCount++;
          processedInBatch++;

          // Check if we should stop
          if (shouldStop || (batchSize && processedInBatch >= batchSize)) {
            subscription.removeAllListeners();
            resolve();
          }
        } catch (error) {
          console.error('Error processing replay message:', error);
          message.nack();
          reject(error);
        }
      });

      subscription.on('error', (error) => {
        console.error('Replay subscription error:', error);
        reject(error);
      });

      // Set timeout to prevent hanging
      setTimeout(() => {
        subscription.removeAllListeners();
        resolve();
      }, 60000); // 1 minute timeout
    });
  }

  /**
   * Get replay status
   */
  getStatus(): { isReplaying: boolean; replayedCount: number } {
    return {
      isReplaying: this.isReplaying,
      replayedCount: this.replayedCount,
    };
  }

  /**
   * Stop ongoing replay
   */
  async stop(): Promise<void> {
    this.isReplaying = false;
  }
}
