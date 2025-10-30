# @clone/event-bus

Event-driven architecture implementation using Google Cloud Pub/Sub for the Conversational Clone system.

## Features

- **Event Publisher**: Publish domain events to Pub/Sub topics
- **Event Subscriber**: Subscribe to and handle domain events
- **Event Sourcing**: Store and replay events for state reconstruction
- **Event Replay**: Debug and reconstruct state by replaying historical events
- **Dead Letter Queue**: Handle failed events with retry mechanisms

## Installation

```bash
pnpm install @clone/event-bus
```

## Usage

### Publishing Events

```typescript
import { EventPublisher, createEvent, UserCreatedEvent } from '@clone/event-bus';

const publisher = new EventPublisher({
  projectId: 'your-gcp-project',
  topicPrefix: 'clone',
  enableOrdering: true,
});

const event = createEvent<UserCreatedEvent>('user.created', userId, 'user', {
  userId,
  email: 'user@example.com',
  name: 'John Doe',
  subscriptionTier: 'free',
});

await publisher.publish(event);
```

### Subscribing to Events

```typescript
import { EventSubscriber, UserCreatedEvent } from '@clone/event-bus';

const subscriber = new EventSubscriber({
  projectId: 'your-gcp-project',
  subscriptionPrefix: 'clone-sub',
});

await subscriber.subscribe({
  eventType: 'user.created',
  handler: async (event: UserCreatedEvent) => {
    console.log('User created:', event.payload);
    // Handle the event
  },
  deadLetterTopic: 'clone-dead-letter',
  maxDeliveryAttempts: 5,
});
```

### Event Sourcing

```typescript
import { EventStore } from '@clone/event-bus';

const eventStore = new EventStore({
  projectId: 'your-gcp-project',
  eventStoreTopic: 'clone-event-store',
  snapshotInterval: 10,
});

// Append events
await eventStore.appendEvent(event);

// Reconstruct state
const conversationState = await eventStore.reconstructState(
  sessionId,
  'conversation_session',
  (state, event) => {
    // Reducer function to apply events
    return { ...state /* updated state */ };
  },
  initialState
);
```

### Event Replay

```typescript
import { EventReplayer } from '@clone/event-bus';

const replayer = new EventReplayer({
  projectId: 'your-gcp-project',
  eventStoreTopic: 'clone-event-store',
  replaySubscription: 'clone-replay',
});

// Replay events for debugging
await replayer.replayTimeRange(new Date('2024-01-01'), new Date('2024-01-31'), async (event) => {
  console.log('Replaying event:', event);
});
```

### Dead Letter Queue

```typescript
import { DeadLetterQueueHandler } from '@clone/event-bus';

const dlqHandler = new DeadLetterQueueHandler({
  projectId: 'your-gcp-project',
  deadLetterTopic: 'clone-dead-letter',
  deadLetterSubscription: 'clone-dead-letter-sub',
  retryTopic: 'clone-retry',
  maxRetries: 3,
});

await dlqHandler.startProcessing(async (message) => {
  // Inspect failed message
  console.log('Failed event:', message.originalEvent);

  // Decide action: 'retry', 'discard', or 'manual'
  if (message.deliveryAttempts < 3) {
    return 'retry';
  }
  return 'discard';
});
```

## Domain Events

The package includes the following domain events:

- `UserCreatedEvent`: User registration
- `VoiceModelTrainedEvent`: Voice model training completion
- `DocumentProcessedEvent`: Knowledge document processing completion
- `FaceModelCreatedEvent`: Face model creation completion
- `ConversationStartedEvent`: Conversation session start
- `ConversationTurnCompletedEvent`: Conversation turn completion
- `ConversationEndedEvent`: Conversation session end
- `DocumentProcessingFailedEvent`: Document processing failure
- `VoiceModelTrainingFailedEvent`: Voice model training failure
- `FaceModelCreationFailedEvent`: Face model creation failure

## Configuration

### Environment Variables

```bash
GCP_PROJECT_ID=your-gcp-project
EVENT_BUS_TOPIC_PREFIX=clone
EVENT_BUS_SUBSCRIPTION_PREFIX=clone-sub
EVENT_STORE_TOPIC=clone-event-store
DEAD_LETTER_TOPIC=clone-dead-letter
```

### GCP Setup

1. Enable Cloud Pub/Sub API
2. Create service account with Pub/Sub permissions
3. Set up topics and subscriptions
4. Configure dead letter queues

## Architecture

The event bus follows these patterns:

- **Event-Driven Architecture**: Loose coupling between services
- **Event Sourcing**: Complete audit trail and state reconstruction
- **CQRS**: Separate read and write models
- **Dead Letter Queue**: Reliable event processing with retries

## Best Practices

1. **Event Versioning**: Include version in events for schema evolution
2. **Idempotency**: Ensure event handlers are idempotent
3. **Ordering**: Use ordering keys for events that must be processed in order
4. **Monitoring**: Track event processing metrics and failures
5. **Testing**: Test event handlers with various scenarios

## License

MIT
