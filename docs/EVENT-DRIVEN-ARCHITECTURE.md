# Event-Driven Architecture

This document describes the event-driven architecture implementation for the Conversational Clone system using Google Cloud Pub/Sub.

## Overview

The system uses an event-driven architecture to enable loose coupling between services, provide a complete audit trail, and support event sourcing for conversation history.

## Architecture Components

### 1. Event Publisher

The Event Publisher service publishes domain events to Google Cloud Pub/Sub topics.

**Features:**
- Topic-based routing by event type
- Message ordering per aggregate
- Batch publishing for efficiency
- Automatic topic creation

**Usage:**
```typescript
const publisher = new EventPublisher({
  projectId: process.env.GCP_PROJECT_ID,
  topicPrefix: 'clone',
  enableOrdering: true,
  enableBatching: true,
});

await publisher.publish(event);
```

### 2. Event Subscriber

The Event Subscriber service subscribes to domain events and routes them to appropriate handlers.

**Features:**
- Type-safe event handlers
- Automatic retry with exponential backoff
- Dead letter queue integration
- Flow control for message processing

**Usage:**
```typescript
const subscriber = new EventSubscriber({
  projectId: process.env.GCP_PROJECT_ID,
  subscriptionPrefix: 'clone-sub',
  ackDeadlineSeconds: 60,
});

await subscriber.subscribe({
  eventType: 'document.processed',
  handler: async (event) => {
    // Handle document processed event
  },
  deadLetterTopic: 'clone-dead-letter',
  maxDeliveryAttempts: 5,
});
```

### 3. Event Store

The Event Store implements event sourcing for conversation history and state reconstruction.

**Features:**
- Append-only event log
- Event stream per aggregate
- Snapshot support for performance
- State reconstruction from events

**Usage:**
```typescript
const eventStore = new EventStore({
  projectId: process.env.GCP_PROJECT_ID,
  eventStoreTopic: 'clone-event-store',
  snapshotInterval: 10,
});

// Store conversation events
await eventStore.appendEvent(conversationEvent);

// Reconstruct conversation state
const state = await eventStore.reconstructState(
  sessionId,
  'conversation_session',
  conversationReducer,
  initialState
);
```

### 4. Event Replayer

The Event Replayer enables debugging and state reconstruction by replaying historical events.

**Features:**
- Time-range replay
- Event type filtering
- Aggregate filtering
- Batch processing

**Usage:**
```typescript
const replayer = new EventReplayer({
  projectId: process.env.GCP_PROJECT_ID,
  eventStoreTopic: 'clone-event-store',
  replaySubscription: 'clone-replay',
});

// Replay events for debugging
await replayer.replayTimeRange(
  startDate,
  endDate,
  async (event) => {
    console.log('Replaying:', event);
  }
);
```

### 5. Dead Letter Queue Handler

The Dead Letter Queue Handler manages failed events and provides retry mechanisms.

**Features:**
- Automatic retry with configurable attempts
- Failed event inspection
- Manual intervention support
- Statistics and monitoring

**Usage:**
```typescript
const dlqHandler = new DeadLetterQueueHandler({
  projectId: process.env.GCP_PROJECT_ID,
  deadLetterTopic: 'clone-dead-letter',
  deadLetterSubscription: 'clone-dead-letter-sub',
  retryTopic: 'clone-retry',
  maxRetries: 3,
});

await dlqHandler.startProcessing(async (message) => {
  if (message.deliveryAttempts < 3) {
    return 'retry';
  }
  return 'discard';
});
```

## Domain Events

### User Events

**UserCreatedEvent**
- Emitted when a new user registers
- Triggers: Welcome email, analytics tracking, initial setup

### Voice Model Events

**VoiceModelTrainedEvent**
- Emitted when voice model training completes
- Triggers: Notification to user, model activation, quality validation

**VoiceModelTrainingFailedEvent**
- Emitted when voice model training fails
- Triggers: Error notification, retry logic, support ticket

### Document Events

**DocumentProcessedEvent**
- Emitted when a knowledge document is processed
- Triggers: Vector indexing, user notification, analytics

**DocumentProcessingFailedEvent**
- Emitted when document processing fails
- Triggers: Error notification, retry logic, cleanup

### Face Model Events

**FaceModelCreatedEvent**
- Emitted when face model creation completes
- Triggers: User notification, model activation, quality validation

**FaceModelCreationFailedEvent**
- Emitted when face model creation fails
- Triggers: Error notification, retry logic, support ticket

### Conversation Events

**ConversationStartedEvent**
- Emitted when a conversation session begins
- Triggers: Session tracking, analytics, resource allocation

**ConversationTurnCompletedEvent**
- Emitted when a conversation turn completes
- Triggers: History storage, metrics tracking, cost calculation

**ConversationEndedEvent**
- Emitted when a conversation session ends
- Triggers: Session cleanup, analytics, billing

## Event Flow Patterns

### 1. Command-Event Pattern

```
User Action → Command → Service → Event → Subscribers
```

Example: Document Upload
```
Upload Request → ProcessDocumentCommand → DocumentService → DocumentProcessedEvent → [Analytics, Notification, Indexing]
```

### 2. Event Sourcing Pattern

```
Events → Event Store → State Reconstruction
```

Example: Conversation History
```
[ConversationStarted, TurnCompleted, TurnCompleted, ConversationEnded] → Reconstruct Full Conversation
```

### 3. Saga Pattern

```
Event → Saga Coordinator → Multiple Commands → Multiple Events
```

Example: Voice Model Training
```
VoiceModelTrainingStarted → [ProcessAudio, TrainModel, ValidateQuality] → VoiceModelTrained
```

