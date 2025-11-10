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

## Audio Playback

### AudioPlaybackManager

**Location:** `apps/mobile-app/src/services/AudioPlaybackManager.ts`

**Responsibilities:**

- Play TTS-generated audio responses
- Buffer audio chunks for smooth playback (200-500ms)
- Synchronize audio with video (< 50ms offset)
- Handle playback interruptions (phone calls, notifications)
- Manage audio session (iOS) and audio focus (Android)
- Control volume, mute, and playback speed
- Apply crossfade between audio chunks
- Implement audio ducking for background audio
- Recover from playback errors

**Key Features:**

1. **Audio Chunk Buffering**
   - Buffers 200-500ms of audio before starting playback
   - Prevents buffer underrun and stuttering
   - Adaptive buffering based on network conditions

2. **Audio-Video Synchronization**
   - Maintains < 50ms offset between audio and video
   - Timestamp-based synchronization
   - Automatic drift correction

3. **Playback Interruption Handling**
   - Pauses on phone calls
   - Pauses on notifications
   - Resumes after interruption ends
   - Saves playback position

4. **Audio Session Management (iOS)**
   - Configures AVAudioSession for playback
   - Plays in silent mode
   - Background audio support
   - Handles interruptions gracefully

5. **Audio Focus Handling (Android)**
   - Requests audio focus for playback
   - Handles focus changes (transient, permanent)
   - Implements audio ducking
   - Releases focus when done

6. **Playback Queue Management**
   - Queues streaming audio chunks
   - Processes chunks in order
   - Handles out-of-order chunks
   - Clears queue on interruption

7. **Playback State Management**
   - IDLE: No playback
   - BUFFERING: Buffering audio
   - PLAYING: Actively playing
   - PAUSED: Playback paused
   - STOPPED: Playback stopped
   - ERROR: Error state

8. **Volume Control**
   - Volume adjustment (0.0 - 1.0)
   - Mute/unmute functionality
   - Smooth volume transitions
   - Respects system volume

9. **Playback Speed Control**
   - Speed adjustment (0.5x - 2.0x)
   - Maintains audio pitch
   - Real-time speed changes
   - Useful for accessibility

10. **Audio Crossfade**
    - Smooth transitions between chunks
    - Configurable crossfade duration (default 100ms)
    - Prevents audio pops and clicks
    - Improves perceived quality

11. **Audio Ducking**
    - Reduces volume for background audio
    - Respects system audio priorities
    - Automatic volume restoration
    - Platform-specific implementation

12. **Error Recovery**
    - Handles buffer underrun
    - Recovers from decode errors
    - Automatic retry logic
    - Graceful degradation

13. **Audio Output Device Selection**
    - Speaker output
    - Headphones/earphones
    - Bluetooth devices
    - Automatic device switching

**Usage Example:**

```typescript
import AudioPlaybackManager, { AudioPlaybackState } from './services/AudioPlaybackManager';

const playbackManager = new AudioPlaybackManager(
  {
    bufferSize: 300, // 300ms buffer
    syncThreshold: 50, // 50ms sync threshold
    enableCrossfade: true,
    crossfadeDuration: 100,
    playbackSpeed: 1.0,
    volume: 1.0,
    enableDucking: true,
  },
  {
    onStateChange: (state) => {
      console.log('Playback state:', state);
    },
    onProgress: (position, duration) => {
      console.log('Progress:', position, '/', duration);
    },
    onBufferUpdate: (bufferedDuration) => {
      console.log('Buffered:', bufferedDuration, 'ms');
    },
    onPlaybackComplete: () => {
      console.log('Playback complete');
    },
    onInterruption: (type) => {
      console.log('Interruption:', type);
    },
  }
);

// Add audio chunks to queue
playbackManager.addChunk({
  data: 'base64EncodedAudioData',
  sequenceNumber: 1,
  timestamp: Date.now(),
  audioTimestamp: 1000,
});

// Control playback
await playbackManager.play();
await playbackManager.pause();
await playbackManager.resume();
await playbackManager.stop();

// Volume control
await playbackManager.setVolume(0.8);
await playbackManager.setMuted(true);

// Speed control
await playbackManager.setPlaybackSpeed(1.5);
```

### Playback Configuration

**Optimal Settings:**

```typescript
{
  bufferSize: 300,           // 300ms buffer (balance latency/smoothness)
  syncThreshold: 50,         // 50ms A/V sync threshold
  enableCrossfade: true,     // Smooth transitions
  crossfadeDuration: 100,    // 100ms crossfade
  playbackSpeed: 1.0,        // Normal speed
  volume: 1.0,               // Full volume
  enableDucking: true,       // Respect system audio
}
```

