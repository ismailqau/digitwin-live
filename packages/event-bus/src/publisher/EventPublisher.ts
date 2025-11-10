import { PubSub, Topic } from '@google-cloud/pubsub';

import { DomainEvent, EventType } from '../types/events';

export interface EventPublisherConfig {
  projectId: string;
  topicPrefix?: string;
  enableOrdering?: boolean;
  enableBatching?: boolean;
  batchSettings?: {
    maxMessages?: number;
    maxMilliseconds?: number;
  };
}

export interface PublishResult {
  messageId: string;
  eventId: string;
  publishedAt: Date;
}

/**
 * Event Publisher Service
 * Publishes domain events to Google Cloud Pub/Sub topics
 */
export class EventPublisher {
  private pubsub: PubSub;
  private topics: Map<string, Topic>;
  private config: EventPublisherConfig;

  constructor(config: EventPublisherConfig) {
    this.config = config;
    this.pubsub = new PubSub({
      projectId: config.projectId,
    });
    this.topics = new Map();
  }

  /**
   * Publish a single domain event
   */
  async publish<T extends DomainEvent>(event: T): Promise<PublishResult> {
    const topicName = this.getTopicName(event.eventType as EventType);
    const topic = await this.getTopic(topicName);

    const messageData = Buffer.from(JSON.stringify(event));
    const attributes = {
      eventType: event.eventType,
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      version: event.version.toString(),
      timestamp: event.timestamp.toISOString(),
    };

    // Add ordering key if enabled
    const publishOptions: any = {};
    if (this.config.enableOrdering) {
      publishOptions.orderingKey = event.aggregateId;
    }

    try {
      const messageId = await topic.publishMessage({
        data: messageData,
        attributes,
        ...publishOptions,
      });

      return {
        messageId,
        eventId: event.eventId,
        publishedAt: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Failed to publish event ${event.eventType}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch<T extends DomainEvent>(events: T[]): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    // Group events by topic for efficient batching
    const eventsByTopic = new Map<string, T[]>();
    for (const event of events) {
      const topicName = this.getTopicName(event.eventType as EventType);
      if (!eventsByTopic.has(topicName)) {
        eventsByTopic.set(topicName, []);
      }
      eventsByTopic.get(topicName)!.push(event);
    }

    // Publish each topic's events
    for (const [topicName, topicEvents] of eventsByTopic) {
      const topic = await this.getTopic(topicName);

      const publishPromises = topicEvents.map(async (event) => {
        const messageData = Buffer.from(JSON.stringify(event));
        const attributes = {
          eventType: event.eventType,
          eventId: event.eventId,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          version: event.version.toString(),
          timestamp: event.timestamp.toISOString(),
        };

        const publishOptions: any = {};
        if (this.config.enableOrdering) {
          publishOptions.orderingKey = event.aggregateId;
        }

        const messageId = await topic.publishMessage({
          data: messageData,
          attributes,
          ...publishOptions,
        });

        return {
          messageId,
          eventId: event.eventId,
          publishedAt: new Date(),
        };
      });

      const topicResults = await Promise.all(publishPromises);
      results.push(...topicResults);
    }

    return results;
  }

  /**
   * Get or create a topic
   */
  private async getTopic(topicName: string): Promise<Topic> {
    if (this.topics.has(topicName)) {
      return this.topics.get(topicName)!;
    }

    const topic = this.pubsub.topic(topicName);

    // Check if topic exists, create if not
    const [exists] = await topic.exists();
    if (!exists) {
      await topic.create();
    }

    // Configure batching if enabled
    if (this.config.enableBatching) {
      topic.setPublishOptions({
        batching: {
          maxMessages: this.config.batchSettings?.maxMessages || 100,
          maxMilliseconds: this.config.batchSettings?.maxMilliseconds || 100,
        },
      });
    }

    this.topics.set(topicName, topic);
    return topic;
  }

  /**
   * Generate topic name from event type
   */
  private getTopicName(eventType: EventType): string {
    const prefix = this.config.topicPrefix || 'clone';
    // Convert event type to topic name: user.created -> clone-user-created
    const topicSuffix = eventType.replace(/\./g, '-');
    return `${prefix}-${topicSuffix}`;
  }

  /**
   * Close all topic connections
   */
  async close(): Promise<void> {
    for (const topic of this.topics.values()) {
      await topic.flush();
    }
    this.topics.clear();
  }
}
