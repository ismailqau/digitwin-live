# Voice Sample Recording and Upload

This document describes the voice sample recording and upload functionality for creating personalized voice models in the Real-Time Conversational Clone System.

## Overview

The voice sample recording feature allows users to record high-quality audio samples that are used to train personalized voice models. The system implements comprehensive audio quality validation, preprocessing, and chunked upload support for optimal user experience.

## Features

### 📱 Mobile App Features

- **Guided Recording Interface**: Step-by-step prompts for optimal voice sample collection
- **Real-time Quality Feedback**: Live audio quality monitoring during recording
- **Audio Quality Validation**: SNR > 20 dB, clipping detection, background noise analysis
- **Multiple Sample Collection**: Support for 3-10 voice samples per voice model
- **Progress Tracking**: Real-time upload and training progress indicators
- **Sample Review**: Preview, replay, and re-record functionality
- **Privacy Controls**: Local sample deletion and privacy management

### 🔧 Backend Features

- **Chunked Upload Support**: Efficient upload of large audio files with progress tracking
- **Audio Preprocessing**: Noise reduction, normalization, and format conversion
- **Quality Validation**: Comprehensive audio analysis and quality scoring
- **GCS Storage**: Secure storage in `digitwin-live-voice-models/samples/` bucket
- **Metadata Tracking**: Duration, quality score, language detection, and processing logs
- **Privacy Controls**: Secure deletion and user data isolation

## Technical Implementation

### Audio Requirements

```typescript
interface VoiceSampleRequirements {
  minDuration: 60; // 1 minute minimum
  maxDuration: 300; // 5 minutes maximum
  minSNR: 20; // 20 dB minimum signal-to-noise ratio
  maxClippingPercentage: 5; // 5% maximum clipping
  minQualityScore: 70; // 70/100 minimum quality score
  requiredSampleRate: 16000; // 16 kHz
  requiredChannels: 1; // Mono
  requiredBitDepth: 16; // 16-bit
  supportedFormats: ['wav', 'mp3', 'flac', 'm4a', 'aac'];
}
```

### Recording Configuration

```typescript
const VOICE_SAMPLE_CONFIG: AudioManagerConfig = {
  sampleRate: 16000, // 16 kHz for voice cloning
  channels: 1, // Mono
  bitDepth: 16, // 16-bit
  chunkDuration: 1000, // 1 second chunks for quality monitoring
  vadThreshold: 25, // Lower threshold for voice samples
  enableNoiseReduction: true,
};
```

### Quality Metrics

The system tracks comprehensive audio quality metrics:

```typescript
interface AudioQualityMetrics {
  duration: number; // Duration in seconds
  sampleRate: number; // Sample rate in Hz
  channels: number; // Number of audio channels
  bitDepth: number; // Bit depth
  snr: number; // Signal-to-noise ratio in dB
  hasClipping: boolean; // Clipping detection
  hasBackgroundNoise: boolean; // Background noise detection
  qualityScore: number; // Overall quality score (0-100)
  peakLevel: number; // Peak audio level in dB
  rmsLevel: number; // RMS audio level in dB
  dynamicRange: number; // Dynamic range in dB
}
```

## API Endpoints

### Upload Voice Sample

```http
POST /api/v1/voice/samples
Content-Type: multipart/form-data
Authorization: Bearer <token>

audioFile: <audio_file>
originalFilename: string
chunkIndex?: number      // For chunked uploads
totalChunks?: number     // For chunked uploads
totalSize?: number       // For chunked uploads
```

**Response:**

```json
{
  "id": "uuid",
  "filename": "processed_audio.wav",
  "originalFilename": "my_voice_sample.wav",
  "duration": 120.5,
  "qualityScore": 85,
  "status": "completed",
  "createdAt": "2024-01-01T00:00:00Z",
  "validation": {
    "isValid": true,
    "issues": [],
    "recommendations": ["Background noise detected. Noise reduction applied"]
  },
  "metrics": {
    "duration": 120.5,
    "sampleRate": 16000,
    "channels": 1,
    "snr": 25.3,
    "qualityScore": 85
  }
}
```

### Get Voice Samples

```http
GET /api/v1/voice/samples?page=1&limit=20&status=completed
Authorization: Bearer <token>
```

### Delete Voice Sample

```http
DELETE /api/v1/voice/samples/{id}
Authorization: Bearer <token>
```

### Create Voice Model

```http
POST /api/v1/voice/models
Content-Type: application/json
Authorization: Bearer <token>

{
  "provider": "xtts-v2",
  "sampleIds": ["uuid1", "uuid2", "uuid3"],
  "name": "My Voice Model",
  "description": "Personal voice clone"
}
```

## Usage Guide

### 1. Recording Voice Samples

```typescript
import { VoiceSampleManager } from '../services/VoiceSampleManager';

const voiceSampleManager = new VoiceSampleManager({
  onSampleRecorded: (sample) => {
    console.log('Sample recorded:', sample);
  },
  onSampleValidated: (sample, validation) => {
    if (!validation.canProceed) {
      alert(`Quality issues: ${validation.issues.join(', ')}`);
    }
  },
  onTrainingProgress: (progress) => {
    console.log('Training progress:', progress);
  },
});

// Start recording
await voiceSampleManager.startRecording();

// Stop recording
const sample = await voiceSampleManager.stopRecording();
```

### 2. Upload and Training

```typescript
// Upload all samples and start training
await voiceSampleManager.uploadSamples();

// Monitor progress through callbacks
```

### 3. Quality Validation

The system automatically validates each sample:

- **Duration**: Must be between 1-5 minutes
- **Audio Quality**: SNR > 20 dB, minimal clipping
- **Format**: Automatic conversion to 16kHz mono 16-bit
- **Background Noise**: Automatic noise reduction applied
- **Overall Score**: Must achieve 70/100 minimum quality

