# Audio Preprocessing and Enhancement

This document describes the audio preprocessing and enhancement capabilities used to optimize audio quality before ASR (Automatic Speech Recognition) processing.

## Overview

The Audio Preprocessing Service provides a comprehensive pipeline for processing raw audio input to ensure optimal quality for speech recognition. It handles normalization, silence detection, quality assessment, echo cancellation, format conversion, compression, metadata extraction, and validation.

## Features

### 1. Audio Normalization

Automatically adjusts audio volume to a target level for consistent processing.

- **Target Level**: -20 dB RMS (configurable)
- **Prevents Clipping**: Applies gain limiting to prevent distortion
- **Adaptive**: Analyzes current audio level and applies appropriate gain

**Use Cases:**

- Normalize user recordings with varying microphone distances
- Ensure consistent volume across different devices
- Prepare audio for ASR processing

### 2. Silence Detection and Trimming

Identifies and optionally removes silence segments from audio.

- **Threshold**: -40 dB (configurable)
- **Minimum Duration**: 0.5 seconds (configurable)
- **Precision**: 20ms window analysis

**Use Cases:**

- Remove leading/trailing silence from recordings
- Identify speech segments in long audio files
- Calculate speech-to-silence ratio for quality metrics

### 3. Audio Quality Assessment

Comprehensive quality analysis with actionable recommendations.

**Metrics:**

- **SNR (Signal-to-Noise Ratio)**: Measures background noise level
- **Clarity Score**: 0-100 composite quality score
- **Volume Level**: RMS level in dB
- **Clipping Detection**: Identifies audio distortion
- **Silence Ratio**: Percentage of silence in audio

**Quality Thresholds:**

- SNR > 20 dB: Acceptable
- Volume: -40 dB to -10 dB range
- Clipping: < 1% of samples
- Silence: < 50% of duration

### 4. Echo Cancellation

Reduces echo and reverberation for clearer speech.

- **Adaptive Filtering**: Removes delayed reflections
- **Typical Delay**: 50ms echo cancellation
- **Attenuation**: 30% echo reduction

**Use Cases:**

- Improve audio from rooms with poor acoustics
- Reduce echo from speakerphone conversations
- Enhance ASR accuracy

### 5. Format Conversion

Converts audio to optimal format for ASR processing.

**Target Format:**

- **Sample Rate**: 16 kHz (optimal for speech)
- **Channels**: Mono (1 channel)
- **Bit Depth**: 16-bit PCM

**Supported Conversions:**

- Sample rate resampling (8 kHz - 48 kHz)
- Stereo to mono conversion
- Bit depth conversion (8, 16, 24, 32-bit)

### 6. Audio Compression

Reduces audio size for efficient storage and transmission.

- **Quality-Based**: 0-100 quality setting
- **Compression Ratio**: Typically 40-60% size reduction
- **Lossless Option**: Maintains full quality when needed

**Use Cases:**

- Reduce bandwidth for streaming
- Optimize storage costs
- Faster upload/download times

### 7. Metadata Extraction

Extracts comprehensive audio file information.

**Extracted Data:**

- Duration (seconds)
- Sample rate (Hz)
- Channel count
- Bit depth
- File format (WAV, MP3, etc.)
- Codec information
- File size

### 8. Audio Validation

Detects corrupted or invalid audio files.

**Validation Checks:**

- File format verification
- Header integrity
- Sample rate validation (8-48 kHz)
- Channel count validation (1-2)
- Bit depth validation (8, 16, 24, 32-bit)
- Duration validation (0-3600 seconds)
- Data corruption detection

## Usage

### Basic Usage

```typescript
import { AudioPreprocessingService } from '@clone/asr-service';

const preprocessor = new AudioPreprocessingService();

// Process audio with default settings
const processedAudio = await preprocessor.processAudio(audioBuffer);

// Check quality
const quality = await preprocessor.assessQuality(processedAudio);
console.log('Quality Score:', quality.clarityScore);
console.log('Acceptable:', quality.isAcceptable);
```

### Custom Configuration

