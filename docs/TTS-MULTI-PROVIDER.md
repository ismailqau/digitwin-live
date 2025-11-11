# Multi-Provider TTS Support

This document describes the multi-provider Text-to-Speech (TTS) system that supports multiple TTS providers with intelligent selection, fallback, and optimization.

## Supported Providers

### 1. XTTS-v2 (Primary)

- **Type**: Self-hosted voice cloning
- **Features**: Custom voice training, high quality
- **Use Case**: Primary voice cloning with user-trained models
- **Streaming**: Chunked (not native)

### 2. OpenAI TTS

- **Type**: Cloud API
- **Features**: 6 built-in voices (alloy, echo, fable, onyx, nova, shimmer)
- **Use Case**: High-quality fallback, fast synthesis
- **Streaming**: Chunked (not native)

### 3. Google Cloud TTS

- **Type**: Cloud API with custom voice support
- **Features**: Custom voice models, multiple languages
- **Use Case**: Enterprise-grade TTS with custom voices
- **Streaming**: Chunked (not native)

### 4. ElevenLabs (Optional)

- **Type**: Cloud API
- **Features**: High-quality voice cloning, true streaming
- **Use Case**: Premium voice quality, real-time streaming
- **Streaming**: Native streaming support

## Provider Selection

The system automatically selects the best provider based on:

### Selection Criteria

- **User Preference**: Preferred provider if specified
- **Cost Optimization**: Lowest cost per character
- **Latency Requirements**: Fastest response time
- **Quality Requirements**: Minimum quality score
- **Quota Availability**: Available quota limits
- **Voice Model Compatibility**: Support for specific voice models
- **Streaming Requirements**: Native streaming support

### Scoring Algorithm

Each provider receives a score (0-100) based on:

- **Success Rate** (40 points): Historical reliability
- **Latency** (20 points): Response time performance
- **Cost** (20 points): Price per character
- **Quality** (20 points): Voice similarity and naturalness
- **Quota Availability** (10 points): Remaining quota
- **Streaming Bonus** (5 points): Native streaming support

## Fallback Strategy

When a provider fails, the system automatically falls back in this order:

1. **XTTS-v2** → **OpenAI TTS** → **Google Cloud TTS** → **ElevenLabs**
2. Uses intelligent fallback based on provider performance metrics
3. Updates provider reliability scores based on failures

## Cost Optimization

### Cost Comparison

- **XTTS-v2**: Free (self-hosted, GPU costs)
- **OpenAI TTS**: $15-30 per 1M characters
- **Google Cloud TTS**: $4 per 1M characters (Neural2)
- **ElevenLabs**: ~$300 per 1M characters (premium quality)

### Optimization Features

- Real-time cost comparison across providers
- Automatic selection of most cost-effective provider
- Cost tracking and analytics per provider
- Budget-based provider selection

## Voice Quality Validation

### Quality Metrics

- **Similarity**: Voice similarity to reference (0-1)
- **Naturalness**: How natural the voice sounds (0-1)
- **Clarity**: Audio clarity and intelligibility (0-1)
- **Overall**: Combined quality score (0-1)

### Validation Process

1. Compare generated audio to reference samples
2. Calculate similarity scores using audio analysis
3. Track quality metrics per provider
4. Use quality scores in provider selection

## Quota Management

### Quota Tracking

- **Characters Used**: Track character consumption
- **Requests Made**: Track API request count
- **Reset Periods**: Daily/monthly quota resets
- **Limit Enforcement**: Prevent quota exceeded errors

### Quota Features

- Real-time quota monitoring
- Automatic provider switching when quota exceeded
- Quota usage analytics and reporting
- Predictive quota management

## Performance Monitoring

### Metrics Tracked

- **Latency**: Response time per provider
- **Success Rate**: Successful requests percentage
- **Error Rate**: Failed requests percentage
- **Cost Per Request**: Average cost tracking
- **Quality Scores**: Voice quality metrics
- **Quota Usage**: Resource consumption

### Monitoring Features

- Real-time performance dashboards
- Historical performance trends
- Provider comparison analytics
- Automated alerting on performance issues

## API Endpoints

### Enhanced Synthesis

```http
POST /synthesize
Content-Type: application/json

{
  "text": "Hello world",
  "provider": "openai-tts",  // Optional preferred provider
  "voiceModelId": "user-voice-123",
  "options": {
    "maxCost": 0.01,
    "maxLatency": 2000,
    "minQualityScore": 0.8,
    "requireStreaming": false
  }
}
```

### Cost Comparison

```http
POST /compare-costs
Content-Type: application/json

{
  "text": "Text to synthesize"
}

Response:
{
  "xtts-v2": 0.0,
  "openai-tts": 0.00015,
  "google-cloud-tts": 0.00004,
  "elevenlabs": 0.0003
}
```