## Topic and Subscription Naming

### Topics
- Format: `{prefix}-{event-type}`
- Example: `clone-user-created`, `clone-document-processed`

### Subscriptions
- Format: `{prefix}-sub-{event-type}`
- Example: `clone-sub-user-created`, `clone-sub-document-processed`

### Dead Letter Topics
- Format: `{prefix}-dead-letter`
- Example: `clone-dead-letter`

## Configuration

### Environment Variables

```bash
# GCP Configuration
GCP_PROJECT_ID=conversational-clone-prod
GCP_REGION=us-central1

# Event Bus Configuration
EVENT_BUS_TOPIC_PREFIX=clone
EVENT_BUS_SUBSCRIPTION_PREFIX=clone-sub
EVENT_BUS_ENABLE_ORDERING=true
EVENT_BUS_ENABLE_BATCHING=true

# Event Store Configuration
EVENT_STORE_TOPIC=clone-event-store
EVENT_STORE_SNAPSHOT_INTERVAL=10

# Dead Letter Queue Configuration
DEAD_LETTER_TOPIC=clone-dead-letter
DEAD_LETTER_SUBSCRIPTION=clone-dead-letter-sub
DEAD_LETTER_RETRY_TOPIC=clone-retry
DEAD_LETTER_MAX_RETRIES=3
```

### GCP Setup

1. **Enable Cloud Pub/Sub API**
```bash
gcloud services enable pubsub.googleapis.com
```

2. **Create Service Account**
```bash
gcloud iam service-accounts create event-bus-sa \
  --display-name="Event Bus Service Account"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:event-bus-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:event-bus-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"
```

3. **Create Topics**
```bash
# Event store topic
gcloud pubsub topics create clone-event-store \
  --message-retention-duration=7d \
  --message-storage-policy-allowed-regions=us-central1

# Dead letter topic
gcloud pubsub topics create clone-dead-letter \
  --message-retention-duration=7d

# Retry topic
gcloud pubsub topics create clone-retry \
  --message-retention-duration=1d
```

4. **Create Subscriptions with Dead Letter Queue**
```bash
gcloud pubsub subscriptions create clone-sub-user-created \
  --topic=clone-user-created \
  --ack-deadline=60 \
  --dead-letter-topic=clone-dead-letter \
  --max-delivery-attempts=5
```

## Monitoring and Observability

### Metrics to Track

1. **Event Publishing**
   - Events published per second
   - Publishing latency
   - Publishing errors

2. **Event Processing**
   - Events processed per second
   - Processing latency
   - Processing errors
   - Retry count

3. **Dead Letter Queue**
   - Messages in DLQ
   - DLQ processing rate
   - Discard rate

4. **Event Store**
   - Events stored per second
   - Storage size
   - Replay operations

### Logging

All event operations are logged with structured logging:

```typescript
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "event-bus",
  "operation": "publish",
  "eventType": "user.created",
  "eventId": "uuid",
  "aggregateId": "user-123",
  "latencyMs": 45
}
```

### Alerting

Set up alerts for:
- High error rate (> 5%)
- Dead letter queue growth
- Publishing latency (> 1s)
- Processing latency (> 5s)

## Best Practices

### 1. Event Design

- **Immutable**: Events should never be modified
- **Self-contained**: Include all necessary data
- **Versioned**: Support schema evolution
- **Timestamped**: Include creation timestamp
- **Identifiable**: Unique event ID

### 2. Event Handlers

- **Idempotent**: Handle duplicate events gracefully
- **Fast**: Process quickly or delegate to async jobs
- **Resilient**: Handle errors and retry
- **Isolated**: Don't depend on other handlers

### 3. Event Ordering

- Use ordering keys for events that must be processed in order
- Group by aggregate ID for consistency
- Be aware of ordering guarantees and limitations

### 4. Error Handling

- Implement retry with exponential backoff
- Use dead letter queues for failed events
- Monitor and alert on failures
- Provide manual intervention tools

### 5. Testing

- Test event handlers in isolation
- Test with various event scenarios
- Test error conditions and retries
- Test event replay functionality

## Performance Considerations

### Publishing

- Use batch publishing for multiple events
- Enable message ordering only when needed
- Configure appropriate batch settings
- Monitor publishing latency

### Subscribing

- Configure flow control to prevent overload
- Use appropriate ack deadline
- Process messages quickly or async
- Monitor processing latency

### Event Store

- Create snapshots for large event streams
- Implement caching for frequently accessed streams
- Archive old events to cold storage
- Monitor storage growth

## Security

### Authentication

- Use service accounts with minimal permissions
- Rotate credentials regularly
- Use Workload Identity for GKE

### Authorization

- Implement topic-level access control
- Restrict subscription creation
- Audit access logs

### Data Protection

- Encrypt sensitive data in events
- Use private topics for sensitive events
- Implement data retention policies
- Comply with GDPR and privacy regulations

## Troubleshooting

### Common Issues

1. **Events not being delivered**
   - Check subscription exists and is active
   - Verify topic permissions
   - Check dead letter queue

2. **High latency**
   - Check network connectivity
   - Verify resource limits
   - Monitor Pub/Sub quotas

3. **Messages in dead letter queue**
   - Inspect failed messages
   - Check error logs
   - Verify handler logic

4. **Event ordering issues**
   - Verify ordering key configuration
   - Check for concurrent processing
   - Review event timestamps

## Related Documentation

- [Database Architecture](./DATABASE-ARCHITECTURE.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [Getting Started](./GETTING-STARTED.md)
