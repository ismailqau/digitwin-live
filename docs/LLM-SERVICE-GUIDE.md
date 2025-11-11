# LLM Service Guide

## Overview

The LLM Service provides a unified interface for multiple Large Language Model providers with built-in fallback logic, caching, and cost tracking. It supports Gemini Flash/Pro, OpenAI GPT-4, and Groq Llama models.

## Features

- **Multi-Provider Support**: Seamlessly switch between Gemini, OpenAI, and Groq
- **Automatic Fallback**: If primary provider fails, automatically tries fallback providers
- **Circuit Breaker Pattern**: Prevents cascading failures with automatic recovery
- **PostgreSQL Caching**: Caches responses using indexed PostgreSQL tables
- **Cost Tracking**: Tracks usage costs per provider and conversation
- **Streaming Support**: Real-time token streaming for all providers
- **Context Management**: Manages conversation history with token optimization
- **Prompt Templates**: Flexible prompt templating system
- **Sentence Buffering**: Buffers streaming tokens into complete sentences for TTS

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LLM Service   │────│ Provider Factory │────│   Providers     │
│                 │    │                  │    │ • Gemini        │
│ • Fallback      │    │ • Circuit Breaker│    │ • OpenAI        │
│ • Caching       │    │ • Health Checks  │    │ • Groq          │
│ • Cost Tracking │    │ • Metrics        │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Context Manager │    │   Cache Service  │    │  Cost Tracker   │
│                 │    │                  │    │                 │
│ • History       │    │ • PostgreSQL     │    │ • Per Provider  │
│ • Optimization  │    │ • TTL Management │    │ • Per Session   │
│ • Compression   │    │ • Cleanup        │    │ • Daily Totals  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Installation

```bash
pnpm install @clone/llm-service
```

### 2. Basic Usage

```typescript
import { LLMService, LLMProvider } from '@clone/llm-service';
import { PrismaClient } from '@clone/database';

const db = new PrismaClient();

const config = {
  primaryProvider: LLMProvider.GEMINI_FLASH,
  fallbackProviders: [LLMProvider.GPT4, LLMProvider.GROQ_LLAMA],
  enableCaching: true,
  enableCircuitBreaker: true,
  providerConfigs: {
    [LLMProvider.GEMINI_FLASH]: {
      projectId: 'your-gcp-project',
      location: 'us-central1',
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-1.5-flash',
      maxRetries: 3,
      timeout: 30000,
    },
    [LLMProvider.GPT4]: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4-turbo',
      maxRetries: 3,
      timeout: 30000,
    },
    [LLMProvider.GROQ_LLAMA]: {
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama3-8b-8192',
      maxRetries: 3,
      timeout: 30000,
    },
  },
};

const llmService = new LLMService(config, db);
await llmService.initialize();
```

### 3. Generate Response

```typescript
const context = {
  systemPrompt: 'You are a helpful AI assistant.',
  userPersonality: 'Friendly and professional',
  relevantKnowledge: ['User prefers concise answers'],
  conversationHistory: 'User: Hello\nAssistant: Hi there!',
  currentQuery: "What's the weather like?",
  userId: 'user123',
  sessionId: 'session456',
};

const config = {
  provider: LLMProvider.GEMINI_FLASH,
  model: 'gemini-1.5-flash',
  temperature: 0.7,
  maxTokens: 1000,
  streamingEnabled: false,
};

const response = await llmService.generateResponse(context, config);
console.log(response.content);
```

### 4. Streaming Response

```typescript
const streamConfig = { ...config, streamingEnabled: true };

for await (const chunk of llmService.generateStreamingResponse(context, streamConfig)) {
  if (!chunk.isComplete) {
    process.stdout.write(chunk.token);
  } else {
    console.log('\nResponse complete:', chunk.usage);
  }
}
```

## Provider Configuration

### Gemini (Vertex AI)

```typescript
{
  [LLMProvider.GEMINI_FLASH]: {
    projectId: 'your-gcp-project-id',
    location: 'us-central1', // or your preferred region
    apiKey: process.env.GOOGLE_API_KEY,
    model: 'gemini-1.5-flash', // or 'gemini-1.5-pro'
    maxRetries: 3,
    timeout: 30000,
  }
}
```