### Provider Metrics

```http
GET /metrics

Response:
{
  "providers": {
    "openai-tts": {
      "requestCount": 1250,
      "averageLatency": 850,
      "successRate": 0.98,
      "totalCost": 12.50
    }
  },
  "performance": {
    "openai-tts": {
      "provider": "openai-tts",
      "isAvailable": true,
      "averageLatency": 850,
      "successRate": 0.98,
      "averageCost": 0.01,
      "qualityScore": 0.85,
      "quotaUsage": {
        "used": 125000,
        "limit": 1000000,
        "resetDate": "2024-12-01T00:00:00Z"
      }
    }
  }
}
```

### Quota Usage

```http
GET /quota

Response:
{
  "openai-tts": {
    "charactersUsed": 125000,
    "charactersLimit": 1000000,
    "requestsUsed": 1250,
    "requestsLimit": 10000,
    "resetDate": "2024-12-01T00:00:00Z",
    "isExceeded": false
  }
}
```

## Configuration

### Environment Variables

```bash
# Provider API Keys
OPENAI_API_KEY=sk-...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
ELEVENLABS_API_KEY=...

# XTTS Configuration
XTTS_MODEL_PATH=/models/xtts-v2
GPU_ENABLED=true

# Provider Selection
DEFAULT_TTS_PROVIDER=xtts-v2
MAX_COST_PER_CHARACTER=0.01
MIN_QUALITY_SCORE=0.8
```

### Provider Initialization

```typescript
const providerConfigs = [
  {
    provider: TTSProvider.XTTS_V2,
    options: {
      modelPath: process.env.XTTS_MODEL_PATH,
      gpuEnabled: process.env.GPU_ENABLED === 'true',
    },
  },
  {
    provider: TTSProvider.OPENAI_TTS,
    options: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  },
  {
    provider: TTSProvider.GOOGLE_CLOUD_TTS,
    options: {
      projectId: config.gcp.projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    },
  },
  {
    provider: TTSProvider.ELEVENLABS,
    options: {
      apiKey: process.env.ELEVENLABS_API_KEY,
    },
  },
];
```

## Usage Examples

### Basic Synthesis with Auto-Selection

```typescript
const response = await ttsService.synthesize({
  text: 'Hello, this is a test message',
  // Provider will be automatically selected
});
```

### Synthesis with Preferences

```typescript
const response = await ttsService.synthesize(
  {
    text: 'Hello, this is a test message',
    provider: TTSProvider.OPENAI_TTS, // Preferred provider
    voiceModelId: 'user-voice-123',
  },
  {
    maxCost: 0.005, // Maximum cost per character
    maxLatency: 1500, // Maximum latency in ms
    minQualityScore: 0.9, // Minimum quality score
    requireStreaming: true, // Require native streaming
  }
);
```

### Cost Comparison

```typescript
const costs = await ttsService.compareCosts('Text to synthesize');
console.log('Provider costs:', Object.fromEntries(costs));
```

### Performance Monitoring

```typescript
const metrics = ttsService.getProviderPerformanceMetrics();
for (const [provider, metric] of metrics) {
  console.log(`${provider}: ${metric.successRate * 100}% success rate`);
}
```

## Best Practices

### 1. Provider Selection

- Use XTTS-v2 for custom voice models
- Use OpenAI TTS for fast, reliable synthesis
- Use Google Cloud TTS for multi-language support
- Use ElevenLabs for premium quality and streaming

### 2. Cost Optimization

- Set appropriate cost limits in selection criteria
- Monitor quota usage to avoid overages
- Use caching to reduce API calls
- Prefer self-hosted XTTS-v2 for high volume

### 3. Quality Management

- Set minimum quality thresholds
- Regularly validate voice model quality
- Use A/B testing for voice model comparison
- Monitor user feedback on voice quality

### 4. Performance Optimization

- Enable caching for repeated text
- Use streaming for real-time applications
- Monitor provider latency and switch if needed
- Implement proper error handling and retries

## Troubleshooting

### Common Issues

#### Provider Not Available

- Check API keys and credentials
- Verify network connectivity
- Check quota limits
- Review provider health status

#### Poor Voice Quality

- Validate voice model compatibility
- Check quality scores in metrics
- Try different providers
- Review voice training data

#### High Latency

- Check provider performance metrics
- Consider switching to faster provider
- Enable streaming for real-time use
- Optimize network configuration

#### Cost Overruns

- Set cost limits in selection criteria
- Monitor quota usage regularly
- Use caching to reduce API calls
- Consider self-hosted alternatives

## Related Documentation

- [TTS Service Architecture](./TTS-ARCHITECTURE.md)
- [Voice Model Training](./VOICE-MODEL-TRAINING.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [Performance Monitoring](./MONITORING.md)
