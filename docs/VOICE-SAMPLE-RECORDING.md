# Voice Sample Recording Guide

This guide covers the voice sample recording and upload functionality for creating personalized voice models.

## Overview

The voice sample recording system allows users to create high-quality voice models by recording multiple voice samples. These samples are then processed and used to train voice cloning models that can synthesize speech in the user's voice.

## Features

### Mobile App Components

- **VoiceSampleRecording**: Main recording interface with guided prompts
- **VoiceModelPreview**: Preview and test existing voice models
- **VoiceSampleManager**: Service for managing voice sample recording and validation
- **useVoiceSampleUpload**: Hook for handling uploads with progress tracking

### Backend API Endpoints

- `POST /api/v1/voice/samples` - Upload voice sample with chunked upload support
- `GET /api/v1/voice/samples` - List user's voice samples
- `DELETE /api/v1/voice/samples/:id` - Delete voice sample
- `POST /api/v1/voice/models` - Create voice model from samples
- `GET /api/v1/voice/models` - List voice models
- `GET /api/v1/voice/models/:id/progress` - Get training progress
- `PUT /api/v1/voice/models/:id` - Update voice model
- `DELETE /api/v1/voice/models/:id` - Delete voice model

## Voice Sample Requirements

### Audio Quality Standards

- **Sample Rate**: 16 kHz (minimum for voice cloning)
- **Channels**: Mono (1 channel)
- **Bit Depth**: 16-bit
- **Format**: WAV, MP3, M4A, AAC, or FLAC
- **Duration**: 10 seconds to 10 minutes per sample
- **Signal-to-Noise Ratio**: Minimum 20 dB
- **No Clipping**: Audio levels should not exceed 95%
- **File Size**: Maximum 50 MB per sample

### Recording Guidelines

1. **Environment**: Record in a quiet room with minimal background noise
2. **Microphone**: Use a good quality microphone, positioned 6-12 inches from mouth
3. **Speaking Style**: Speak naturally and clearly at normal pace
4. **Content Variety**: Include different types of speech (reading, conversation, counting)
5. **Sample Count**: Minimum 3 samples, recommended 5-10 samples
6. **Total Duration**: Minimum 3 minutes total, recommended 5+ minutes

## Recording Process

### 1. Guided Recording Prompts

The app provides 5 different recording prompts:

1. **Introduction**: Read a standard introduction text
2. **Natural Speech**: Speak naturally about yourself (1-2 minutes)
3. **Expressive Reading**: Read a passage with expression
4. **Storytelling**: Tell a story or describe an experience
5. **Phonetic Coverage**: Count numbers and recite alphabet

### 2. Real-time Quality Monitoring

During recording, the app monitors:

- **Volume Levels**: Ensures adequate but not excessive volume
- **Voice Activity Detection**: Detects when user is speaking
- **Clipping Detection**: Warns if audio levels are too high
- **Duration Tracking**: Shows current recording time vs. requirements

### 3. Sample Validation

After each recording, the system validates:

- **Duration**: Meets minimum/maximum requirements
- **Quality Score**: Overall audio quality (0-100)
- **SNR**: Signal-to-noise ratio analysis
- **Clipping**: Checks for audio distortion
- **Background Noise**: Detects unwanted noise

## Voice Model Training

### Supported Providers

1. **XTTS-v2**: High-quality open-source voice cloning
2. **Google Cloud TTS**: Enterprise-grade custom voices
3. **OpenAI TTS**: Fast, high-quality voice synthesis

### Training Process

1. **Sample Upload**: Chunked upload with progress tracking
2. **Preprocessing**: Noise reduction and normalization
3. **Validation**: Quality checks and requirements verification
4. **Training**: Model training (typically 10-30 minutes)
5. **Quality Assessment**: Automated quality scoring
6. **Deployment**: Model ready for use in conversations

### Training Progress Tracking

The system provides real-time updates on:

- Upload progress (0-70%)
- Processing status (70-80%)
- Training progress (80-100%)
- Estimated time remaining
- Current step description
- Error handling and retry logic

## API Usage Examples

### Upload Voice Sample

```typescript
const formData = new FormData();
formData.append('audio', audioBlob, 'sample.wav');
formData.append('filename', 'sample.wav');
formData.append('duration', '65.5');
formData.append('qualityScore', '87');

const response = await fetch('/api/v1/voice/samples', {
  method: 'POST',
  body: formData,
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### Create Voice Model

```typescript
const response = await fetch('/api/v1/voice/models', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    provider: 'xtts-v2',
    sampleIds: ['sample1', 'sample2', 'sample3'],
    name: 'My Voice Model',
  }),
});
```

### Monitor Training Progress

```typescript
const response = await fetch(`/api/v1/voice/models/${modelId}/progress`);
const progress = await response.json();

