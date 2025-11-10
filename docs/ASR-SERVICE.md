# ASR Service - Google Chirp Integration

## Overview

The ASR (Automatic Speech Recognition) Service provides real-time speech-to-text transcription using Google Cloud Speech-to-Text API with the Chirp model. It supports streaming audio, interim results, multi-language detection, and advanced features like speaker diarization and custom vocabulary.

## Features

- **Streaming Recognition**: Real-time audio transcription with < 300ms latency
- **Chirp Model**: Optimized for conversational speech with high accuracy
- **Interim Results**: Provides partial transcripts during speech
- **Multi-Language Support**: Automatic language detection and 100+ languages
- **Speaker Diarization**: Identifies different speakers in multi-speaker scenarios
- **Custom Vocabulary**: Domain-specific terms for improved accuracy
- **Profanity Filtering**: Optional content filtering
- **Caching**: PostgreSQL-based caching for repeated phrases
- **Rate Limiting**: Quota management and rate limiting per user
- **Performance Monitoring**: Latency, accuracy, and cost tracking
- **Error Handling**: Automatic retry with exponential backoff

## Architecture

```
Mobile App → WebSocket → ASR Service → Google Chirp API
                ↓                           ↓
         Audio Chunks              Streaming Recognition
                ↓                           ↓
         Cache Check                  Interim Results
                ↓                           ↓
         Metrics Tracking            Final Transcript
```

## Configuration

### Environment Variables

```bash
# Service Configuration
ASR_SERVICE_PORT=3001
ASR_MODEL=chirp                    # chirp, latest_long, latest_short
ASR_DEFAULT_LANGUAGE=en-US

# Feature Flags
ASR_ENABLE_PUNCTUATION=true
ASR_ENABLE_INTERIM_RESULTS=true
ASR_INTERIM_INTERVAL=300           # milliseconds
ASR_PROFANITY_FILTER=false
ASR_LANGUAGE_DETECTION=true

# Performance
ASR_MAX_STREAM_DURATION=300000     # 5 minutes
ASR_MAX_CONCURRENT_STREAMS=100

# Quota Management
ASR_QUOTA_RPM=1000                 # Requests per minute
ASR_QUOTA_MINUTES_PER_DAY=10000    # Audio minutes per day

# Retry Configuration
ASR_MAX_RETRIES=3
ASR_RETRY_INITIAL_DELAY=1000       # milliseconds
ASR_RETRY_MAX_DELAY=10000          # milliseconds
ASR_RETRY_BACKOFF=2                # multiplier

# Monitoring
ASR_ENABLE_METRICS=true
ASR_METRICS_INTERVAL=60000         # milliseconds
ASR_ENABLE_COST_TRACKING=true

# GCP Configuration (from base config)
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

## Usage

### Basic Streaming Recognition

```typescript
import { ASRService } from '@clone/asr-service';

const asrService = new ASRService();

// Start streaming session
const handle = await asrService.startStream(sessionId, userId, {
  sampleRate: 16000,
  encoding: AudioEncoding.LINEAR16,
  languageCode: 'en-US',
  enableInterimResults: true,
});

// Set up event handlers
asrService.onStreamEvents(handle.id, {
  onInterimResult: (result) => {
    console.log('Interim:', result.transcript);
  },
  onFinalResult: (result) => {
    console.log('Final:', result.transcript, 'Confidence:', result.confidence);
  },
  onError: (error) => {
    console.error('ASR Error:', error);
  },
  onEnd: () => {
    console.log('Stream ended');
  },
});

// Send audio chunks
await asrService.sendAudioChunk(handle.id, audioBuffer);

// End stream
await asrService.endStream(handle.id);
```

### With Custom Vocabulary

```typescript
const handle = await asrService.startStream(sessionId, userId, {
  sampleRate: 16000,
  encoding: AudioEncoding.LINEAR16,
  languageCode: 'en-US',
  speechContexts: [
    {
      phrases: ['digital twin', 'voice cloning', 'conversational AI'],
      boost: 20, // Boost recognition of these phrases
    },
  ],
});
```

### With Speaker Diarization

```typescript
const handle = await asrService.startStream(sessionId, userId, {
  sampleRate: 16000,
  encoding: AudioEncoding.LINEAR16,
  languageCode: 'en-US',
  enableSpeakerDiarization: true,
  diarizationSpeakerCount: 2, // Expected number of speakers
});

