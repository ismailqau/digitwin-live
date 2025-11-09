# Audio Processing and ASR

This document describes the audio processing and Automatic Speech Recognition (ASR) implementation for the Real-Time Conversational Clone system.

## Overview

The audio processing pipeline handles:

- Real-time audio capture from mobile devices
- Voice Activity Detection (VAD)
- Audio quality monitoring
- Streaming audio chunks over WebSocket
- Integration with Google Chirp ASR service

## Architecture

```
Mobile App                    Backend Services
┌─────────────────┐          ┌──────────────────┐
│  AudioManager   │          │   ASR Service    │
│                 │          │   (Chirp)        │
│  - Capture      │          │                  │
│  - VAD          │──────────▶  - Streaming     │
│  - Chunking     │ WebSocket│  - Transcription │
│  - Quality      │          │  - Punctuation   │
└─────────────────┘          └──────────────────┘
        │                             │
        ▼                             ▼
┌─────────────────┐          ┌──────────────────┐
│ Conversation    │          │  RAG Pipeline    │
│ Manager         │◀─────────│  + LLM           │
└─────────────────┘          └──────────────────┘
```

## Components

### 1. AudioManager

**Location:** `apps/mobile-app/src/services/AudioManager.ts`

**Responsibilities:**

- Capture audio at 16 kHz, mono, 16-bit PCM
- Create 100ms audio chunks for low latency
- Detect voice activity (VAD)
- Monitor audio quality (volume, SNR, clipping)
- Handle microphone permissions
- Manage recording state

**Key Features:**

- **Voice Activity Detection:** Detects when user is speaking vs silence
- **Audio Quality Monitoring:** Tracks volume, SNR, clipping, and silence
- **Buffer Management:** Prevents buffer overflow with automatic clearing
- **Error Recovery:** Handles device busy, permission denied, and other errors
- **Platform Support:** iOS and Android with platform-specific optimizations

**Usage Example:**

```typescript
import AudioManager, { AudioRecordingState } from './services/AudioManager';

const audioManager = new AudioManager(
  {
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16,
    chunkDuration: 100,
    vadThreshold: 30,
  },
  {
    onChunk: (chunk) => {
      console.log('Audio chunk:', chunk.sequenceNumber);
    },
    onQualityUpdate: (metrics) => {
      console.log('Volume:', metrics.volume, 'SNR:', metrics.snr);
    },
    onVoiceActivityDetected: (isActive) => {
      console.log('Voice active:', isActive);
    },
  }
);

// Start recording
await audioManager.startRecording();

// Stop recording
await audioManager.stopRecording();
```

### 2. ConversationManager

**Location:** `apps/mobile-app/src/services/ConversationManager.ts`

**Responsibilities:**

- Orchestrate audio recording and WebSocket communication
- Manage conversation state machine
- Handle automatic silence detection (500ms threshold)
- Send audio chunks to backend
- Process responses from backend
- Handle interruptions

**State Machine:**

```
IDLE ──connect──▶ CONNECTED ──startListening──▶ LISTENING
                                                     │
                                                     │ (silence detected)
                                                     ▼
                                              PROCESSING
                                                     │
                                                     │ (response ready)
                                                     ▼
                                               SPEAKING
                                                     │
                                                     │ (response complete)
                                                     ▼
                                                  IDLE
```

**Usage Example:**

```typescript
import ConversationManager from './services/ConversationManager';

const manager = new ConversationManager(
  {
    websocketUrl: 'ws://localhost:3001',
    authToken: 'your-jwt-token',
  },
  {
    onStateChange: (state) => console.log('State:', state),
    onTranscript: (text, isFinal, confidence) => {
      console.log('Transcript:', text, 'Final:', isFinal);
    },
    onResponseAudio: (audioData, sequence) => {
      // Play audio chunk
    },
  }
);

// Connect and start conversation
await manager.connect();
await manager.startListening();

// Interrupt if needed
await manager.interrupt();
```

### 3. useConversation Hook

