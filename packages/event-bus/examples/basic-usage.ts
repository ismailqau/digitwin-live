/**
 * Basic Usage Examples for Event Bus
 * 
 * This file demonstrates how to use the event-driven architecture
 * components in the Conversational Clone system.
 */

import {
  EventPublisher,
  EventSubscriber,
  EventStore,
  EventReplayer,
  DeadLetterQueueHandler,
  createEvent,
  UserCreatedEvent,
  DocumentProcessedEvent,
  ConversationTurnCompletedEvent,
} from '@clone/event-bus';

// Configuration
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'your-project-id';

/**
 * Example 1: Publishing Events
 */
async function publishingExample() {
  const publisher = new EventPublisher({
    projectId: GCP_PROJECT_ID,
    topicPrefix: 'clone',
    enableOrdering: true,
    enableBatching: true,
  });

  // Create and publish a user created event
  const userEvent = createEvent<UserCreatedEvent>(
    'user.created',
    'user-123',
    'user',
    {
      userId: 'user-123',
      email: 'john@example.com',
      name: 'John Doe',
      subscriptionTier: 'free',
    }
  );

  const result = await publisher.publish(userEvent);
  console.log('Event published:', result);

  // Batch publish multiple events
  const events = [
    createEvent<DocumentProcessedEvent>(
      'document.processed',
      'doc-456',
      'knowledge_document',
      {
        documentId: 'doc-456',
        userId: 'user-123',
        filename: 'resume.pdf',
        contentType: 'application/pdf',
        chunkCount: 10,
        vectorIds: ['vec-1', 'vec-2'],
        processingDurationMs: 5000,
      }
    ),
  ];

  await publisher.publishBatch(events);
  console.log('Batch published');

  await publisher.close();
}

/**
 * Example 2: Subscribing to Events
 */
async function subscribingExample() {
  const subscriber = new EventSubscriber({
    projectId: GCP_PROJECT_ID,
    subscriptionPrefix: 'clone-sub',
    ackDeadlineSeconds: 60,
  });

  // Subscribe to user created events
  await subscriber.subscribe({
    eventType: 'user.created',
    handler: async (event: UserCreatedEvent) => {
      console.log('User created:', event.payload);
      
      // Send welcome email
      // await sendWelcomeEmail(event.payload.email);
      
      // Track analytics
      // await trackUserSignup(event.payload.userId);
    },
    deadLetterTopic: 'clone-dead-letter',
    maxDeliveryAttempts: 5,
  });

  // Subscribe to document processed events
  await subscriber.subscribe({
    eventType: 'document.processed',
    handler: async (event: DocumentProcessedEvent) => {
      console.log('Document processed:', event.payload);
      
      // Notify user
      // await notifyUser(event.payload.userId, 'Document ready');
      
      // Update analytics
      // await trackDocumentProcessing(event.payload.documentId);
    },
    deadLetterTopic: 'clone-dead-letter',
    maxDeliveryAttempts: 5,
  });

  console.log('Subscriptions active. Press Ctrl+C to exit.');
  
  // Keep process running
  await new Promise(() => {});
}

/**
 * Example 3: Event Sourcing
 */
async function eventSourcingExample() {
  const eventStore = new EventStore({
    projectId: GCP_PROJECT_ID,
    eventStoreTopic: 'clone-event-store',
    snapshotInterval: 10,
  });

  const sessionId = 'session-789';

  // Append conversation events
  const events = [
    createEvent<ConversationTurnCompletedEvent>(
      'conversation.turn_completed',
      sessionId,
      'conversation_session',
      {
        sessionId,
        turnId: 'turn-1',
        userId: 'user-123',
        userTranscript: 'What is my schedule today?',
        systemResponse: 'You have 3 meetings scheduled...',
        latencyMs: 1500,
        cost: 0.05,
      },
      1
    ),
    createEvent<ConversationTurnCompletedEvent>(
      'conversation.turn_completed',
      sessionId,
      'conversation_session',
      {
        sessionId,
        turnId: 'turn-2',
        userId: 'user-123',
        userTranscript: 'Tell me about the first meeting',
        systemResponse: 'Your first meeting is at 10 AM...',
        latencyMs: 1200,
        cost: 0.04,
      },
      2
    ),
  ];

  await eventStore.appendEvents(events);
  console.log('Events stored');

  // Reconstruct conversation state
  interface ConversationState {
    sessionId: string;
    turns: Array<{ user: string; system: string }>;
    totalCost: number;
  }

  const state = await eventStore.reconstructState<ConversationState>(
    sessionId,
    'conversation_session',
    (state, event) => {
      if (event.eventType === 'conversation.turn_completed') {
        const payload = (event as ConversationTurnCompletedEvent).payload;
        return {
          ...state,
          turns: [
            ...state.turns,
            {
              user: payload.userTranscript,
              system: payload.systemResponse,
            },
          ],
          totalCost: state.totalCost + payload.cost,
        };
      }
      return state;
    },
    {
      sessionId,
      turns: [],
      totalCost: 0,
    }
  );

  console.log('Reconstructed state:', state);
}

