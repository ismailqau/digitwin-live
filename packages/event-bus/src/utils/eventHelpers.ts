import { DomainEvent, EventType } from '../types/events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique event ID
 */
export function createEventId(): string {
  return uuidv4();
}

/**
 * Create a domain event with common fields populated
 */
export function createEvent<T extends DomainEvent>(
  eventType: EventType,
  aggregateId: string,
  aggregateType: string,
  payload: any,
  version: number = 1,
  metadata?: Record<string, any>
): Omit<T, 'payload'> & { payload: any } {
  return {
    eventId: createEventId(),
    eventType,
    timestamp: new Date(),
    aggregateId,
    aggregateType,
    version,
    payload,
    metadata,
  } as Omit<T, 'payload'> & { payload: any };
}

/**
 * Validate event structure
 */
export function validateEvent(event: DomainEvent): boolean {
  return !!(
    event.eventId &&
    event.eventType &&
    event.timestamp &&
    event.aggregateId &&
    event.aggregateType &&
    typeof event.version === 'number'
  );
}

/**
 * Create event metadata with common fields
 */
export function createEventMetadata(
  userId?: string,
  correlationId?: string,
  causationId?: string,
  additionalMetadata?: Record<string, any>
): Record<string, any> {
  return {
    userId,
    correlationId,
    causationId,
    ...additionalMetadata,
  };
}
