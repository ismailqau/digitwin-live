---
inclusion: always
---

# Service Patterns

## Microservice Architecture

See `project-overview.md` for the full list of services and monorepo structure.

## Service Structure

Each service follows this structure:

```
services/my-service/
├── src/
│   ├── index.ts           # Entry point
│   ├── service.ts         # Main service class
│   ├── handlers/          # Request handlers
│   ├── providers/         # External provider integrations
│   └── utils/             # Service-specific utilities
├── jest.config.js
├── jest.setup.ts
├── package.json
└── tsconfig.json
```

## Service Dependencies

Services use shared packages:

```json
{
  "dependencies": {
    "@clone/shared-types": "workspace:*",
    "@clone/logger": "workspace:*",
    "@clone/errors": "workspace:*",
    "@clone/config": "workspace:*"
  }
}
```

## Logging & Error Handling

See `error-handling.md` for error handling patterns and logging guidelines.

## Configuration

Services use environment-based configuration:

```typescript
import { config } from '@clone/config';

const port = config.get('PORT');
const databaseUrl = config.get('DATABASE_URL');
```

## Health Checks

All services implement health check endpoints:

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'my-service' });
});

app.get('/ready', async (req, res) => {
  // Check dependencies
  const dbHealthy = await checkDatabase();
  if (dbHealthy) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});
```

## Inter-Service Communication

Services communicate via:

1. **gRPC**: For synchronous service-to-service calls
2. **Event Bus**: For asynchronous events (Google Cloud Pub/Sub)
3. **HTTP**: For external API calls

```typescript
// gRPC client
import { createGrpcClient } from '@clone/grpc-proto';

const ragClient = createGrpcClient('rag-service');
const result = await ragClient.search({ query, userId });

// Event publishing
import { EventPublisher } from '@clone/event-bus';

await publisher.publish({
  type: 'document.processed',
  data: { documentId, userId },
});
```

## Service Authentication

Services authenticate using JWT tokens:

```typescript
import { verifyServiceToken } from '@clone/service-auth';

// Middleware for service-to-service auth
const serviceAuth = async (req, res, next) => {
  const token = req.headers['x-service-token'];
  const verified = await verifyServiceToken(token);
  if (!verified) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
```