asrService.onStreamEvents(handle.id, {
  onFinalResult: (result) => {
    result.words?.forEach((word) => {
      console.log(`Speaker ${word.speakerTag}: ${word.word}`);
    });
  },
});
```

### With Language Detection

```typescript
const handle = await asrService.startStream(sessionId, userId, {
  sampleRate: 16000,
  encoding: AudioEncoding.LINEAR16,
  // Don't specify languageCode for auto-detection
  enableInterimResults: true,
});

asrService.onStreamEvents(handle.id, {
  onFinalResult: (result) => {
    console.log('Detected language:', result.languageCode);
    console.log('Transcript:', result.transcript);
  },
});
```

## API Reference

### ASRService

#### Methods

**`startStream(sessionId: string, userId: string, config?: Partial<ASRConfig>): Promise<StreamHandle>`**

Starts a new streaming recognition session.

- **Parameters:**
  - `sessionId`: Unique session identifier
  - `userId`: User identifier for quota tracking
  - `config`: Optional ASR configuration
- **Returns:** Stream handle for managing the session
- **Throws:** Error if rate limit or quota exceeded

**`sendAudioChunk(handleId: string, audioData: Buffer): Promise<void>`**

Sends audio data to the streaming recognition.

- **Parameters:**
  - `handleId`: Stream handle ID
  - `audioData`: Audio buffer (16-bit PCM recommended)

**`endStream(handleId: string): Promise<void>`**

Ends the streaming recognition session.

**`onStreamEvents(handleId: string, callbacks: StreamCallbacks): void`**

Sets up event handlers for the stream.

- **Callbacks:**
  - `onInterimResult`: Called for partial transcripts
  - `onFinalResult`: Called for final transcripts
  - `onError`: Called on errors
  - `onEnd`: Called when stream ends

**`getActiveStreamCount(): number`**

Returns the number of active streams.

**`getMetrics(): ASRMetricsService`**

Returns the metrics service for monitoring.

**`getQuota(): ASRQuotaService`**

Returns the quota service for rate limiting.

**`shutdown(): Promise<void>`**

Gracefully shuts down the service.

### ASRConfig

```typescript
interface ASRConfig {
  sampleRate: number; // Audio sample rate (16000 recommended)
  encoding: AudioEncoding; // Audio encoding format
  languageCode?: string; // Language code (e.g., 'en-US')
  enableAutomaticPunctuation: boolean; // Add punctuation
  enableWordTimeOffsets: boolean; // Include word timestamps
  model: 'chirp' | 'latest_long' | 'latest_short'; // Recognition model
  enableInterimResults: boolean; // Stream partial results
  maxAlternatives?: number; // Number of alternative transcripts
  profanityFilter?: boolean; // Filter profanity
  speechContexts?: SpeechContext[]; // Custom vocabulary
  enableSpeakerDiarization?: boolean; // Identify speakers
  diarizationSpeakerCount?: number; // Expected speaker count
}
```

### TranscriptResult

```typescript
interface TranscriptResult {
  transcript: string; // Transcribed text
  confidence: number; // Confidence score (0-1)
  isFinal: boolean; // Is this the final result?
  words?: WordInfo[]; // Word-level details
  languageCode?: string; // Detected language
  alternatives?: TranscriptAlternative[]; // Alternative transcripts
}
```

## Performance

### Latency Targets

- **Interim Results**: < 300ms from audio chunk
- **Final Results**: < 500ms from end of speech
- **End-to-End**: < 2000ms (including network)

### Accuracy

- **Clear Speech**: > 95% accuracy
- **Conversational Speech**: > 90% accuracy
- **Noisy Environment**: > 85% accuracy

### Cost

- **Chirp Model**: $0.006 per minute
- **Standard Model**: $0.004 per minute
- **Data Logging**: $0.0005 per minute (optional)

**Example:** 10-minute conversation = $0.06

## Caching

The ASR service uses PostgreSQL for caching repeated phrases:

```sql
CREATE TABLE cache_asr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) NOT NULL,
  cache_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_cache_asr_key ON cache_asr_results(cache_key);