**Location:** `apps/mobile-app/src/hooks/useConversation.ts`

**Responsibilities:**

- Provide React-friendly interface to ConversationManager
- Manage component lifecycle
- Handle state updates
- Expose conversation data and actions

**Usage Example:**

```typescript
import { useConversation } from './hooks/useConversation';

function MyComponent() {
  const {
    state,
    isConnected,
    isListening,
    data,
    connect,
    startListening,
    stopListening,
  } = useConversation({
    websocketUrl: 'ws://localhost:3001',
    authToken: 'your-jwt-token',
    autoConnect: true,
  });

  return (
    <View>
      <Text>State: {state}</Text>
      <Text>Transcript: {data.transcript}</Text>
      <Button onPress={startListening} title="Start" />
    </View>
  );
}
```

## Audio Configuration

### Optimal Settings

```typescript
{
  sampleRate: 16000,      // 16 kHz - optimal for speech
  channels: 1,            // Mono - reduces bandwidth
  bitDepth: 16,           // 16-bit - good quality/size balance
  chunkDuration: 100,     // 100ms - low latency
  vadThreshold: 30,       // 30% volume - adjustable sensitivity
}
```

### Why These Settings?

- **16 kHz Sample Rate:** Optimal for speech recognition, captures 0-8 kHz frequency range (human speech is 85-255 Hz fundamental, 2-4 kHz formants)
- **Mono:** Speech is mono, stereo adds no value and doubles bandwidth
- **16-bit:** Good quality without excessive data size
- **100ms Chunks:** Low latency while maintaining efficient network usage
- **30% VAD Threshold:** Balances sensitivity vs false positives

## Voice Activity Detection (VAD)

### How It Works

1. **Volume Monitoring:** Continuously measures audio volume (0-100%)
2. **Threshold Comparison:** Compares volume to configured threshold (default 30%)
3. **Activity State:** Sets voice active when volume exceeds threshold
4. **Silence Detection:** Detects silence when no activity for 500ms
5. **Auto-Stop:** Automatically stops recording after silence threshold

### Tuning VAD

```typescript
// More sensitive (picks up quieter speech)
vadThreshold: 20;

// Less sensitive (ignores background noise)
vadThreshold: 40;

// Adjust silence threshold
SILENCE_THRESHOLD_MS: 500; // Default
SILENCE_THRESHOLD_MS: 1000; // More patient
```

## Audio Quality Monitoring

### Metrics

1. **Volume (0-100%):**
   - < 10%: Too quiet
   - 10-30%: Quiet
   - 30-70%: Good
   - 70-95%: Loud
   - > 95%: Clipping risk

2. **Signal-to-Noise Ratio (SNR):**
   - < 10 dB: Very noisy
   - 10-20 dB: Noisy
   - 20-30 dB: Acceptable
   - > 30 dB: Good

3. **Clipping Detection:**
   - Detects when volume > 95%
   - Indicates audio distortion
   - User should reduce volume or distance

4. **Silence Detection:**
   - Detects when volume < 5%
   - Indicates no speech input
   - May trigger auto-stop

### Handling Quality Issues

```typescript
onAudioQuality: (metrics) => {
  if (metrics.isClipping) {
    showWarning('Please speak more softly or move away from microphone');
  }

  if (metrics.snr < 10) {
    showWarning('Background noise detected. Find a quieter location');
  }

  if (metrics.isSilent && isListening) {
    showInfo('Waiting for speech...');
  }
};
```

## WebSocket Protocol

### Message Types

**Client → Server:**

```typescript
// Audio chunk
{
  type: 'audio_chunk',
  sessionId: 'session_123',
  sequenceNumber: 42,
  audioData: 'base64-encoded-pcm',
  timestamp: 1699564800000
}

// End of utterance
{
  type: 'end_utterance',
  sessionId: 'session_123',
  timestamp: 1699564800000
}

// Interruption
{
  type: 'interruption',
  sessionId: 'session_123',
  timestamp: 1699564800000
}
```

**Server → Client:**

