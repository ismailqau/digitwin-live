import { PubSub, Subscription, Message, Topic } from '@google-cloud/pubsub';
import { DomainEvent } from '../types/events';

export interface DeadLetterQueueConfig {
  projectId: string;
  deadLetterTopic: string;
  deadLetterSubscription: string;
  retryTopic?: string;
  maxRetries?: number;
}

export interface DeadLetterMessage {
  originalEvent: DomainEvent;
  errorMessage: string;
  errorStack?: string;
  deliveryAttempts: number;
  firstFailureTime: Date;
  lastFailureTime: Date;
  originalTopic: string;
  originalSubscription: string;
}

export type DeadLetterHandler = (
  message: DeadLetterMessage
) => Promise<'retry' | 'discard' | 'manual'>;

/**
 * Dead Letter Queue Handler
 * Manages failed events and provides retry mechanisms
 */
export class DeadLetterQueueHandler {
  private pubsub: PubSub;
  private config: DeadLetterQueueConfig;
  private deadLetterSubscription: Subscription;
  private retryTopic?: Topic;
  private isProcessing: boolean;

  constructor(config: DeadLetterQueueConfig) {
    this.config = config;
    this.pubsub = new PubSub({
      projectId: config.projectId,
    });
    this.deadLetterSubscription = this.pubsub.subscription(config.deadLetterSubscription);

    if (config.retryTopic) {
      this.retryTopic = this.pubsub.topic(config.retryTopic);
    }

    this.isProcessing = false;
  }

  /**
   * Start processing dead letter queue
   */
  async startProcessing(handler: DeadLetterHandler): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Already processing dead letter queue');
    }

    this.isProcessing = true;

    this.deadLetterSubscription.on('message', async (message: Message) => {
      await this.handleDeadLetterMessage(message, handler);
    });

    this.deadLetterSubscription.on('error', (error: Error) => {
      console.error('Dead letter subscription error:', error);
    });
  }

  /**
   * Stop processing dead letter queue
   */
  async stopProcessing(): Promise<void> {
    this.isProcessing = false;
    this.deadLetterSubscription.removeAllListeners();
  }

  /**
   * Handle dead letter message
   */
  private async handleDeadLetterMessage(
    message: Message,
    handler: DeadLetterHandler
  ): Promise<void> {
    try {
      // Parse dead letter message
      const deadLetterMsg = this.parseDeadLetterMessage(message);

      // Call handler to determine action
      const action = await handler(deadLetterMsg);

      switch (action) {
        case 'retry':
          await this.retryMessage(deadLetterMsg);
          message.ack();
          break;

        case 'discard':
          await this.discardMessage(deadLetterMsg);
          message.ack();
          break;

        case 'manual':
          // Keep in dead letter queue for manual intervention
          message.nack();
          break;

        default:
          console.warn(`Unknown action: ${action}`);
          message.nack();
      }
    } catch (error) {
      console.error('Error handling dead letter message:', error);
      message.nack();
    }
  }

  /**
   * Parse dead letter message
   */
  private parseDeadLetterMessage(message: Message): DeadLetterMessage {
    const eventData = JSON.parse(message.data.toString());
    const originalEvent: DomainEvent = {
      ...eventData,
      timestamp: new Date(eventData.timestamp),
    };

    const deliveryAttempts = parseInt(message.attributes['googclient_deliveryattempt'] || '1');

    return {
      originalEvent,
      errorMessage: message.attributes['errorMessage'] || 'Unknown error',
      errorStack: message.attributes['errorStack'],
      deliveryAttempts,
      firstFailureTime: new Date(message.attributes['firstFailureTime'] || message.publishTime),
      lastFailureTime: new Date(message.publishTime),
      originalTopic: message.attributes['originalTopic'] || 'unknown',
      originalSubscription: message.attributes['originalSubscription'] || 'unknown',
    };
  }

  /**
   * Retry message by publishing to retry topic
   */
  private async retryMessage(deadLetterMsg: DeadLetterMessage): Promise<void> {
    if (!this.retryTopic) {
      throw new Error('Retry topic not configured');
    }

    const maxRetries = this.config.maxRetries || 3;
    if (deadLetterMsg.deliveryAttempts >= maxRetries) {
      console.warn(
        `Max retries (${maxRetries}) exceeded for event ${deadLetterMsg.originalEvent.eventId}`
      );
      await this.discardMessage(deadLetterMsg);
      return;
    }

    // Publish to retry topic
    const messageData = Buffer.from(JSON.stringify(deadLetterMsg.originalEvent));
    const attributes = {
      eventType: deadLetterMsg.originalEvent.eventType,
      eventId: deadLetterMsg.originalEvent.eventId,
      aggregateId: deadLetterMsg.originalEvent.aggregateId,
      aggregateType: deadLetterMsg.originalEvent.aggregateType,
      retryAttempt: deadLetterMsg.deliveryAttempts.toString(),
      originalTopic: deadLetterMsg.originalTopic,
    };

    await this.retryTopic.publishMessage({
      data: messageData,
      attributes,
    });

    console.log(
      `Retrying event ${deadLetterMsg.originalEvent.eventId} (attempt ${deadLetterMsg.deliveryAttempts})`
    );
  }

  /**
   * Discard message (log and archive)
   */
  private async discardMessage(deadLetterMsg: DeadLetterMessage): Promise<void> {
    // Log discarded message
    console.error('Discarding dead letter message:', {
      eventId: deadLetterMsg.originalEvent.eventId,
      eventType: deadLetterMsg.originalEvent.eventType,
      errorMessage: deadLetterMsg.errorMessage,
      deliveryAttempts: deadLetterMsg.deliveryAttempts,
    });

    // In a real implementation, this would archive to a database or storage
    // for later analysis and potential manual recovery
  }

  /**
   * Get dead letter queue statistics
   */
  async getStatistics(): Promise<{
    messageCount: number;
    oldestMessageAge: number;
  }> {
    // Get subscription metadata
    const [metadata] = await this.deadLetterSubscription.getMetadata();

    return {
      messageCount: (metadata as any).numUndeliveredMessages || 0,
      oldestMessageAge: (metadata as any).oldestUnackedMessageAge || 0,
    };
  }

  /**
   * Purge dead letter queue (use with caution!)
   */
  async purge(): Promise<void> {
    console.warn('Purging dead letter queue...');

    // Seek to end to effectively purge all messages
    await this.deadLetterSubscription.seek(new Date());

    console.log('Dead letter queue purged');
  }

  /**
   * Get messages from dead letter queue for inspection
   */
  async inspectMessages(limit: number = 10): Promise<DeadLetterMessage[]> {
    const messages: DeadLetterMessage[] = [];

    return new Promise((resolve, reject) => {
      let count = 0;

      const messageHandler = (message: Message) => {
        try {
          const deadLetterMsg = this.parseDeadLetterMessage(message);
          messages.push(deadLetterMsg);
          message.nack(); // Don't remove from queue

          count++;
          if (count >= limit) {
            this.deadLetterSubscription.removeListener('message', messageHandler);
            resolve(messages);
          }
        } catch (error) {
          reject(error);
        }
      };

      this.deadLetterSubscription.on('message', messageHandler);

      // Timeout after 5 seconds
      setTimeout(() => {
        this.deadLetterSubscription.removeListener('message', messageHandler);
        resolve(messages);
      }, 5000);
    });
  }
}
