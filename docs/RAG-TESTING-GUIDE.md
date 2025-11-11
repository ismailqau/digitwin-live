# RAG Pipeline Testing Guide

## Overview

This document provides guidance on testing the RAG (Retrieval-Augmented Generation) pipeline components in the real-time conversational clone system.

## Test Coverage

### Core Components Tested

1. **EmbeddingService** - Tests for Vertex AI embedding generation with mocked API calls
2. **TextChunker** - Tests for text chunking with various sizes and overlaps
3. **ContextAssembler** - Tests for context assembly from search results and conversation history
4. **CacheService** - Tests for PostgreSQL-based caching with TTL handling
5. **QueryOptimizer** - Tests for query preprocessing and result optimization
6. **RAGOrchestrator** - Integration tests for the complete RAG flow
7. **DocumentProcessor** - Tests for document validation and processing
8. **FAQ Priority Handling** - Tests for FAQ prioritization and source ranking

### Integration Tests

- **RAG Pipeline Core** - End-to-end integration tests for core RAG functionality
- **Performance Tests** - Tests for concurrent processing and large data handling
- **Error Handling** - Comprehensive error scenarios and graceful degradation

### Performance Tests

- **Concurrent Processing** - Tests for handling multiple simultaneous requests
- **Large Text Processing** - Tests for efficient handling of large documents
- **Memory Efficiency** - Tests for large context assembly without memory leaks

### Cache Testing

- **Cache Hit/Miss Scenarios** - Tests for cache effectiveness and TTL behavior
- **User Data Isolation** - Tests ensuring users cannot access each other's cached data
- **Cache Cleanup** - Tests for automatic cleanup of expired entries

## Key Testing Patterns

### Mocking Strategy

- **External APIs**: All external services (Vertex AI, PostgreSQL) are mocked
- **Database Operations**: Prisma client operations are mocked for unit tests
- **Service Dependencies**: Services are mocked when testing orchestration layers

### Error Scenarios Tested

- Network timeouts and connection failures
- Rate limiting and authentication errors
- Database connection issues and query failures
- Cache corruption and cleanup failures
- Malformed data and validation errors

### Performance Benchmarks

- Embedding generation: < 1 second for mock operations
- Vector search: < 1 second for 100K vector simulation
- Context assembly: < 100ms for large contexts
- Cache operations: < 50ms for concurrent requests

## Running Tests

```bash
# Run all RAG service tests
cd services/rag-service
npm test

# Run with single worker to avoid hanging
npm test -- --maxWorkers=1

# Run specific test files
npm test -- EmbeddingService.test.ts
npm test -- TextChunker.test.ts
npm test -- RAGPipelineCore.test.ts

# Run with coverage
npm test -- --coverage
```

## Test Configuration

Tests use the following configuration:

- **Cache TTL**: Short (300s), Medium (3600s), Long (86400s)
- **Vector Dimensions**: 768 (matching Google text-embedding-004)
- **Chunk Sizes**: 500-1000 tokens with 100 token overlap
- **Similarity Threshold**: 0.7 for vector search

## PostgreSQL Caching

All tests follow the PostgreSQL caching architecture:

- Cache tables: `cache_embeddings`, `cache_vector_searches`, `cache_llm_responses`
- TTL-based expiration with automatic cleanup
- User data isolation through userId filtering
- No Redis or external caching dependencies

## Related Documentation

- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [Vector Database Setup](./VECTOR-DATABASE.md)
- [RAG Source Tracking](./RAG-SOURCE-TRACKING.md)
- [Testing Guide](./TESTING-GUIDE.md)
