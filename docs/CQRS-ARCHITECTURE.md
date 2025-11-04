# CQRS Architecture

## Overview

The Real-Time DigitWin Live system implements the CQRS (Command Query Responsibility Segregation) pattern to achieve scalability and performance. This architecture separates read and write operations, allowing each to be optimized independently.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│                    (Mobile App, Web API)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐                    ┌──────────────┐          │
│  │ Command Bus  │                    │  Query Bus   │          │
│  └──────────────┘                    └──────────────┘          │
│         │                                    │                   │
│         ▼                                    ▼                   │
│  ┌──────────────┐                    ┌──────────────┐          │
│  │   Command    │                    │    Query     │          │
│  │   Handlers   │                    │   Handlers   │          │
│  └──────────────┘                    └──────────────┘          │
│         │                                    │                   │
└─────────┼────────────────────────────────────┼──────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────┐
│   Write Model       │            │   Read Model        │
│   (PostgreSQL)      │            │   (Materialized     │
│                     │            │    Views)           │
│  - users            │            │                     │
│  - voice_models     │            │  - user_profile_    │
│  - face_models      │            │    view             │
│  - documents        │            │  - conversation_    │
│  - conversations    │            │    summary_view     │
│  - turns            │            │  - document_        │
└─────────────────────┘            │    summary_view     │
          │                        │  - statistics_view  │
          │                        └─────────────────────┘
          ▼                                    ▲
┌─────────────────────┐                       │
│   Event Stream      │                       │
│   (Pub/Sub)         │───────────────────────┘
│                     │    Eventual Consistency
│  - user.created     │
│  - voice_model.     │
│    trained          │
│  - document.        │
│    processed        │
│  - conversation.*   │
└─────────────────────┘
```

## Core Components

### 1. Command Bus

Routes write operations (commands) to their respective handlers.

**Features:**

- Command validation
- Authorization checks
- Event emission
- Transaction management

**Example Commands:**

- `CreateUserCommand`
- `UploadDocumentCommand`
- `StartConversationCommand`
- `RecordConversationTurnCommand`

### 2. Query Bus

Routes read operations (queries) to their respective handlers.

**Features:**

- Query result caching
- Cache invalidation
- Read from materialized views
- Fast response times

**Example Queries:**

- `GetUserProfileQuery`
- `ListDocumentsQuery`
- `GetConversationHistoryQuery`
- `GetUserStatisticsQuery`

### 3. Command Handlers

Process write operations and emit domain events.

**Responsibilities:**

- Validate command data
- Check authorization
- Execute business logic
- Update write model
- Emit domain events

### 4. Query Handlers

Process read operations from optimized read models.

**Responsibilities:**

- Query materialized views
- Return denormalized data
- Leverage caching
- Provide fast responses

### 5. Materialized Views

Pre-computed read models optimized for queries.

**Views:**

- `user_profile_view`: User data with active models
- `conversation_session_summary_view`: Conversation metrics
- `document_summary_view`: Document processing status
- `user_statistics_view`: Usage statistics
- `voice_model_summary_view`: Voice model usage
- `face_model_summary_view`: Face model usage

### 6. Eventual Consistency Handler

Manages synchronization between write and read models.

**Responsibilities:**

- Listen to domain events
- Invalidate query caches
- Schedule view refreshes
- Maintain consistency rules

## Data Flow

### Write Flow (Commands)

1. Client sends command to Command Bus
2. Command Bus validates the command
3. Command Handler processes the command
4. Write Model is updated
5. Domain events are emitted
6. Events published to Pub/Sub
7. Success response returned to client

### Read Flow (Queries)

1. Client sends query to Query Bus
2. Query Bus checks cache
3. If cache miss, Query Handler executes
4. Handler reads from Materialized View
5. Result cached for future requests
6. Response returned to client

### Consistency Flow

1. Domain event published
2. Eventual Consistency Handler receives event
3. Affected query caches invalidated
4. Materialized view refresh scheduled
5. View refreshed after delay
6. System reaches eventual consistency

## Benefits

### Scalability

- **Independent Scaling**: Read and write models scale separately
- **Read Optimization**: Materialized views provide O(1) lookups
- **Write Optimization**: Commands processed without read concerns
- **Horizontal Scaling**: Both sides can scale horizontally

### Performance

- **Fast Reads**: Pre-computed views eliminate complex joins
- **Query Caching**: Reduces database load
- **Optimized Indexes**: Views have targeted indexes
- **Reduced Contention**: Separate read/write databases possible

### Flexibility

- **Different Models**: Read and write models can differ
- **Multiple Views**: Create views for different use cases
- **Technology Choice**: Use different databases for reads/writes
- **Evolution**: Models evolve independently

### Maintainability

- **Clear Separation**: Commands vs Queries
- **Single Responsibility**: Each handler has one job
- **Testability**: Easy to test in isolation
- **Debugging**: Clear audit trail via events

## Implementation Details

### Command Validation

```typescript
protected async validateCommand(command: CreateUserCommand): Promise<string[]> {
  const violations: string[] = [];

  if (!command.payload.email) {
    violations.push('email is required');
  }

  if (!this.isValidEmail(command.payload.email)) {
    violations.push('email is invalid');
  }

  return violations;
}
```

### Query Caching

```typescript
const queryBus = new QueryBus({
  enableCaching: true,
  cacheTTL: 60000, // 1 minute
});

