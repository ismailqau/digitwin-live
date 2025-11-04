# @clone/cqrs

CQRS (Command Query Responsibility Segregation) pattern implementation for the Real-Time DigitWin Live system.

## Overview

This package provides a complete CQRS implementation that separates read and write operations for improved scalability and performance. It includes:

- **Command Bus**: Routes write operations to their handlers
- **Query Bus**: Routes read operations to their handlers with caching support
- **Materialized Views**: Pre-computed read models in PostgreSQL
- **Eventual Consistency**: Automatic cache invalidation and view refresh
- **Validation & Authorization**: Built-in command validation and authorization

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client    │────────▶│ Command Bus  │────────▶│   Handler    │
└─────────────┘         └──────────────┘         └──────────────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │  Write Model │
                                                   │  (Database)  │
                                                   └──────────────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │    Events    │
                                                   └──────────────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │ Materialized │
                                                   │    Views     │
                                                   └──────────────┘
                                                          ▲
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client    │────────▶│  Query Bus   │────────▶│   Handler    │
└─────────────┘         └──────────────┘         └──────────────┘
```

## Installation

```bash
pnpm add @clone/cqrs
```

## Usage

### 1. Initialize Buses

```typescript
import { CommandBus, QueryBus, EventualConsistencyHandler } from '@clone/cqrs';
import { EventPublisher } from '@clone/event-bus';

// Create event publisher
const eventPublisher = new EventPublisher({
  projectId: 'your-project-id',
});

// Create command bus
const commandBus = new CommandBus({
  eventPublisher,
  enableValidation: true,
  enableAuthorization: true,
});

// Create query bus with caching
const queryBus = new QueryBus({
  enableCaching: true,
  cacheTTL: 60000, // 1 minute
});

// Create consistency handler
const consistencyHandler = new EventualConsistencyHandler(queryBus);
```

### 2. Register Handlers

```typescript
import { CreateUserCommandHandler } from './handlers/CreateUserCommandHandler';
import { GetUserProfileQueryHandler } from './handlers/GetUserProfileQueryHandler';

// Register command handlers
commandBus.register('user.create', new CreateUserCommandHandler());

// Register query handlers
queryBus.register('user.get_profile', new GetUserProfileQueryHandler());
```

### 3. Execute Commands

```typescript
import { v4 as uuidv4 } from 'uuid';

const command: CreateUserCommand = {
  commandId: uuidv4(),
  commandType: 'user.create',
  timestamp: new Date(),
  userId: 'system',
  payload: {
    email: 'user@example.com',
    name: 'John Doe',
    password: 'securepassword',
    subscriptionTier: 'free',
  },
};

const result = await commandBus.execute(command);

if (result.success) {
  console.log('User created:', result.data);
  // Events are automatically published
} else {
  console.error('Command failed:', result.error);
}
```

### 4. Execute Queries

```typescript
const query: GetUserProfileQuery = {
  queryId: uuidv4(),
  queryType: 'user.get_profile',
  timestamp: new Date(),
  userId: 'user-123',
  payload: {
    userId: 'user-123',
  },
};

const result = await queryBus.execute(query);

if (result.success) {
  console.log('User profile:', result.data);
  console.log('From cache:', result.fromCache);
} else {
  console.error('Query failed:', result.error);
}
```

### 5. Handle Eventual Consistency

```typescript
import { DEFAULT_CONSISTENCY_RULES } from '@clone/cqrs';

// Register default consistency rules
for (const rule of DEFAULT_CONSISTENCY_RULES) {
  consistencyHandler.registerRule(rule);
}

// Handle events from event bus
eventSubscriber.on('user.created', async (event) => {
  await consistencyHandler.handleEvent(event);
});
```

## Creating Custom Handlers

### Command Handler

```typescript
import { BaseCommandHandler } from '@clone/cqrs';
import { CreateUserCommand } from '@clone/cqrs';
import { CommandResult } from '@clone/cqrs';

export class CreateUserCommandHandler extends BaseCommandHandler<
  CreateUserCommand,
  { userId: string }
> {
  protected async validateCommand(command: CreateUserCommand): Promise<string[]> {
    const violations: string[] = [];

    if (!command.payload.email) {
      violations.push('email is required');
    }

    return violations;
  }

  async handle(command: CreateUserCommand): Promise<CommandResult<{ userId: string }>> {
    try {
      // Perform write operation
      const userId = await this.userRepository.create(command.payload);

      // Create domain event
      const event = {
        eventId: uuidv4(),
        eventType: 'user.created',
        timestamp: new Date(),
        aggregateId: userId,
        aggregateType: 'user',
        version: 1,
        payload: { userId, ...command.payload },
      };

      return this.success({ userId }, [event]);
    } catch (error) {
      return this.error(error as Error);
    }
  }
}
```

### Query Handler

```typescript
import { BaseQueryHandler } from '@clone/cqrs';
import { GetUserProfileQuery } from '@clone/cqrs';
import { QueryResult } from '@clone/cqrs';

export class GetUserProfileQueryHandler extends BaseQueryHandler<
  GetUserProfileQuery,
  UserProfileDTO
> {
  async handle(query: GetUserProfileQuery): Promise<QueryResult<UserProfileDTO>> {
    try {
      // Query materialized view
      const profile = await this.db.query('SELECT * FROM user_profile_view WHERE id = $1', [
        query.payload.userId,
      ]);

      return this.success(profile);
    } catch (error) {
      return this.error(error as Error);
    }
  }
}
```

## Materialized Views

The package includes SQL migrations for creating materialized views:

- `user_profile_view`: Aggregated user data with active models
- `conversation_session_summary_view`: Conversation sessions with metrics
- `document_summary_view`: Document processing status
- `user_statistics_view`: User usage statistics
- `voice_model_summary_view`: Voice model usage
- `face_model_summary_view`: Face model usage

### Refreshing Views

```sql
-- Refresh all views
SELECT refresh_all_materialized_views();

-- Refresh specific view
REFRESH MATERIALIZED VIEW CONCURRENTLY user_profile_view;
```

## Benefits

1. **Scalability**: Separate read and write models can be scaled independently
2. **Performance**: Materialized views provide fast read operations
3. **Flexibility**: Different data models for reads and writes
4. **Consistency**: Eventual consistency with automatic cache invalidation
5. **Maintainability**: Clear separation of concerns

## Best Practices

1. **Commands**: Use for all write operations that change state
2. **Queries**: Use for all read operations
3. **Validation**: Always validate commands before execution
4. **Authorization**: Check user permissions in command handlers
5. **Events**: Emit domain events for all state changes
6. **Caching**: Enable query caching for frequently accessed data
7. **Views**: Refresh materialized views based on event patterns

## Performance Considerations

- Query caching reduces database load
- Materialized views provide O(1) read performance
- Eventual consistency allows for high write throughput
- Concurrent view refresh minimizes locking

## Related Packages

- `@clone/event-bus`: Event publishing and subscription
- `@clone/database`: Database access and repositories
- `@clone/logger`: Structured logging
- `@clone/errors`: Error handling

## License

MIT
