# Lip-Sync Service

Multi-model lip-sync video generation service supporting real-time streaming with adaptive model selection.

## Overview

The lip-sync service generates synchronized video frames from audio input using multiple lip-sync models. It supports automatic model selection based on performance requirements and provides fallback mechanisms for reliability.

## Supported Models

| Model      | Latency | Quality   | GPU Memory | Use Case                          |
| ---------- | ------- | --------- | ---------- | --------------------------------- |
| TPSM       | ~20ms   | Good      | 512MB      | Real-time streaming (recommended) |
| Wav2Lip    | ~100ms  | Excellent | 1GB        | High-quality output               |
| SadTalker  | ~60ms   | Very Good | 2GB        | Natural head motion               |
| Audio2Head | ~80ms   | Very Good | 2GB        | Advanced animation                |
| Static     | ~5ms    | Basic     | 64MB       | Fallback mode                     |

## Architecture

```
Audio Chunk → Audio Feature Extraction → Model Selection → Video Generation → Streaming
                     ↓                         ↓                  ↓
              Mel-spectrogram           Performance         Frame Buffer
                  MFCC                   Metrics              Sync
```

## Components

### AudioFeatureService

Extracts audio features for lip-sync models:

- Mel-spectrogram extraction
- MFCC (Mel-Frequency Cepstral Coefficients)
- Pitch and energy estimation
- Audio quality assessment
- Feature caching

### FaceModelCacheService

Manages face model loading and caching:

- GCS storage integration
- LRU cache with memory limits
- Model compatibility validation
- Preprocessing for different lip-sync models

### VideoGeneratorService

Generates video frames from audio features:

- Multi-model support
- Frame interpolation
- Adaptive frame rate
- Performance metrics

### VideoStreamingService

Handles video streaming over WebSocket:

- H.264 encoding preparation
- Audio-video synchronization (< 50ms offset)
- Adaptive bitrate
- Congestion handling

### LipSyncService

Main orchestrator:

- Model selection and fallback
- Session management
- Performance monitoring
- Benchmarking

## Usage

```typescript
import { LipSyncService, LipSyncModel } from '@clone/lipsync-service';

// Initialize service
const lipSyncService = new LipSyncService('your-gcs-bucket', {
  defaultModel: LipSyncModel.TPSM,
  enableAdaptiveModelSelection: true,
});

// Process lip-sync request
const response = await lipSyncService.processLipSync({
  sessionId: 'session-123',
  userId: 'user-456',
  audioChunk: {
    data: audioBuffer,
    timestamp: Date.now(),
    sequenceNumber: 0,
    sampleRate: 16000,
    channels: 1,
    format: 'pcm',
  },
  faceModelId: 'face-model-789',
});

// Prepare for WebSocket streaming
const streamingFrames = lipSyncService.prepareForStreaming('session-123', response.frames);
```

## Model Selection

The service automatically selects the best model based on:

- Network bandwidth
- GPU availability
- Face model compatibility
- Historical performance metrics

### Fallback Chain

```
TPSM → Wav2Lip → SadTalker → Static
```

If a model fails, the service automatically tries the next model in the chain.

## Configuration

```typescript
interface LipSyncServiceConfig {
  defaultModel: LipSyncModel;
  fallbackChain: LipSyncModel[];
  maxConcurrentSessions: number;
  faceModelCacheSize: number;
  audioFeatureCacheTtl: number;
  frameCacheTtl: number;
  enableAdaptiveModelSelection: boolean;
  performanceMonitoringInterval: number;
}
```

## Audio Requirements

- Sample rate: 16 kHz (recommended)
- Format: PCM, WAV, or Opus
- Channels: Mono
- Chunk size: 100ms for optimal latency

## Video Output

- Resolution: 256x256 or 512x512
- Frame rate: 15-20 FPS (adaptive)
- Format: JPEG or H.264
- Sync tolerance: < 50ms audio-video offset

## Performance Monitoring

```typescript
// Get model performance metrics
const metrics = lipSyncService.getModelPerformance(LipSyncModel.TPSM);
console.log(metrics.averageLatencyMs, metrics.successRate);

// Get service health
const health = lipSyncService.getHealthStatus();
console.log(health.activeSessions, health.gpuAvailable);
```

## Benchmarking

```typescript
// Benchmark all compatible models
const results = await lipSyncService.benchmarkModels(faceModel, testAudioChunk);
const recommended = results.find((r) => r.isRecommended);
```

## Error Handling

The service provides structured errors with recovery options:

```typescript
enum LipSyncErrorCode {
  FACE_MODEL_NOT_FOUND,
  FACE_MODEL_INCOMPATIBLE,
  AUDIO_PROCESSING_FAILED,
  VIDEO_GENERATION_FAILED,
  GPU_UNAVAILABLE,
  MODEL_LOAD_FAILED,
  SYNC_ERROR,
  BUFFER_OVERFLOW,
  TIMEOUT,
}
```

## API Reference

### WebSocket Messages

#### Request: Lip-Sync Audio Chunk

```json
{
  "type": "lipsync_audio",
  "sessionId": "session-123",
  "userId": "user-456",
  "audioChunk": {
    "data": "base64_encoded_audio",
    "timestamp": 1705312200000,
    "sequenceNumber": 0,
    "sampleRate": 16000,
    "channels": 1,
    "format": "pcm"
  },
  "faceModelId": "face-model-789",
  "modelPreference": "tpsm"
}
```

#### Response: Video Frames

```json
{
  "type": "response_video",
  "sessionId": "session-123",
  "turnId": "turn-001",
  "frameData": "base64_encoded_frame",
  "sequenceNumber": 0,
  "timestamp": 1705312200050,
  "audioTimestamp": 1705312200000,
  "format": "h264",
  "isKeyframe": true
}
```

### Service Methods

#### LipSyncService

| Method                                           | Description                                   |
| ------------------------------------------------ | --------------------------------------------- |
| `processLipSync(request)`                        | Process audio chunk and generate video frames |
| `selectModel(sessionId, preference, compatible)` | Select optimal lip-sync model                 |
| `benchmarkModels(faceModel, testAudio)`          | Benchmark all compatible models               |
| `switchModel(sessionId, newModel)`               | Switch model during conversation              |
| `getModelPerformance(model?)`                    | Get performance metrics                       |
| `getHealthStatus()`                              | Get service health status                     |
| `endSession(sessionId)`                          | End session and cleanup                       |

#### AudioFeatureService

| Method                                    | Description                           |
| ----------------------------------------- | ------------------------------------- |
| `extractFeatures(chunk)`                  | Extract mel-spectrogram and MFCCs     |
| `extractStreamingFeatures(chunks)`        | Extract features from multiple chunks |
| `assessAudioQuality(chunk)`               | Assess audio quality metrics          |
| `detectPhonemes(features)`                | Detect phonemes for lip-sync          |
| `preprocessForLipSync(chunk, targetRate)` | Preprocess audio for models           |

#### FaceModelCacheService

| Method                                      | Description                        |
| ------------------------------------------- | ---------------------------------- |
| `loadFaceModel(userId, modelId)`            | Load face model from cache/storage |
| `getPreprocessedData(userId, modelId)`      | Get preprocessed face data         |
| `validateCompatibility(model)`              | Validate model compatibility       |
| `preloadForUsers(userIds)`                  | Preload models for active users    |
| `hotSwapModel(userId, oldId, newId)`        | Hot-swap face model                |
| `optimizeForModel(faceModel, lipSyncModel)` | Optimize for specific model        |

#### VideoGeneratorService

| Method                                                           | Description                 |
| ---------------------------------------------------------------- | --------------------------- |
| `generateFrames(sessionId, features, model, data, lipSyncModel)` | Generate video frames       |
| `interpolateFrames(prev, next, factor)`                          | Interpolate between frames  |
| `dropFramesForPerformance(frames, targetFps)`                    | Drop frames for performance |
| `getBufferedFrames(sessionId)`                                   | Get buffered frames         |
| `getMetrics()`                                                   | Get generation metrics      |

#### VideoStreamingService

| Method                                            | Description                  |
| ------------------------------------------------- | ---------------------------- |
| `prepareFramesForStreaming(sessionId, frames)`    | Prepare frames for WebSocket |
| `createWebSocketMessage(frame)`                   | Create WebSocket message     |
| `calculateSyncState(sessionId, audioTs, videoTs)` | Calculate sync state         |
| `applySyncCorrection(frames, syncState)`          | Apply sync correction        |
| `adaptBitrate(sessionId, bandwidth, packetLoss)`  | Adapt bitrate                |
| `skipFramesForCongestion(frames, level)`          | Skip frames for congestion   |

## Related Documentation

- [Face Processing API](./FACE-PROCESSING-API.md)
- [Face Processing Service](./FACE-PROCESSING.md)
- [TTS Service](./TTS-MULTI-PROVIDER.md)
- [Audio Processing](./AUDIO-PROCESSING.md)
- [WebSocket Server](./WEBSOCKET-SERVER.md)