```typescript
// Transcript (interim or final)
{
  type: 'transcript',
  sessionId: 'session_123',
  transcript: 'Hello world',
  isFinal: true,
  confidence: 0.95
}

// Response audio chunk
{
  type: 'response_audio',
  sessionId: 'session_123',
  turnId: 'turn_456',
  audioData: 'base64-encoded-audio',
  sequenceNumber: 1,
  timestamp: 1699564801000
}
```

## Error Handling

### Common Errors

1. **Permission Denied:**
   - User denied microphone access
   - Show permission request dialog
   - Provide instructions to enable in settings

2. **Device Busy:**
   - Another app is using microphone
   - Ask user to close other apps
   - Retry after delay

3. **Buffer Overflow:**
   - Audio buffer exceeded 10,000 samples
   - Automatically cleared
   - May indicate processing lag

4. **WebSocket Disconnection:**
   - Network issue or server restart
   - Automatic reconnection with exponential backoff
   - Queue messages during disconnection

### Error Recovery

```typescript
onError: (error, recoverable) => {
  if (recoverable) {
    // Show retry button
    showRetryButton();
  } else {
    // Show error message and disconnect
    showError(error);
    disconnect();
  }
};
```

## Performance Optimization

### Latency Targets

- **Audio Capture:** < 100ms (chunk duration)
- **Network Transmission:** < 50ms (local network)
- **ASR Processing:** < 300ms (Chirp streaming)
- **Total Input Latency:** < 450ms

### Bandwidth Usage

- **Audio Stream:** ~32 kbps (16 kHz × 16-bit × 1 channel)
- **100ms Chunks:** ~400 bytes per chunk
- **10 chunks/second:** ~4 KB/s
- **1 minute conversation:** ~240 KB

### Battery Optimization

1. **Stop Recording When Idle:** Don't record when not in conversation
2. **Reduce Sample Rate:** Consider 8 kHz for lower quality mode
3. **Disable Video:** Audio-only mode saves significant battery
4. **Background Mode:** Pause when app is backgrounded

## Testing

### Unit Tests

```bash
cd apps/mobile-app
pnpm test
```

### Manual Testing Checklist

- [ ] Microphone permission request works
- [ ] Audio recording starts and stops correctly
- [ ] VAD detects speech and silence
- [ ] Audio quality metrics are accurate
- [ ] Chunks are sent over WebSocket
- [ ] Transcripts are received and displayed
- [ ] Interruption works during response
- [ ] Error handling works for all error types
- [ ] Works on both iOS and Android
- [ ] Works with headphones and Bluetooth

## Troubleshooting

### No Audio Captured

1. Check microphone permissions
2. Verify no other app is using microphone
3. Test with device's voice recorder app
4. Check audio configuration matches device capabilities

### Poor Transcription Quality

1. Check audio quality metrics (volume, SNR)
2. Reduce background noise
3. Speak clearly and at normal pace
4. Adjust VAD threshold if needed
5. Verify 16 kHz sample rate is used

### High Latency

1. Check network connection quality
2. Verify WebSocket connection is stable
3. Monitor backend ASR service performance
4. Consider reducing chunk duration (trade-off with bandwidth)

### Battery Drain

1. Ensure recording stops when idle
2. Disable video if not needed
3. Consider lower sample rate (8 kHz)
4. Check for memory leaks in audio processing

## Next Steps

- [ ] Implement audio playback for TTS responses (Task 3.1)
- [ ] Integrate Google Chirp ASR service in backend (Task 3.2)
- [ ] Add audio preprocessing and enhancement (Task 3.3)
- [ ] Implement audio caching strategy (Task 3.4)

## Related Documentation

- [WebSocket Server](../apps/websocket-server/README.md)
- [Shared Types](../packages/shared-types/README.md)
- [API Client](../packages/api-client/README.md)
- [Design Document](../.kiro/specs/real-time-conversational-clone/design.md)
- [Requirements](../.kiro/specs/real-time-conversational-clone/requirements.md)