```typescript
import { AudioPreprocessingService } from '@clone/asr-service';

const preprocessor = new AudioPreprocessingService({
  targetSampleRate: 16000,
  targetChannels: 1,
  targetBitDepth: 16,
  normalizeVolume: true,
  targetVolumeDb: -20,
  removeSilence: false,
  silenceThresholdDb: -40,
  minSilenceDuration: 0.5,
  enableEchoCancellation: true,
  enableNoiseReduction: true,
  compressionQuality: 80,
});

const processedAudio = await preprocessor.processAudio(audioBuffer);
```

### Individual Operations

```typescript
// Normalize volume
const normalized = await preprocessor.normalizeVolume(audioBuffer, -20);

// Detect silence
const silenceSegments = await preprocessor.detectSilence(audioBuffer);
console.log('Silence segments:', silenceSegments);

// Trim silence
const trimmed = await preprocessor.trimSilence(audioBuffer);

// Assess quality
const quality = await preprocessor.assessQuality(audioBuffer);
if (!quality.isAcceptable) {
  console.log('Recommendations:', quality.recommendations);
}

// Cancel echo
const echoFree = await preprocessor.cancelEcho(audioBuffer);

// Convert format
const converted = await preprocessor.convertFormat(audioBuffer, {
  targetSampleRate: 16000,
  targetChannels: 1,
  targetBitDepth: 16,
});

// Compress audio
const compressed = await preprocessor.compressAudio(audioBuffer, 80);

// Extract metadata
const metadata = await preprocessor.extractMetadata(audioData);
console.log('Duration:', metadata.duration, 'seconds');

// Validate audio
const validation = await preprocessor.validateAudio(audioData);
if (!validation.isValid) {
  console.log('Errors:', validation.errors);
}
```

## Integration with ASR Service

The audio preprocessing service is integrated into the ASR pipeline:

```typescript
import { ASRService, audioPreprocessing } from '@clone/asr-service';

// Preprocess audio before ASR
const processedAudio = await audioPreprocessing.processAudio(rawAudio);

// Check quality
const quality = await audioPreprocessing.assessQuality(processedAudio);
if (!quality.isAcceptable) {
  logger.warn('Low audio quality', { recommendations: quality.recommendations });
}

// Send to ASR
const transcript = await asrService.transcribe(processedAudio);
```

## Configuration

### Environment Variables

```bash
# Audio preprocessing settings
AUDIO_TARGET_SAMPLE_RATE=16000
AUDIO_TARGET_CHANNELS=1
AUDIO_TARGET_BIT_DEPTH=16
AUDIO_NORMALIZE_VOLUME=true
AUDIO_TARGET_VOLUME_DB=-20
AUDIO_REMOVE_SILENCE=false
AUDIO_SILENCE_THRESHOLD_DB=-40
AUDIO_MIN_SILENCE_DURATION=0.5
AUDIO_ENABLE_ECHO_CANCELLATION=true
AUDIO_ENABLE_NOISE_REDUCTION=true
AUDIO_COMPRESSION_QUALITY=80
```

### Recommended Settings

**For Real-Time Conversations:**

```typescript
{
  targetSampleRate: 16000,
  targetChannels: 1,
  normalizeVolume: true,
  removeSilence: false, // Keep natural pauses
  enableEchoCancellation: true,
}
```

**For Voice Model Training:**

```typescript
{
  targetSampleRate: 22050,
  targetChannels: 1,
  normalizeVolume: true,
  removeSilence: true, // Remove silence for cleaner samples
  enableEchoCancellation: true,
  enableNoiseReduction: true,
}
```

**For Document Processing:**

```typescript
{
  targetSampleRate: 16000,
  targetChannels: 1,
  normalizeVolume: true,
  removeSilence: true, // Remove long pauses
  enableEchoCancellation: false, // Not needed for recordings
}
```

## Quality Guidelines

### Acceptable Audio Quality

- **SNR**: > 20 dB
- **Volume Level**: -40 dB to -10 dB
- **Clipping**: < 1% of samples
- **Silence Ratio**: < 50%
- **Clarity Score**: > 70

### Common Issues and Solutions