console.log(`Training ${progress.progress}% complete`);
console.log(`Current step: ${progress.currentStep}`);
console.log(`ETA: ${progress.estimatedTimeRemaining} seconds`);
```

## Storage Architecture

### Voice Sample Storage

- **Location**: GCS bucket `digitwin-live-voice-models`
- **Path Structure**: `voice-samples/{userId}/{timestamp}-{random}.{ext}`
- **Metadata**: Stored in PostgreSQL `voice_samples` table
- **Processed Files**: Noise-reduced and normalized versions

### Voice Model Storage

- **Location**: GCS bucket `digitwin-live-voice-models`
- **Path Structure**: `voice-models/{userId}/{modelId}/model.pth`
- **Metadata**: Stored in PostgreSQL `voice_models` table
- **Caching**: Active models cached in memory for fast access

## Quality Validation

### Automatic Validation

The system automatically validates:

```typescript
interface VoiceSampleValidation {
  isValid: boolean;
  issues: string[]; // Blocking issues
  recommendations: string[]; // Suggestions for improvement
  qualityScore: number; // 0-100 overall score
}
```

### Common Issues and Solutions

| Issue        | Cause                      | Solution                      |
| ------------ | -------------------------- | ----------------------------- |
| Low SNR      | Background noise           | Record in quieter environment |
| Clipping     | Volume too high            | Reduce microphone gain        |
| Too short    | Insufficient content       | Record longer samples         |
| Poor quality | Bad microphone/environment | Use better equipment          |

## Privacy and Security

### Data Handling

- **Voice Samples**: Stored securely in GCS with encryption
- **User Consent**: Required before storing any voice data
- **Data Retention**: Configurable retention policies
- **Access Control**: User-specific data isolation
- **Deletion**: Complete removal on user request

### Security Measures

- **Authentication**: JWT-based API authentication
- **Authorization**: User-specific access controls
- **Encryption**: TLS in transit, AES-256 at rest
- **Audit Logging**: All operations logged for security
- **Rate Limiting**: Prevents abuse and DoS attacks

## Troubleshooting

### Common Recording Issues

1. **Permission Denied**
   - Ensure microphone permissions are granted
   - Check device privacy settings

2. **Poor Audio Quality**
   - Use a better microphone
   - Record in a quieter environment
   - Check microphone positioning

3. **Upload Failures**
   - Check network connection
   - Verify file size limits
   - Retry with smaller chunks

4. **Training Failures**
   - Ensure minimum sample requirements
   - Check sample quality scores
   - Verify total duration requirements

### Error Codes

| Code                        | Description              | Solution                                   |
| --------------------------- | ------------------------ | ------------------------------------------ |
| `MISSING_AUDIO_FILE`        | No audio file in request | Include audio file in upload               |
| `FILE_TOO_LARGE`            | File exceeds size limit  | Compress or split file                     |
| `INVALID_DURATION`          | Duration outside limits  | Record within 10s-10min range              |
| `QUALITY_VALIDATION_FAILED` | Audio quality too low    | Improve recording conditions               |
| `QUOTA_EXCEEDED`            | User quota exceeded      | Upgrade subscription or delete old samples |

## Performance Optimization

### Upload Optimization

- **Chunked Uploads**: 64KB chunks for reliability
- **Progress Tracking**: Real-time upload progress
- **Retry Logic**: Automatic retry on failures
- **Compression**: Audio compression before upload

### Training Optimization

- **GPU Acceleration**: XTTS-v2 training on T4 GPUs
- **Batch Processing**: Multiple samples processed together
- **Caching**: Preprocessed samples cached for reuse
- **Queue Management**: Background job processing

## Integration Examples

### React Native Integration

```typescript
import { VoiceSampleRecording } from '../components/VoiceSampleRecording';
import { useVoiceSampleUpload } from '../hooks/useVoiceSampleUpload';

const VoiceSetupScreen = () => {
  const { uploadSample, createVoiceModel, modelCreationProgress } = useVoiceSampleUpload();

  const handleComplete = async (samples: VoiceSample[]) => {
    await createVoiceModel(samples, 'xtts-v2');
  };

  return (
    <VoiceSampleRecording
      onComplete={handleComplete}
      requirements={{
        minDuration: 60,
        recommendedSampleCount: 5,
      }}
    />
  );
};
```

### Backend Integration

```typescript
import { VoiceSampleManager } from '../services/VoiceSampleManager';

const voiceManager = new VoiceSampleManager({
  onSampleRecorded: (sample) => {
    console.log('Sample recorded:', sample.id);
  },
  onTrainingProgress: (progress) => {
    console.log('Training progress:', progress.progress);
  },
});

await voiceManager.startRecording();
```

## Related Documentation

- [TTS Multi-Provider Guide](./TTS-MULTI-PROVIDER.md)
- [Audio Processing Guide](./AUDIO-PROCESSING.md)
- [GCP Infrastructure](./GCP-INFRASTRUCTURE.md)
- [API Documentation](./API-DOCUMENTATION.md)