/**
 * Example 4: Event Replay
 */
async function eventReplayExample() {
  const replayer = new EventReplayer({
    projectId: GCP_PROJECT_ID,
    eventStoreTopic: 'clone-event-store',
    replaySubscription: 'clone-replay',
  });

  // Replay events from last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();

  const count = await replayer.replayTimeRange(
    yesterday,
    now,
    async (event) => {
      console.log('Replaying event:', event.eventType, event.eventId);
      // Process event for debugging or state reconstruction
    }
  );

  console.log(`Replayed ${count} events`);

  // Replay specific event types
  await replayer.replayEventTypes(
    ['user.created', 'document.processed'],
    async (event) => {
      console.log('Replaying:', event);
    }
  );
}

/**
 * Example 5: Dead Letter Queue Handling
 */
async function deadLetterQueueExample() {
  const dlqHandler = new DeadLetterQueueHandler({
    projectId: GCP_PROJECT_ID,
    deadLetterTopic: 'clone-dead-letter',
    deadLetterSubscription: 'clone-dead-letter-sub',
    retryTopic: 'clone-retry',
    maxRetries: 3,
  });

  // Start processing dead letter queue
  await dlqHandler.startProcessing(async (message) => {
    console.log('Failed event:', message.originalEvent.eventType);
    console.log('Error:', message.errorMessage);
    console.log('Attempts:', message.deliveryAttempts);

    // Decide what to do with failed event
    if (message.deliveryAttempts < 3) {
      // Retry if under max attempts
      return 'retry';
    } else if (message.errorMessage.includes('temporary')) {
      // Retry temporary errors
      return 'retry';
    } else {
      // Discard permanent errors
      return 'discard';
    }
  });

  // Get statistics
  const stats = await dlqHandler.getStatistics();
  console.log('DLQ Statistics:', stats);

  // Inspect messages
  const messages = await dlqHandler.inspectMessages(5);
  console.log('Failed messages:', messages);
}

/**
 * Example 6: Complete Workflow
 */
async function completeWorkflowExample() {
  // 1. Set up publisher and subscriber
  const publisher = new EventPublisher({
    projectId: GCP_PROJECT_ID,
    topicPrefix: 'clone',
    enableOrdering: true,
  });

  const subscriber = new EventSubscriber({
    projectId: GCP_PROJECT_ID,
    subscriptionPrefix: 'clone-sub',
  });

  const eventStore = new EventStore({
    projectId: GCP_PROJECT_ID,
    eventStoreTopic: 'clone-event-store',
  });

  // 2. Subscribe to events
  await subscriber.subscribe({
    eventType: 'user.created',
    handler: async (event: UserCreatedEvent) => {
      console.log('Processing user creation:', event.payload.userId);
      
      // Store in event store for audit trail
      await eventStore.appendEvent(event);
      
      // Trigger downstream processes
      // - Send welcome email
      // - Create default settings
      // - Track analytics
    },
    deadLetterTopic: 'clone-dead-letter',
  });

  // 3. Publish event
  const userEvent = createEvent<UserCreatedEvent>(
    'user.created',
    'user-new',
    'user',
    {
      userId: 'user-new',
      email: 'newuser@example.com',
      name: 'New User',
      subscriptionTier: 'free',
    }
  );

  await publisher.publish(userEvent);
  console.log('User creation event published');

  // 4. Event will be processed by subscriber
  // 5. Failed events will go to dead letter queue
  // 6. All events stored in event store for replay
}

// Run examples
if (require.main === module) {
  const example = process.argv[2] || 'publishing';

  switch (example) {
    case 'publishing':
      publishingExample().catch(console.error);
      break;
    case 'subscribing':
      subscribingExample().catch(console.error);
      break;
    case 'event-sourcing':
      eventSourcingExample().catch(console.error);
      break;
    case 'replay':
      eventReplayExample().catch(console.error);
      break;
    case 'dlq':
      deadLetterQueueExample().catch(console.error);
      break;
    case 'complete':
      completeWorkflowExample().catch(console.error);
      break;
    default:
      console.log('Unknown example. Available: publishing, subscribing, event-sourcing, replay, dlq, complete');
  }
}
