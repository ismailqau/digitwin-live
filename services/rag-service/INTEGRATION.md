# RAG Service Integration Guide

## Overview

The RAG service is designed to be used as a **library/package** within other services (like the API Gateway), not as a standalone microservice. This approach provides:

✅ **Simpler architecture** - No inter-service HTTP calls  
✅ **Better performance** - Direct function calls instead of network requests  
✅ **Lower costs** - One Cloud Run instance instead of multiple  
✅ **Shared resources** - Same database connection pool, caching, etc.  
✅ **Easier development** - One service to run and debug

## Integration Options

### Option 1: Use as Library in API Gateway (Recommended)

The RAG service exports all its functionality as a library that can be imported directly into the API Gateway.

#### Step 1: Import RAG Service in API Gateway

```typescript
// apps/api-gateway/src/index.ts
import { initializeRAGService } from '@clone/rag-service';

// Initialize RAG service
const ragService = initializeRAGService({
  projectId: process.env.GCP_PROJECT_ID || '',
  location: process.env.GCP_REGION || 'us-central1',
  databaseUrl: process.env.DATABASE_URL || '',
  cacheEnabled: process.env.ENABLE_CACHING !== 'false',
  similarityThreshold: 0.7,
  topK: 5,
});
```

#### Step 2: Create RAG Controller in API Gateway

```typescript
// apps/api-gateway/src/controllers/rag.controller.ts
import { Request, Response, NextFunction } from 'express';
import { RAGOrchestrator } from '@clone/rag-service';

export class RAGController {
  constructor(private ragService: RAGOrchestrator) {}

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, knowledgeBaseId } = req.body;
      const userId = req.user?.id || 'anonymous';

      const results = await this.ragService.query({
        query,
        userId,
        conversationHistory: [],
        userProfile: {},
        filters: knowledgeBaseId ? { knowledgeBaseId } : undefined,
      });

      res.json({
        results: results.sources,
        context: results.context,
      });
    } catch (error) {
      next(error);
    }
  }
}
```

#### Step 3: Add RAG Routes to API Gateway

```typescript
// apps/api-gateway/src/routes/v1/rag.routes.ts
import { Router } from 'express';
import { RAGController } from '../../controllers/rag.controller';
import { authenticate } from '../../middleware/auth.middleware';

export function createRAGRoutes(ragController: RAGController): Router {
  const router = Router();

  // Search endpoint
  router.post('/search', authenticate, ragController.search.bind(ragController));

  // Stats endpoint
  router.get('/stats', authenticate, ragController.getStats.bind(ragController));

  return router;
}
```

#### Step 4: Register Routes in API Gateway

```typescript
// apps/api-gateway/src/routes/v1/index.ts
import { createRAGRoutes } from './rag.routes';

// ... other imports

export function createV1Routes(dependencies: Dependencies): Router {
  const router = Router();

  // ... other routes
  router.use('/rag', createRAGRoutes(dependencies.ragController));

  return router;
}
```

### Option 2: Standalone Service (Only if needed)

If you absolutely need RAG as a separate service (e.g., for independent scaling), you can deploy it standalone:

```bash
# Deploy RAG service to Cloud Run
gcloud run deploy rag-service \
  --image gcr.io/PROJECT_ID/rag-service \
  --platform managed \
  --region us-central1
```

Then call it from API Gateway via HTTP:

```typescript
// apps/api-gateway/src/services/rag-client.service.ts
export class RAGClientService {
  private baseUrl = process.env.RAG_SERVICE_URL;

  async search(query: string, knowledgeBaseId?: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, knowledgeBaseId }),
    });
    return response.json();
  }
}
```

## Recommended Architecture

### Single Service Deployment (Recommended)

```
┌─────────────────────────────────────────────────────────┐
│              API Gateway (Cloud Run)                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Auth Routes  │  │ RAG Routes   │  │ Voice Routes │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                  │                  │         │
│  ┌──────▼──────────────────▼──────────────────▼──────┐ │
│  │           RAG Service (Library)                   │ │
│  │  - VectorSearchService                            │ │
│  │  - EmbeddingService                               │ │
│  │  - RAGOrchestrator                                │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ PostgreSQL + pgvector│
                │ - document_chunks    │
                │ - cache tables       │
                └──────────────────────┘
```

**Benefits:**

- ✅ One deployment
- ✅ One database connection pool
- ✅ Shared caching (PostgreSQL-based per guidelines)
- ✅ Lower latency (no HTTP overhead)
- ✅ Lower costs (~$8-15/month vs ~$16-30/month)

### Multi-Service Deployment (Only if needed)

```
┌──────────────────┐         ┌──────────────────┐
│  API Gateway     │  HTTP   │  RAG Service     │
│  (Cloud Run)     │────────▶│  (Cloud Run)     │
└──────────────────┘         └──────────────────┘
         │                            │
         └────────────────┬───────────┘
                          ▼
                ┌──────────────────────┐
                │ PostgreSQL + pgvector│
                └──────────────────────┘
```

**Use cases:**

- Independent scaling requirements
- Different resource limits (CPU/Memory)
- Separate deployment cycles
- Team separation

## Configuration