### OpenAI

```typescript
{
  [LLMProvider.GPT4]: {
    apiKey: process.env.OPENAI_API_KEY,
    organization: 'your-org-id', // optional
    model: 'gpt-4-turbo', // or 'gpt-4', 'gpt-3.5-turbo'
    maxRetries: 3,
    timeout: 30000,
  }
}
```

### Groq

```typescript
{
  [LLMProvider.GROQ_LLAMA]: {
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama3-8b-8192', // or 'llama3-70b-8192', 'mixtral-8x7b-32768'
    maxRetries: 3,
    timeout: 30000,
  }
}
```

## Advanced Features

### Context Management

```typescript
import { ContextManager } from '@clone/llm-service';

const contextManager = new ContextManager(db, {
  maxTurns: 10,
  maxTokens: 4000,
  compressionThreshold: 20,
  retentionHours: 24,
});

// Add conversation turn
await contextManager.addTurn(
  'session123',
  'user456',
  'user',
  'What is machine learning?',
  ['doc1', 'doc2'] // optional sources
);

// Get formatted history
const history = await contextManager.getFormattedHistory('session123', 5);
```

### Prompt Templates

```typescript
import { PromptTemplateService } from '@clone/llm-service';

const promptService = new PromptTemplateService();

const prompt = promptService.buildPrompt({
  userName: 'Alice',
  personalityTraits: ['helpful', 'concise', 'technical'],
  relevantKnowledge: ['Machine learning basics', 'Python programming'],
  conversationHistory: [],
  currentQuery: 'Explain neural networks',
  responseStyle: 'educational',
});
```

### Sentence Buffering

```typescript
import { SentenceBuffer } from '@clone/llm-service';

const buffer = new SentenceBuffer({
  minSentenceLength: 10,
  maxBufferTime: 3000,
  sentenceEndMarkers: ['.', '!', '?'],
});

// Process streaming tokens
for await (const chunk of streamingResponse) {
  const sentences = buffer.addToken(chunk.token);

  for (const sentence of sentences) {
    if (sentence.isComplete) {
      // Send complete sentence to TTS
      await ttsService.synthesize(sentence.text);
    }
  }
}

// Flush remaining content
const remaining = buffer.flushBuffer();
if (remaining) {
  await ttsService.synthesize(remaining.text);
}
```

### Cost Tracking

```typescript
import { CostTracker } from '@clone/llm-service';

const costTracker = new CostTracker();

// Track response cost (automatically called by LLMService)
costTracker.trackResponse('session123', 'user456', response);

// Get cost statistics
const stats = costTracker.getCostStatistics();
console.log('Total cost:', stats.totalCost);
console.log('Average per conversation:', stats.averageCostPerConversation);

// Get provider breakdown
const providerCosts = costTracker.getProviderCostSummary();
providerCosts.forEach((summary) => {
  console.log(`${summary.provider}: $${summary.totalCost}`);
});
```

## Caching

The service uses PostgreSQL for caching with the following table structure:

```sql
CREATE TABLE cache_llm_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) NOT NULL,
  cache_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_cache_llm_responses_key ON cache_llm_responses(cache_key);
CREATE INDEX idx_cache_llm_responses_expires ON cache_llm_responses(expires_at);
```

### Cache Configuration

```bash
# Environment variables
ENABLE_CACHING=true
CACHE_TTL_MEDIUM=3600  # 1 hour for LLM responses
```

### Cache Management

```typescript
// Clear cache
await llmService.clearCache();

// Get cache statistics
const cacheService = new LLMCacheService(db);
const stats = await cacheService.getStats();
console.log('Cache entries:', stats.totalEntries);
console.log('Cache size:', stats.cacheSize);

// Cleanup expired entries
const deletedCount = await cacheService.cleanup();
console.log('Cleaned up entries:', deletedCount);
```

## Circuit Breaker

