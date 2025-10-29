import { PubSub, Topic } from '@google-cloud/pubsub';
import { DomainEvent } from '../types/events';

export interface EventStoreConfig {
  projectId: string;
  eventStoreTopic: string;
  snapshotInterval?: number; // Create snapshot every N events
}

export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  events: DomainEvent[];
  version: number;
}

export interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: any;
  timestamp: Date;
}

/**
 * Event Store for Event Sourcing
 * Stores all domain events for conversation history and state reconstruction
 */
export class EventStore {
  private pubsub: PubSub;
  private eventStoreTopic: Topic;
  private config: EventStoreConfig;
  private eventCache: Map<string, DomainEvent[]>;
  private snapshotCache: Map<string, Snapshot>;

  constructor(config: EventStoreConfig) {
    this.config = config;
    this.pubsub = new PubSub({
      projectId: config.projectId,
    });
    this.eventStoreTopic = this.pubsub.topic(config.eventStoreTopic);
    this.eventCache = new Map();
    this.snapshotCache = new Map();
  }

  /**
   * Append event to event store
   */
  async appendEvent(event: DomainEvent): Promise<void> {
    // Publish to event store topic
    const messageData = Buffer.from(JSON.stringify(event));
    const attributes = {
      eventType: event.eventType,
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      version: event.version.toString(),
      timestamp: event.timestamp.toISOString(),
    };

    await this.eventStoreTopic.publishMessage({
      data: messageData,
      attributes,
      orderingKey: event.aggregateId, // Ensure ordering per aggregate
    });

    // Update cache
    const cacheKey = this.getCacheKey(event.aggregateId, event.aggregateType);
    if (!this.eventCache.has(cacheKey)) {
      this.eventCache.set(cacheKey, []);
    }
    this.eventCache.get(cacheKey)!.push(event);

    // Check if snapshot should be created
    const events = this.eventCache.get(cacheKey)!;
    const snapshotInterval = this.config.snapshotInterval || 10;
    if (events.length % snapshotInterval === 0) {
      // Snapshot creation would be handled by a separate service
      // This is just a marker for when snapshots should be created
      console.log(`Snapshot marker: ${cacheKey} at version ${event.version}`);
    }
  }

  /**
   * Append multiple events in order
   */
  async appendEvents(events: DomainEvent[]): Promise<void> {
    // Sort events by version to ensure correct ordering
    const sortedEvents = [...events].sort((a, b) => a.version - b.version);

    for (const event of sortedEvents) {
      await this.appendEvent(event);
    }
  }

  /**
   * Get event stream for an aggregate
   * Returns all events for reconstruction
   */
  async getEventStream(aggregateId: string, aggregateType: string): Promise<EventStream> {
    const cacheKey = this.getCacheKey(aggregateId, aggregateType);

    // Check cache first
    if (this.eventCache.has(cacheKey)) {
      const events = this.eventCache.get(cacheKey)!;
      return {
        aggregateId,
        aggregateType,
        events,
        version: events.length > 0 ? events[events.length - 1].version : 0,
      };
    }

    // In a real implementation, this would query from a persistent store
    // For now, return empty stream
    return {
      aggregateId,
      aggregateType,
      events: [],
      version: 0,
    };
  }

  /**
   * Get events from a specific version
   */
  async getEventsFromVersion(
    aggregateId: string,
    aggregateType: string,
    fromVersion: number
  ): Promise<DomainEvent[]> {
    const stream = await this.getEventStream(aggregateId, aggregateType);
    return stream.events.filter((event) => event.version >= fromVersion);
  }

  /**
   * Save snapshot of aggregate state
   */
  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    const cacheKey = this.getCacheKey(snapshot.aggregateId, snapshot.aggregateType);
    this.snapshotCache.set(cacheKey, snapshot);

    // In a real implementation, this would persist to a database
    console.log(`Snapshot saved: ${cacheKey} at version ${snapshot.version}`);
  }

  /**
   * Get latest snapshot for an aggregate
   */
  async getSnapshot(aggregateId: string, aggregateType: string): Promise<Snapshot | null> {
    const cacheKey = this.getCacheKey(aggregateId, aggregateType);
    return this.snapshotCache.get(cacheKey) || null;
  }

  /**
   * Reconstruct aggregate state from events
   */
  async reconstructState<T>(
    aggregateId: string,
    aggregateType: string,
    reducer: (state: T, event: DomainEvent) => T,
    initialState: T
  ): Promise<T> {
    // Try to get snapshot first
    const snapshot = await this.getSnapshot(aggregateId, aggregateType);
    let state = snapshot ? (snapshot.state as T) : initialState;
    let fromVersion = snapshot ? snapshot.version + 1 : 0;

    // Get events after snapshot
    const events = await this.getEventsFromVersion(aggregateId, aggregateType, fromVersion);

    // Apply events to reconstruct state
    for (const event of events) {
      state = reducer(state, event);
    }

    return state;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(aggregateId: string, aggregateType: string): string {
    return `${aggregateType}:${aggregateId}`;
  }

  /**
   * Clear cache for an aggregate
   */
  clearCache(aggregateId: string, aggregateType: string): void {
    const cacheKey = this.getCacheKey(aggregateId, aggregateType);
    this.eventCache.delete(cacheKey);
    this.snapshotCache.delete(cacheKey);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.eventCache.clear();
    this.snapshotCache.clear();
  }
}