## Recording Prompts

The system provides guided prompts for optimal voice sample collection:

1. **Reading Prompt**: Clear, natural speech sample
2. **Natural Speech**: Personal conversation about interests
3. **Expressive Reading**: Passage with varied intonation
4. **Storytelling**: Emotional and varied tone sample
5. **Phonetic Coverage**: Numbers and alphabet for sound coverage

## Storage Architecture

### GCS Bucket Structure

```
digitwin-live-voice-models/
├── samples/
│   └── {userId}/
│       ├── {timestamp}_{randomId}.wav
│       └── {timestamp}_{randomId}_processed.wav
└── models/
    └── {userId}/
        └── {modelId}/
            ├── model.pth
            └── metadata.json
```

### Database Schema

```sql
-- Voice samples table
CREATE TABLE voice_samples (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration FLOAT NOT NULL,
  sample_rate INTEGER NOT NULL,
  channels INTEGER DEFAULT 1,
  quality_score FLOAT NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  processed_path VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

## Audio Processing Pipeline

### 1. Upload and Validation

1. **File Upload**: Chunked upload with progress tracking
2. **Format Validation**: Check file type and size limits
3. **Audio Analysis**: Extract metrics using FFmpeg
4. **Quality Validation**: Check against requirements

### 2. Preprocessing

1. **Format Conversion**: Convert to 16kHz mono 16-bit WAV
2. **Noise Reduction**: Apply high-pass filter and noise gate
3. **Normalization**: Loudness normalization to -16 LUFS
4. **Limiting**: Apply limiter to prevent clipping

### 3. Storage and Metadata

1. **GCS Upload**: Store original and processed files
2. **Database Record**: Create sample record with metadata
3. **Quality Scoring**: Calculate overall quality score
4. **Audit Logging**: Log upload and processing events

## Error Handling

### Common Issues and Solutions

| Issue          | Cause                | Solution                      |
| -------------- | -------------------- | ----------------------------- |
| Low SNR        | Background noise     | Record in quieter environment |
| Clipping       | Too loud input       | Reduce microphone gain        |
| Short duration | Recording too brief  | Record for at least 1 minute  |
| Poor quality   | Multiple issues      | Follow recording guidelines   |
| Upload failed  | Network/server error | Retry with chunked upload     |

### Error Codes

- `NO_FILE`: No audio file provided
- `INVALID_FORMAT`: Unsupported file format
- `FILE_TOO_LARGE`: File exceeds 50MB limit
- `QUALITY_TOO_LOW`: Audio quality below threshold
- `UPLOAD_FAILED`: Upload process failed
- `PROCESSING_FAILED`: Audio processing failed

## Performance Considerations

### Upload Optimization

- **Chunked Upload**: 64KB chunks for large files
- **Progress Tracking**: Real-time upload progress
- **Retry Logic**: Automatic retry on network failures
- **Compression**: Opus codec for efficient transmission

### Processing Optimization

- **FFmpeg**: Hardware-accelerated audio processing
- **Parallel Processing**: Multiple samples processed concurrently
- **Caching**: Processed results cached for reuse
- **Cleanup**: Automatic temporary file cleanup

## Security and Privacy

### Data Protection

- **User Isolation**: Samples isolated by user ID
- **Secure Storage**: Encrypted storage in GCS
- **Access Control**: JWT-based authentication
- **Audit Logging**: Complete audit trail

### Privacy Controls

- **Deletion**: Secure deletion from storage and database
- **Retention**: Configurable data retention policies
- **Consent**: User consent for voice model training
- **Anonymization**: Optional voice sample anonymization

## Testing

### Unit Tests

```typescript
// Test voice sample validation
describe('VoiceSampleProcessor', () => {
  it('should validate audio quality', async () => {
    const processor = new VoiceSampleProcessor();
    const result = await processor.processVoiceSample(testFile, outputDir);
    expect(result.isValid).toBe(true);
    expect(result.metrics.qualityScore).toBeGreaterThan(70);
  });
});
```

### Integration Tests

```typescript
// Test upload flow
describe('Voice Sample Upload', () => {
  it('should upload and process voice sample', async () => {
    const response = await request(app)
      .post('/api/v1/voice/samples')
      .attach('audioFile', testAudioFile)
      .expect(201);

    expect(response.body.qualityScore).toBeGreaterThan(70);
  });
});
```

## Monitoring and Analytics

### Metrics Tracked

- Upload success/failure rates
- Audio quality distribution
- Processing times
- Storage usage
- User engagement

### Alerts

- High failure rates
- Quality degradation
- Storage quota exceeded
- Processing delays

## Related Documentation

- [Audio Processing Guide](./AUDIO-PROCESSING.md)
- [TTS Multi-Provider Guide](./TTS-MULTI-PROVIDER.md)
- [Voice Sample Recording Guide](./VOICE-SAMPLE-RECORDING.md)
- [GCP Infrastructure Guide](./GCP-INFRASTRUCTURE.md)
- [API Documentation](./API-DOCUMENTATION.md)

## Troubleshooting

### Common Issues

**Recording Quality Issues:**

- Ensure quiet environment
- Use good quality microphone
- Maintain consistent distance from microphone
- Speak clearly and naturally

**Upload Issues:**

- Check network connection
- Verify file format support
- Ensure file size under 50MB
- Try chunked upload for large files

**Processing Issues:**

- Check FFmpeg installation
- Verify temporary directory permissions
- Monitor system resources
- Check audio file integrity

For additional support, see the [Troubleshooting Guide](./TROUBLESHOOTING.md).