The circuit breaker prevents cascading failures by temporarily disabling failing providers:

- **Closed**: Normal operation
- **Open**: Provider disabled due to failures
- **Half-Open**: Testing if provider has recovered

### Configuration

```typescript
const circuitBreakerConfig = {
  failureThreshold: 5, // Failures before opening
  recoveryTimeout: 60000, // Time before retry (ms)
  monitoringPeriod: 300000, // Failure counting window (ms)
  successThreshold: 3, // Successes needed to close
};
```

## Monitoring and Metrics

### Service Metrics

```typescript
const metrics = llmService.getMetrics();

console.log('Service metrics:', metrics.service);
console.log('Provider metrics:', metrics.providers);
console.log('Circuit breaker status:', metrics.circuitBreakers);
console.log('Cache hit rate:', metrics.cache.hitRate);
```

### Health Checks

```typescript
const healthStatus = await llmService.getHealthStatus();

Object.entries(healthStatus).forEach(([provider, isHealthy]) => {
  console.log(`${provider}: ${isHealthy ? 'healthy' : 'unhealthy'}`);
});
```

## Error Handling

The service provides specific error types for different failure scenarios:

```typescript
import {
  LLMError,
  ProviderUnavailableError,
  RateLimitError,
  ContentFilterError,
} from '@clone/llm-service';

try {
  const response = await llmService.generateResponse(context, config);
} catch (error) {
  if (error instanceof ContentFilterError) {
    console.log('Content was filtered:', error.message);
  } else if (error instanceof RateLimitError) {
    console.log('Rate limit exceeded:', error.message);
  } else if (error instanceof ProviderUnavailableError) {
    console.log('Provider unavailable:', error.message);
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

## Best Practices

### 1. Provider Selection

- Use **Gemini Flash** for fast, cost-effective responses
- Use **Gemini Pro** for complex reasoning tasks
- Use **GPT-4** for highest quality responses
- Use **Groq Llama** for free tier or ultra-fast inference

### 2. Fallback Strategy

```typescript
// Recommended fallback order
const config = {
  primaryProvider: LLMProvider.GEMINI_FLASH, // Fast and cheap
  fallbackProviders: [
    LLMProvider.GROQ_LLAMA, // Free tier backup
    LLMProvider.GPT4, // High quality backup
  ],
};
```

### 3. Context Optimization

- Keep conversation history under 5 turns for optimal performance
- Use context compression for long conversations
- Implement smart context pruning based on relevance

### 4. Cost Management

- Enable caching for frequently asked questions
- Use cheaper models for simple queries
- Monitor daily costs and set alerts
- Implement user-based rate limiting

### 5. Performance Optimization

- Use streaming for real-time applications
- Implement sentence buffering for TTS integration
- Pre-warm connections during initialization
- Monitor and optimize prompt lengths

## Troubleshooting

### Common Issues

1. **Provider Authentication Errors**
   - Verify API keys are correct and have proper permissions
   - Check project IDs and regions for Gemini
   - Ensure organization IDs are set for OpenAI if required

2. **High Latency**
   - Check network connectivity to provider APIs
   - Monitor circuit breaker status
   - Verify prompt lengths are optimized
   - Consider using faster models

3. **Cache Misses**
   - Verify cache is enabled in configuration
   - Check database connectivity
   - Monitor cache cleanup frequency
   - Ensure cache keys are consistent

4. **Cost Overruns**
   - Implement rate limiting per user
   - Monitor provider cost breakdowns
   - Use cheaper models for simple queries
   - Enable aggressive caching

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
// Set environment variable
process.env.LOG_LEVEL = 'debug';

// Or configure logger directly
import { logger } from '@clone/logger';
logger.level = 'debug';
```

## API Reference

See the [API Reference](./API-REFERENCE.md) for detailed documentation of all classes and methods.

## Related Documentation

- [RAG Service Integration](./RAG-SERVICE-INTEGRATION.md)
- [TTS Service Integration](./TTS-SERVICE-INTEGRATION.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [Cost Optimization Guide](./COST-OPTIMIZATION.md)
