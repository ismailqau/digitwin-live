# TTS Service

Text-to-Speech service with multi-provider support and voice cloning capabilities.

## Features

- **Multi-Provider Support**: Google Cloud TTS, OpenAI TTS, and XTTS-v2
- **Voice Cloning**: Support for custom voice models
- **Streaming**: Real-time audio streaming
- **Caching**: PostgreSQL-based caching for performance
- **Fallback Logic**: Automatic provider fallback on failures
- **Cost Tracking**: Per-provider cost estimation and tracking

## Supported Providers

### Google Cloud TTS

- High-quality neural voices
- Custom voice model support
- Multiple languages and accents
- Pricing: $4.00 per 1M characters

### OpenAI TTS

- Predefined voices: alloy, echo, fable, onyx, nova, shimmer
- Models: tts-1 ($15/1M chars), tts-1-hd ($30/1M chars)
- High-quality audio output
- Fast synthesis

### XTTS-v2 (GPU Required)

- Custom voice cloning from samples
- Real-time synthesis
- GPU-accelerated processing
- Cost based on GPU compute time

## API Endpoints

### Health Check

```
GET /health
```

### Synthesize Speech

```
POST /synthesize
Content-Type: application/json

{
  "text": "Hello world",
  "provider": "openai-tts",
  "voiceModelId": "alloy",
  "options": {
    "sampleRate": 22050,
    "speed": 1.0,
    "format": "mp3"
  }
}
```

### Stream Synthesis

```
POST /synthesize/stream
Content-Type: application/json

{
  "text": "Hello world",
  "provider": "openai-tts",
  "voiceModelId": "alloy"
}
```

### Get Available Voices

```
GET /voices?provider=openai-tts
```

### Estimate Cost

```
POST /estimate-cost
Content-Type: application/json

{
  "text": "Hello world",
  "provider": "openai-tts"
}
```

### Get Metrics

```
GET /metrics
```

### Cache Management

```
DELETE /cache
```

## Environment Variables

```bash
# Service Configuration
PORT=3005
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/clone_db

# Caching
ENABLE_CACHING=true
CACHE_TTL_SHORT=300
CACHE_TTL_MEDIUM=3600
CACHE_TTL_LONG=86400

# Google Cloud TTS
GCP_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# OpenAI TTS
OPENAI_API_KEY=your-openai-api-key

# XTTS-v2 (Optional)
XTTS_MODEL_PATH=/path/to/xtts/models
GPU_ENABLED=true
```

## Development

### Install Dependencies

```bash
pnpm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Development Server

```bash
npm run dev
```

### Production Server

```bash
npm start
```

## Architecture

The TTS service follows a provider pattern with:

1. **Provider Abstraction**: Common interface for all TTS providers
2. **Service Layer**: Orchestrates providers and handles fallbacks
3. **Cache Layer**: PostgreSQL-based caching for performance
4. **HTTP Server**: REST API for external access

## Caching Strategy

The service uses PostgreSQL for caching (following project guidelines):

- **Cache Key**: Hash of text + voice settings + provider
- **TTL**: Configurable expiration times
- **Hit Tracking**: Monitors cache effectiveness
- **Cleanup**: Automatic expired entry removal

## Error Handling

- **Provider Failures**: Automatic fallback to alternative providers
- **Network Issues**: Retry logic with exponential backoff
- **Invalid Requests**: Proper validation and error messages
- **Resource Limits**: Graceful degradation when resources unavailable

## Performance

- **Streaming**: Chunked audio delivery for low latency
- **Caching**: Reduces redundant synthesis requests
- **Connection Pooling**: Efficient database connections
- **Metrics**: Performance monitoring and optimization

## Security

- **Input Validation**: All requests validated and sanitized
- **Rate Limiting**: Configurable per-endpoint limits
- **Authentication**: JWT-based authentication support
- **Data Isolation**: User-specific data separation

## Monitoring

The service provides comprehensive metrics:

- Request count and latency per provider
- Cache hit rates and performance
- Error rates and types
- Cost tracking per provider
- Resource utilization

## Integration

The TTS service integrates with:

- **WebSocket Server**: Real-time conversation flow
- **LLM Service**: Response text synthesis
- **Mobile App**: Audio playback
- **Database**: Voice model and cache storage
- **Cloud Storage**: Voice model artifacts