// First call: queries database
const result1 = await queryBus.execute(query);

// Second call: returns from cache
const result2 = await queryBus.execute(query);
console.log(result2.fromCache); // true
```

### Materialized View Refresh

```sql
-- Refresh single view
REFRESH MATERIALIZED VIEW CONCURRENTLY user_profile_view;

-- Refresh all views
SELECT refresh_all_materialized_views();
```

### Consistency Rules

```typescript
const rule: ConsistencyRule = {
  eventType: 'user.created',
  affectedQueryTypes: ['user.get', 'user.get_profile'],
  refreshDelay: 1000, // 1 second
};

consistencyHandler.registerRule(rule);
```

## Best Practices

### Commands

1. **Validate Early**: Validate all command data before processing
2. **Idempotency**: Design commands to be idempotent
3. **Authorization**: Always check user permissions
4. **Events**: Emit events for all state changes
5. **Transactions**: Use database transactions for consistency

### Queries

1. **Read-Only**: Never modify state in query handlers
2. **Caching**: Enable caching for frequently accessed data
3. **Denormalization**: Pre-compute complex aggregations
4. **Pagination**: Always paginate large result sets
5. **Indexes**: Ensure views have proper indexes

### Consistency

1. **Acceptable Delay**: Define acceptable consistency delays
2. **Critical Paths**: Identify operations requiring immediate consistency
3. **Monitoring**: Monitor view refresh times
4. **Fallback**: Have fallback to write model if needed
5. **Testing**: Test eventual consistency scenarios

## Performance Considerations

### Query Performance

- Materialized views provide sub-millisecond response times
- Caching reduces database load by 80-90%
- Indexes on views enable fast filtering and sorting
- Concurrent refresh minimizes locking

### Write Performance

- Commands processed without read concerns
- Event publishing is asynchronous
- Write model optimized for inserts/updates
- No complex joins during writes

### Consistency Trade-offs

- Typical consistency delay: 1-5 seconds
- Critical operations can bypass cache
- View refresh scheduled during low traffic
- Acceptable for most use cases

## Monitoring

### Metrics to Track

- Command execution time
- Query execution time
- Cache hit rate
- View refresh duration
- Consistency lag
- Event processing time

### Alerts

- Command failure rate > 1%
- Query latency > 100ms
- Cache hit rate < 80%
- View refresh failures
- Consistency lag > 10 seconds

## Related Documentation

- [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md)
- [Database Architecture](./DATABASE-ARCHITECTURE.md)
- [CQRS Package README](../packages/cqrs/README.md)

## References

- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Materialized Views in PostgreSQL](https://www.postgresql.org/docs/current/rules-materializedviews.html)
