import { DomainEvent } from '@clone/event-bus';

import { QueryBus } from '../bus/QueryBus';

export interface ConsistencyRule {
  eventType: string;
  affectedQueryTypes: string[];
  refreshDelay?: number; // milliseconds
}

/**
 * Eventual Consistency Handler
 * Manages cache invalidation and view refresh based on domain events
 */
export class EventualConsistencyHandler {
  private rules: Map<string, ConsistencyRule>;
  private queryBus: QueryBus;
  private refreshQueue: Map<string, NodeJS.Timeout>;

  constructor(queryBus: QueryBus) {
    this.rules = new Map();
    this.queryBus = queryBus;
    this.refreshQueue = new Map();
  }

  /**
   * Register a consistency rule
   */
  registerRule(rule: ConsistencyRule): void {
    this.rules.set(rule.eventType, rule);
  }

  /**
   * Handle a domain event
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    const rule = this.rules.get(event.eventType);
    if (!rule) {
      return; // No rule for this event type
    }

    // Invalidate affected query caches
    for (const queryType of rule.affectedQueryTypes) {
      this.queryBus.invalidateCacheByType(queryType as any);
    }

    // Schedule view refresh if delay is specified
    if (rule.refreshDelay !== undefined) {
      this.scheduleRefresh(event.eventType, rule.refreshDelay);
    }
  }

  /**
   * Schedule a view refresh
   */
  private scheduleRefresh(eventType: string, delay: number): void {
    // Clear existing timeout if any
    const existing = this.refreshQueue.get(eventType);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule new refresh
    const timeout = setTimeout(async () => {
      await this.refreshViews(eventType);
      this.refreshQueue.delete(eventType);
    }, delay);

    this.refreshQueue.set(eventType, timeout);
  }

  /**
   * Refresh materialized views (override in implementation)
   */
  protected async refreshViews(_eventType: string): Promise<void> {
    // This should be implemented to call database refresh functions
    // For example: REFRESH MATERIALIZED VIEW CONCURRENTLY view_name
  }

  /**
   * Clear all pending refreshes
   */
  clearPendingRefreshes(): void {
    for (const timeout of this.refreshQueue.values()) {
      clearTimeout(timeout);
    }
    this.refreshQueue.clear();
  }
}

/**
 * Default consistency rules for the system
 */
export const DEFAULT_CONSISTENCY_RULES: ConsistencyRule[] = [
  {
    eventType: 'user.created',
    affectedQueryTypes: ['user.get', 'user.get_profile', 'user.get_statistics'],
    refreshDelay: 1000,
  },
  {
    eventType: 'voice_model.trained',
    affectedQueryTypes: ['voice_model.list', 'voice_model.get', 'user.get_profile'],
    refreshDelay: 2000,
  },
  {
    eventType: 'face_model.created',
    affectedQueryTypes: ['face_model.list', 'face_model.get', 'user.get_profile'],
    refreshDelay: 2000,
  },
  {
    eventType: 'document.processed',
    affectedQueryTypes: ['document.list', 'document.get', 'user.get_statistics'],
    refreshDelay: 1000,
  },
  {
    eventType: 'conversation.started',
    affectedQueryTypes: ['conversation.list_sessions', 'conversation.get_session'],
    refreshDelay: 500,
  },
  {
    eventType: 'conversation.turn_completed',
    affectedQueryTypes: [
      'conversation.get_session',
      'conversation.get_history',
      'user.get_statistics',
    ],
    refreshDelay: 1000,
  },
  {
    eventType: 'conversation.ended',
    affectedQueryTypes: [
      'conversation.list_sessions',
      'conversation.get_session',
      'user.get_statistics',
    ],
    refreshDelay: 2000,
  },
];