| Issue                      | Recommendation                     |
| -------------------------- | ---------------------------------- |
| Low SNR (< 20 dB)          | Record in quieter environment      |
| Clipping detected          | Reduce microphone gain or distance |
| Volume too low (< -40 dB)  | Speak louder or move closer to mic |
| Volume too high (> -10 dB) | Reduce gain or increase distance   |
| High silence ratio (> 50%) | Ensure continuous speech           |

## Performance

### Processing Times (Typical)

- **Normalization**: ~10ms per second of audio
- **Silence Detection**: ~15ms per second of audio
- **Quality Assessment**: ~20ms per second of audio
- **Echo Cancellation**: ~30ms per second of audio
- **Format Conversion**: ~25ms per second of audio
- **Full Pipeline**: ~100ms per second of audio

### Memory Usage

- **Input Buffer**: ~2 MB per minute (16 kHz, 16-bit, mono)
- **Processing Overhead**: ~4 MB per minute
- **Peak Memory**: ~6 MB per minute of audio

## Error Handling

```typescript
import { AudioProcessingError } from '@clone/service-errors';

try {
  const processed = await preprocessor.processAudio(audioBuffer);
} catch (error) {
  if (error instanceof AudioProcessingError) {
    logger.error('Audio processing failed', {
      message: error.message,
      code: error.code,
      retryable: error.retryable,
    });

    // Handle specific errors
    if (error.message.includes('Invalid audio format')) {
      // Prompt user to upload correct format
    }
  }
}
```

## Best Practices

1. **Always validate audio before processing**

   ```typescript
   const validation = await preprocessor.validateAudio(audioData);
   if (!validation.isValid) {
     throw new Error(`Invalid audio: ${validation.errors.join(', ')}`);
   }
   ```

2. **Check quality after preprocessing**

   ```typescript
   const quality = await preprocessor.assessQuality(processedAudio);
   if (!quality.isAcceptable) {
     logger.warn('Low quality audio', { recommendations: quality.recommendations });
   }
   ```

3. **Use appropriate settings for use case**
   - Real-time: Keep silence, enable echo cancellation
   - Training: Remove silence, enable noise reduction
   - Batch: Optimize for quality over speed

4. **Monitor processing times**

   ```typescript
   const startTime = Date.now();
   const processed = await preprocessor.processAudio(audioBuffer);
   const processingTime = Date.now() - startTime;
   logger.info('Audio processed', { duration: audioBuffer.duration, processingTime });
   ```

5. **Handle errors gracefully**
   - Provide clear error messages to users
   - Log detailed error information for debugging
   - Implement retry logic for transient failures

## Limitations

1. **Echo Cancellation**: Simplified implementation, not as effective as dedicated hardware/software solutions
2. **Noise Reduction**: Basic implementation, may not handle all noise types
3. **Format Support**: Currently optimized for WAV format, limited support for other formats
4. **Real-Time Processing**: Processing adds latency, optimize settings for real-time use cases

## Future Enhancements

- [ ] Advanced noise reduction using spectral subtraction
- [ ] Support for more audio formats (MP3, AAC, FLAC)
- [ ] GPU-accelerated processing for faster performance
- [ ] Machine learning-based quality enhancement
- [ ] Adaptive preprocessing based on audio characteristics
- [ ] Real-time streaming preprocessing

## Related Documentation

- [ASR Service](./ASR-SERVICE.md) - Speech recognition service
- [Audio Processing Pipeline](./AUDIO-PROCESSING.md) - Complete audio pipeline
- [Caching Architecture](./CACHING-ARCHITECTURE.md) - Audio caching strategy
- [Database Architecture](./DATABASE-ARCHITECTURE.md) - Audio metadata storage

## Support

For issues or questions about audio preprocessing:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review audio quality metrics and recommendations
3. Consult the [API Documentation](./API-DOCUMENTATION.md)
4. Contact the development team

## References

- [Google Speech-to-Text Best Practices](https://cloud.google.com/speech-to-text/docs/best-practices)
- [Audio Signal Processing Fundamentals](https://en.wikipedia.org/wiki/Audio_signal_processing)
- [WAV File Format Specification](http://soundfile.sapp.org/doc/WaveFormat/)