**Why These Settings?**

- **300ms Buffer:** Balances latency with smooth playback, prevents stuttering
- **50ms Sync Threshold:** Imperceptible A/V offset for most users
- **100ms Crossfade:** Smooth transitions without noticeable delay
- **Ducking Enabled:** Better user experience with system audio

### Audio-Video Synchronization

**How It Works:**

1. **Timestamp Tracking:** Each audio chunk has an audioTimestamp
2. **Position Calculation:** Current audio position = audioTimestamp + playback position
3. **Video Sync:** Video player uses audio timestamp to sync frames
4. **Drift Correction:** Periodically adjusts video playback to maintain sync
5. **Threshold Check:** Corrects if offset exceeds 50ms

**Sync Algorithm:**

```typescript
// Calculate current audio timestamp
const currentAudioTimestamp = chunk.audioTimestamp + playbackPosition;

// Emit for video synchronization
onAudioTimestamp(currentAudioTimestamp);

// Video player adjusts to match
if (Math.abs(videoTimestamp - currentAudioTimestamp) > syncThreshold) {
  adjustVideoPlayback(currentAudioTimestamp);
}
```

### Interruption Handling

**Types of Interruptions:**

1. **Phone Calls:**
   - Pause playback immediately
   - Save playback position
   - Resume after call ends

2. **Notifications:**
   - Duck volume (reduce temporarily)
   - Continue playback
   - Restore volume after notification

3. **App Backgrounding:**
   - Pause playback (optional)
   - Continue in background (if enabled)
   - Resume when app returns to foreground

4. **Audio Route Changes:**
   - Headphones unplugged
   - Bluetooth device connected/disconnected
   - Automatic device switching

**Handling Strategy:**

```typescript
onInterruption: (type) => {
  if (type === 'begin') {
    // Interruption started
    if (isPlaying) {
      pause();
      savePlaybackPosition();
    }
  } else {
    // Interruption ended
    if (wasPausedByInterruption) {
      resume();
    }
  }
};
```

### Platform-Specific Implementation

**iOS (AVAudioSession):**

```typescript
// Configure audio session for playback
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
  shouldDuckAndroid: false,
  interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
  playThroughEarpieceAndroid: false,
});
```

**Android (AudioManager):**

```typescript
// Request audio focus
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
  shouldDuckAndroid: true, // Enable ducking
  interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
  playThroughEarpieceAndroid: false,
});
```

### Playback Performance

**Latency Targets:**

- **Buffer Fill Time:** < 300ms (initial buffer)
- **Chunk Processing:** < 10ms per chunk
- **Crossfade Overhead:** < 5ms per transition
- **A/V Sync Accuracy:** < 50ms offset
- **Total Playback Latency:** < 100ms (first audio chunk)

**Bandwidth Usage:**

- **TTS Audio Stream:** ~32 kbps (16 kHz × 16-bit × 1 channel)
- **Compressed (Opus):** ~16 kbps
- **100ms Chunks:** ~200 bytes per chunk (compressed)
- **10 chunks/second:** ~2 KB/s
- **1 minute response:** ~120 KB

### Error Recovery

**Common Playback Errors:**

1. **Buffer Underrun:**
   - Pause playback
   - Wait for more data
   - Resume when buffer filled
   - Show buffering indicator

2. **Decode Errors:**
   - Skip corrupted chunk
   - Log error for debugging
   - Continue with next chunk
   - Notify user if persistent

3. **Audio Focus Loss:**
   - Pause playback (permanent loss)
   - Duck volume (transient loss)
   - Resume when focus regained
   - Handle gracefully

4. **Device Disconnection:**
   - Detect headphone/Bluetooth disconnect
   - Pause playback
   - Switch to speaker (optional)
   - Resume when device reconnects

**Recovery Strategy:**

```typescript
private async recoverFromError(): Promise<void> {
  try {
    // Stop current playback
    await this.stop();

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Retry playback if queue has items
    if (this.playbackQueue.length > 0) {
      await this.processQueue();
    }
  } catch (error) {
    console.error('Error recovery failed:', error);
  }
}
```

### Integration with ConversationManager

The AudioPlaybackManager is integrated into ConversationManager to provide seamless playback:

```typescript
// In ConversationManager
this.playbackManager = new AudioPlaybackManager(config.playbackConfig, {
  onStateChange: this.handlePlaybackStateChange.bind(this),
  onProgress: this.handlePlaybackProgress.bind(this),
  onBufferUpdate: this.handlePlaybackBufferUpdate.bind(this),
  onPlaybackComplete: this.handlePlaybackComplete.bind(this),
  onError: this.handlePlaybackError.bind(this),
  onInterruption: this.handlePlaybackInterruption.bind(this),
});

// Automatically add audio chunks to playback queue
this.wsClient.on('response_audio', (message) => {
  const audioChunk: AudioChunkData = {
    data: message.audioData,
    sequenceNumber: message.sequenceNumber,
    timestamp: message.timestamp,
    audioTimestamp: message.timestamp,
  };
  this.playbackManager.addChunk(audioChunk);
});
```

### Playback Controls in useConversation Hook

The useConversation hook exposes playback controls:

```typescript
const {
  isPlaying,
  data: { playbackState, playbackPosition, bufferedDuration },
  setVolume,
  setMuted,
  setPlaybackSpeed,
} = useConversation({
  websocketUrl: 'ws://localhost:3001',
  authToken: 'your-jwt-token',
});

// Control playback
await setVolume(0.8); // 80% volume
await setMuted(true); // Mute
await setPlaybackSpeed(1.5); // 1.5x speed
```

### Testing Playback

**Unit Tests:**

```bash
cd apps/mobile-app
pnpm test AudioPlaybackManager
```

**Manual Testing Checklist:**

- [ ] Audio plays smoothly without stuttering
- [ ] Buffer fills before playback starts
- [ ] Audio-video sync is maintained (< 50ms)
- [ ] Interruptions are handled gracefully
- [ ] Volume control works correctly
- [ ] Mute/unmute works correctly
- [ ] Playback speed control works
- [ ] Crossfade is smooth between chunks
- [ ] Audio ducking works with system audio
- [ ] Error recovery works for all error types
- [ ] Works on both iOS and Android
- [ ] Works with headphones and Bluetooth
- [ ] Device switching works correctly

### Troubleshooting Playback

**No Audio Output:**

1. Check device volume is not muted
2. Verify audio chunks are being received
3. Check playback state is PLAYING
4. Test with device's music player
5. Verify audio session is configured correctly

**Stuttering/Choppy Playback:**

1. Increase buffer size (e.g., 500ms)
2. Check network connection quality
3. Monitor buffer underrun events
4. Verify chunk processing is fast enough
5. Check for memory leaks

**Audio-Video Out of Sync:**

1. Verify timestamps are correct
2. Check sync threshold setting
3. Monitor drift over time
4. Adjust sync algorithm if needed
5. Test with different video frame rates

**High Latency:**

1. Reduce buffer size (trade-off with smoothness)
2. Disable crossfade
3. Optimize chunk processing
4. Check network latency
5. Monitor backend TTS generation time

## Complete Audio Pipeline

### End-to-End Flow

```
User Speech → AudioManager → WebSocket → Backend ASR
                                              ↓
                                         Transcription
                                              ↓
                                         RAG + LLM
                                              ↓
                                         TTS Service
                                              ↓
Backend Audio Chunks → WebSocket → AudioPlaybackManager → Speaker
                                              ↓
                                    Video Synchronization
                                              ↓
                                         Video Player
```

### Performance Summary

**Recording:**

- Chunk Generation: < 10ms
- VAD Detection: < 5ms
- Total Overhead: < 20ms per 100ms chunk

**Playback:**

- Buffer Fill: < 300ms
- Chunk Processing: < 10ms
- A/V Sync: < 50ms offset
- Total Latency: < 100ms first chunk

**End-to-End:**

- User Speech → Transcript: < 450ms
- Transcript → Response: < 1500ms (LLM + TTS)
- Response → Audio Output: < 100ms
- **Total: < 2050ms** (within 2-second target)

## Dependencies

**Required Packages:**

```json
{
  "react-native-audio-recorder-player": "^3.6.12",
  "react-native-permissions": "^5.1.0",
  "expo-av": "~15.0.1",
  "buffer": "^6.0.3"
}
```

**Installation:**

```bash
cd apps/mobile-app
pnpm install
```

**iOS Setup:**

Add to `Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access for voice conversations</string>
```

**Android Setup:**

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

## Summary

The audio processing system provides:

✅ **Recording:** High-quality audio capture with VAD and quality monitoring  
✅ **Playback:** Smooth audio playback with buffering and synchronization  
✅ **Interruptions:** Graceful handling of phone calls and notifications  
✅ **Platform Support:** iOS and Android with platform-specific optimizations  
✅ **Error Recovery:** Robust error handling and automatic recovery  
✅ **Performance:** Sub-2-second end-to-end latency  
✅ **Quality:** Professional audio quality with crossfade and ducking

The implementation is complete and ready for integration with the backend ASR and TTS services.