### Environment Variables

When using RAG as a library in API Gateway, add these to API Gateway's environment:

```bash
# RAG Configuration (already in API Gateway)
DATABASE_URL=postgresql://...
OPENAI_API_KEY=your-key
GCP_PROJECT_ID=your-project
GCP_REGION=us-central1

# RAG-specific settings
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_MAX_RESULTS=10
SIMILARITY_THRESHOLD=0.7

# Caching (PostgreSQL-based per caching-guidelines)
ENABLE_CACHING=true
CACHE_TTL_SHORT=300
CACHE_TTL_MEDIUM=3600
CACHE_TTL_LONG=86400
```

### Package Dependencies

Add to API Gateway's `package.json`:

```json
{
  "dependencies": {
    "@clone/rag-service": "workspace:*"
  }
}
```

## API Endpoints

When integrated into API Gateway, RAG endpoints will be available at:

```
POST /api/v1/rag/search
GET  /api/v1/rag/stats
```

### Example Request

```bash
curl -X POST http://localhost:3000/api/v1/rag/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I configure the service?",
    "knowledgeBaseId": "kb-123",
    "maxResults": 5
  }'
```

### Example Response

```json
{
  "results": [
    {
      "content": "To configure the service...",
      "similarity": 0.89,
      "metadata": {
        "title": "Configuration Guide"
      },
      "source": {
        "documentId": "doc-123",
        "chunkIndex": 2
      }
    }
  ],
  "context": "Assembled context for LLM...",
  "totalResults": 1
}
```

## Testing

### Unit Tests

Test RAG functionality in API Gateway:

```typescript
// apps/api-gateway/src/__tests__/rag.test.ts
import { RAGController } from '../controllers/rag.controller';
import { initializeRAGService } from '@clone/rag-service';

describe('RAG Controller', () => {
  let ragController: RAGController;

  beforeAll(() => {
    const ragService = initializeRAGService({
      projectId: 'test',
      location: 'us-central1',
      databaseUrl: process.env.DATABASE_URL || '',
    });
    ragController = new RAGController(ragService);
  });

  it('should search documents', async () => {
    // Test implementation
  });
});
```

### Integration Tests

Test the full API Gateway with RAG:

```bash
# Start API Gateway (includes RAG)
pnpm --filter @clone/api-gateway dev

# Test RAG endpoint
curl http://localhost:3000/api/v1/rag/search \
  -H "Authorization: Bearer TOKEN" \
  -d '{"query": "test"}'
```

## Deployment

### Deploy API Gateway with RAG (Recommended)

```bash
# Build and deploy API Gateway (includes RAG)
gcloud run deploy api-gateway \
  --image gcr.io/PROJECT_ID/api-gateway \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=... \
  --set-env-vars OPENAI_API_KEY=...
```

### Deploy RAG Separately (Only if needed)

```bash
# Build RAG service
docker build -t gcr.io/PROJECT_ID/rag-service services/rag-service

# Deploy to Cloud Run
gcloud run deploy rag-service \
  --image gcr.io/PROJECT_ID/rag-service \
  --platform managed \
  --region us-central1
```

## Migration Guide

If you have an existing standalone RAG service and want to integrate it into API Gateway:

### Step 1: Update API Gateway Dependencies

```bash
cd apps/api-gateway
pnpm add @clone/rag-service
```

### Step 2: Initialize RAG Service

```typescript
// apps/api-gateway/src/index.ts
import { initializeRAGService } from '@clone/rag-service';

const ragService = initializeRAGService({
  projectId: process.env.GCP_PROJECT_ID || '',
  location: process.env.GCP_REGION || 'us-central1',
  databaseUrl: process.env.DATABASE_URL || '',
});
```

### Step 3: Add RAG Routes

Copy the controller and routes from the integration examples above.

### Step 4: Remove Standalone RAG Service

```bash
# Delete standalone RAG service from Cloud Run
gcloud run services delete rag-service --region us-central1
```

### Step 5: Update Client Code

Replace HTTP calls with direct function calls:

```typescript
// Before (HTTP call)
const response = await fetch('http://rag-service/search', {...});

// After (direct call)
const results = await ragService.query({...});
```

## Performance Comparison

### Library Integration (Recommended)

- **Latency:** ~50-100ms (direct function call)
- **Cost:** ~$8-15/month (one Cloud Run instance)
- **Complexity:** Low (one service)

### Standalone Service

- **Latency:** ~100-200ms (HTTP overhead + function call)
- **Cost:** ~$16-30/month (two Cloud Run instances)
- **Complexity:** Medium (two services, networking)

## Conclusion

**Recommendation:** Use RAG as a library within API Gateway unless you have specific requirements for independent scaling or deployment.

This approach:

- ✅ Simplifies architecture
- ✅ Reduces costs
- ✅ Improves performance
- ✅ Follows caching-guidelines (shared PostgreSQL caching)
- ✅ Easier to develop and maintain

## Support

- **RAG Service README:** [services/rag-service/README.md](./README.md)
- **API Gateway Docs:** [apps/api-gateway/README.md](../../apps/api-gateway/README.md)
- **Architecture Docs:** [docs/](../../docs/)
