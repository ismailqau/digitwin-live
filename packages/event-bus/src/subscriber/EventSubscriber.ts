import { PubSub, Subscription, Message } from '@google-cloud/pubsub';

import { DomainEvent, EventType } from '../types/events';

export interface EventSubscriberConfig {
  projectId: string;
  subscriptionPrefix?: string;
  ackDeadlineSeconds?: number;
  maxMessages?: number;
  flowControl?: {
    maxMessages?: number;
    maxBytes?: number;
  };
}

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
  message: Message
) => Promise<void>;

export interface SubscriptionOptions {
  eventType: EventType;
  handler: EventHandler;
  deadLetterTopic?: string;
  maxDeliveryAttempts?: number;
  filter?: string;
}

/**
 * Event Subscriber Service
 * Subscribes to domain events from Google Cloud Pub/Sub topics
 */
export class EventSubscriber {
  private pubsub: PubSub;
  private subscriptions: Map<string, Subscription>;
  private config: EventSubscriberConfig;
  private handlers: Map<string, EventHandler>;

  constructor(config: EventSubscriberConfig) {
    this.config = config;
    this.pubsub = new PubSub({
      projectId: config.projectId,
    });
    this.subscriptions = new Map();
    this.handlers = new Map();
  }

  /**
   * Subscribe to a specific event type
   */
  async subscribe(options: SubscriptionOptions): Promise<void> {
    const topicName = this.getTopicName(options.eventType);
    const subscriptionName = this.getSubscriptionName(options.eventType);

    // Store handler
    this.handlers.set(subscriptionName, options.handler);

    // Get or create subscription
    const subscription = await this.getOrCreateSubscription(topicName, subscriptionName, options);

    // Set up message handler
    subscription.on('message', async (message: Message) => {
      await this.handleMessage(message, subscriptionName);
    });

    subscription.on('error', (error: Error) => {
      console.error(`Subscription ${subscriptionName} error:`, error);
    });

    this.subscriptions.set(subscriptionName, subscription);
  }

  /**
   * Subscribe to multiple event types
   */
  async subscribeMultiple(subscriptions: SubscriptionOptions[]): Promise<void> {
    await Promise.all(subscriptions.map((sub) => this.subscribe(sub)));
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: Message, subscriptionName: string): Promise<void> {
    const handler = this.handlers.get(subscriptionName);
    if (!handler) {
      console.error(`No handler found for subscription ${subscriptionName}`);
      message.nack();
      return;
    }

    try {
      // Parse event from message data
      const eventData = JSON.parse(message.data.toString());

      // Reconstruct event with proper Date objects
      const event: DomainEvent = {
        ...eventData,
        timestamp: new Date(eventData.timestamp),
      };

      // Call handler
      await handler(event, message);

      // Acknowledge message
      message.ack();
    } catch (error) {
      console.error(`Error handling message in ${subscriptionName}:`, error);

      // Check delivery attempts
      const deliveryAttempt = parseInt(message.attributes['googclient_deliveryattempt'] || '1');
      const maxAttempts = 5; // Default max attempts

      if (deliveryAttempt >= maxAttempts) {
        // Max attempts reached, ack to move to dead letter queue
        console.error(`Max delivery attempts reached for message ${message.id}`);
        message.ack();
      } else {
        // Nack to retry
        message.nack();
      }
    }
  }

  /**
   * Get or create subscription
   */
  private async getOrCreateSubscription(
    topicName: string,
    subscriptionName: string,
    options: SubscriptionOptions
  ): Promise<Subscription> {
    const subscription = this.pubsub.subscription(subscriptionName);

    const [exists] = await subscription.exists();
    if (!exists) {
      const subscriptionConfig: any = {
        topic: topicName,
        ackDeadlineSeconds: this.config.ackDeadlineSeconds || 60,
        flowControl: this.config.flowControl || {
          maxMessages: 100,
        },
      };

      // Configure dead letter queue if specified
      if (options.deadLetterTopic) {
        subscriptionConfig.deadLetterPolicy = {
          deadLetterTopic: options.deadLetterTopic,
          maxDeliveryAttempts: options.maxDeliveryAttempts || 5,
        };
      }

      // Add filter if specified
      if (options.filter) {
        subscriptionConfig.filter = options.filter;
      }

      await this.pubsub.createSubscription(topicName, subscriptionName, subscriptionConfig);
    }

    return subscription;
  }

  /**
   * Generate topic name from event type
   */
  private getTopicName(eventType: EventType): string {
    const prefix = 'clone'; // Should match publisher prefix
    const topicSuffix = eventType.replace(/\./g, '-');
    return `${prefix}-${topicSuffix}`;
  }

  /**
   * Generate subscription name from event type
   */
  private getSubscriptionName(eventType: EventType): string {
    const prefix = this.config.subscriptionPrefix || 'clone-sub';
    const subscriptionSuffix = eventType.replace(/\./g, '-');
    return `${prefix}-${subscriptionSuffix}`;
  }

  /**
   * Unsubscribe from a specific event type
   */
  async unsubscribe(eventType: EventType): Promise<void> {
    const subscriptionName = this.getSubscriptionName(eventType);
    const subscription = this.subscriptions.get(subscriptionName);

    if (subscription) {
      await subscription.close();
      this.subscriptions.delete(subscriptionName);
      this.handlers.delete(subscriptionName);
    }
  }

  /**
   * Close all subscriptions
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.subscriptions.values()).map((sub) => sub.close());
    await Promise.all(closePromises);
    this.subscriptions.clear();
    this.handlers.clear();
  }
}