CREATE INDEX idx_cache_asr_expires ON cache_asr_results(expires_at);
```

Cache entries expire after `CACHE_TTL_SHORT` (default: 300 seconds).

## Quota Management

### Rate Limiting

- **Per-User Limit**: 1000 requests per minute (configurable)
- **Concurrent Streams**: 100 maximum (configurable)

### Daily Quota

- **Free Tier**: 60 minutes per day
- **Pro Tier**: Unlimited
- **Enterprise**: Custom limits

Check remaining quota:

```typescript
const quota = asrService.getQuota();
const remaining = await quota.getRemainingQuota(userId);
console.log('Remaining minutes:', remaining.remainingMinutes);
```

## Error Handling

### Error Codes

- `RATE_LIMIT_EXCEEDED`: Too many requests
- `QUOTA_EXCEEDED`: Daily quota reached
- `INVALID_AUDIO`: Unsupported audio format
- `UNSUPPORTED_LANGUAGE`: Language not supported
- `SERVICE_UNAVAILABLE`: Temporary service outage
- `STREAM_ERROR`: Connection error
- `AUTHENTICATION_ERROR`: Invalid credentials
- `TIMEOUT`: Request timeout

### Retry Logic

The service automatically retries failed requests with exponential backoff:

- **Max Retries**: 3 (configurable)
- **Initial Delay**: 1 second
- **Max Delay**: 10 seconds
- **Backoff Multiplier**: 2x

```typescript
import { ASRErrorHandler } from '@clone/asr-service';

const errorHandler = new ASRErrorHandler();

try {
  await errorHandler.withRetry(async () => {
    // Your ASR operation
  }, 'transcribe-audio');
} catch (error) {
  const userMessage = errorHandler.getUserMessage(error);
  console.error(userMessage);
}
```

## Monitoring

### Metrics

The service tracks:

- **Latency**: Transcription time per request
- **Accuracy**: Confidence scores
- **Cost**: Per-session and aggregate costs
- **Errors**: Error rates by type
- **Usage**: Audio minutes processed

Access metrics:

```typescript
const metrics = asrService.getMetrics();
const aggregate = metrics.getAggregateMetrics();

console.log('Active sessions:', aggregate.activeSessions);
console.log('Average latency:', aggregate.averageLatency, 'ms');
console.log('Average accuracy:', aggregate.averageAccuracy);
console.log('Total cost:', aggregate.totalCost);
```

### Logging

Structured logs are written to Cloud Logging:

```json
{
  "timestamp": "2025-01-10T12:00:00Z",
  "level": "INFO",
  "service": "asr-service",
  "sessionId": "session-123",
  "message": "ASR stream started",
  "metadata": {
    "model": "chirp",
    "languageCode": "en-US"
  }
}
```

## Best Practices

### Audio Format

- **Sample Rate**: 16 kHz (optimal for speech)
- **Encoding**: 16-bit PCM (LINEAR16)
- **Channels**: Mono
- **Chunk Size**: 100ms (1600 samples)

### Configuration

- **Enable Interim Results**: For real-time feedback
- **Automatic Punctuation**: For better readability
- **Language Detection**: When language is unknown
- **Custom Vocabulary**: For domain-specific terms

### Error Handling

- **Check Quota**: Before starting streams
- **Handle Errors**: Implement retry logic
- **User Feedback**: Show clear error messages
- **Graceful Degradation**: Fall back to text input

### Performance

- **Reuse Connections**: Keep streams alive
- **Batch Audio**: Send chunks efficiently
- **Monitor Latency**: Track performance metrics
- **Cache Results**: For repeated phrases

## Troubleshooting

### High Latency

- Check network connection
- Reduce audio chunk size
- Use Chirp model (optimized for streaming)
- Enable interim results

### Low Accuracy

- Improve audio quality (reduce noise)
- Use custom vocabulary
- Specify correct language code
- Check microphone settings

### Rate Limit Errors

- Implement exponential backoff
- Reduce request frequency
- Upgrade to higher tier
- Use caching for repeated phrases

### Authentication Errors

- Check GCP credentials
- Verify project ID
- Enable Speech-to-Text API
- Check IAM permissions

## Related Documentation

- [Audio Processing](./AUDIO-PROCESSING.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [GCP Management](./GCP-MANAGEMENT.md)
- [Getting Started](./GETTING-STARTED.md)

## Support

For issues or questions:

1. Check logs in Cloud Logging
2. Review metrics in monitoring dashboard
3. Consult [Google Cloud Speech-to-Text documentation](https://cloud.google.com/speech-to-text/docs)
4. Contact support team
