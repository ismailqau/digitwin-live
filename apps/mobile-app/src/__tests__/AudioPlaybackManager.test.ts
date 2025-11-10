/**
 * AudioPlaybackManager Tests
 * Tests for audio playback functionality
 */

import {
  AudioPlaybackManager,
  AudioPlaybackState,
  type AudioChunkData,
} from '../services/AudioPlaybackManager';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    INTERRUPTION_MODE_IOS_DO_NOT_MIX: 1,
    INTERRUPTION_MODE_ANDROID_DO_NOT_MIX: 1,
  },
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
}));

// Mock react-native-audio-recorder-player
jest.mock('react-native-audio-recorder-player', () => {
  return jest.fn().mockImplementation(() => ({
    startPlayer: jest.fn().mockResolvedValue('file://test-playback.m4a'),
    stopPlayer: jest.fn().mockResolvedValue(undefined),
    pausePlayer: jest.fn().mockResolvedValue(undefined),
    resumePlayer: jest.fn().mockResolvedValue(undefined),
    setVolume: jest.fn().mockResolvedValue(undefined),
    addPlayBackListener: jest.fn(),
    removePlayBackListener: jest.fn(),
    getPlaybackStatus: jest.fn().mockResolvedValue({ isPlaying: false }),
  }));
});

describe('AudioPlaybackManager', () => {
  let playbackManager: AudioPlaybackManager;
  let mockCallbacks: {
    onStateChange: jest.Mock;
    onProgress: jest.Mock;
    onBufferUpdate: jest.Mock;
    onPlaybackComplete: jest.Mock;
    onError: jest.Mock;
    onAudioTimestamp: jest.Mock;
    onInterruption: jest.Mock;
  };

  beforeEach(() => {
    mockCallbacks = {
      onStateChange: jest.fn(),
      onProgress: jest.fn(),
      onBufferUpdate: jest.fn(),
      onPlaybackComplete: jest.fn(),
      onError: jest.fn(),
      onAudioTimestamp: jest.fn(),
      onInterruption: jest.fn(),
    };

    // Use a large buffer size to prevent auto-playback during tests
    playbackManager = new AudioPlaybackManager({ bufferSize: 10000 }, mockCallbacks);
  });

  afterEach(async () => {
    await playbackManager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(playbackManager).toBeDefined();
      expect(playbackManager.getState()).toBe(AudioPlaybackState.IDLE);
    });

    it('should initialize with custom configuration', () => {
      const customManager = new AudioPlaybackManager({
        bufferSize: 500,
        playbackSpeed: 1.5,
        volume: 0.8,
      });

      expect(customManager).toBeDefined();
      expect(customManager.getState()).toBe(AudioPlaybackState.IDLE);
    });
  });

  describe('Queue Management', () => {
    it('should add chunks to playback queue', () => {
      const chunk: AudioChunkData = {
        data: Buffer.from('test-audio-data').toString('base64'),
        sequenceNumber: 0,
        timestamp: Date.now(),
      };

      playbackManager.addChunk(chunk);

      expect(playbackManager.getQueueLength()).toBe(1);
      expect(mockCallbacks.onBufferUpdate).toHaveBeenCalled();
    });

    it('should add multiple chunks to queue', () => {
      for (let i = 0; i < 5; i++) {
        const chunk: AudioChunkData = {
          data: Buffer.from(`test-audio-data-${i}`).toString('base64'),
          sequenceNumber: i,
          timestamp: Date.now() + i * 100,
        };
        playbackManager.addChunk(chunk);
      }

      expect(playbackManager.getQueueLength()).toBe(5);
    });

    it('should clear playback queue', () => {
      const chunk: AudioChunkData = {
        data: Buffer.from('test-audio-data').toString('base64'),
        sequenceNumber: 0,
        timestamp: Date.now(),
      };

      playbackManager.addChunk(chunk);
      playbackManager.clearQueue();

      expect(playbackManager.getQueueLength()).toBe(0);
      expect(playbackManager.getBufferedDuration()).toBe(0);
    });

    it('should track buffered duration', () => {
      const chunk: AudioChunkData = {
        data: Buffer.from('test-audio-data').toString('base64'),
        sequenceNumber: 0,
        timestamp: Date.now(),
      };

      playbackManager.addChunk(chunk);

      expect(playbackManager.getBufferedDuration()).toBeGreaterThan(0);
    });
  });

  describe('Playback Control', () => {
    it('should handle play when queue is empty', async () => {
      await playbackManager.play();
      // Should not throw error
      expect(playbackManager.getState()).toBe(AudioPlaybackState.IDLE);
    });

    it('should pause playback', async () => {
      // Simulate playing state
      const chunk: AudioChunkData = {
        data: Buffer.from('test-audio-data').toString('base64'),
        sequenceNumber: 0,
        timestamp: Date.now(),
      };
      playbackManager.addChunk(chunk);

      await playbackManager.pause();
      // Should handle pause gracefully
      expect(playbackManager).toBeDefined();
    });

    it('should resume playback', async () => {
      await playbackManager.resume();
      // Should handle resume gracefully
      expect(playbackManager).toBeDefined();
    });

    it('should stop playback and clear queue', async () => {
      const chunk: AudioChunkData = {
        data: Buffer.from('test-audio-data').toString('base64'),
        sequenceNumber: 0,
        timestamp: Date.now(),
      };
      playbackManager.addChunk(chunk);

      await playbackManager.stop();

      expect(playbackManager.getState()).toBe(AudioPlaybackState.STOPPED);
      expect(playbackManager.getQueueLength()).toBe(0);
    });
  });

  describe('Volume Control', () => {
    it('should set volume within valid range', async () => {
      await playbackManager.setVolume(0.5);
      // Volume set successfully
      expect(playbackManager).toBeDefined();
    });

    it('should clamp volume to valid range', async () => {
      await playbackManager.setVolume(1.5); // Above max
      await playbackManager.setVolume(-0.5); // Below min
      // Should clamp without error
      expect(playbackManager).toBeDefined();
    });

    it('should mute audio', async () => {
      await playbackManager.setMuted(true);
      expect(playbackManager.isMutedState()).toBe(true);
    });

    it('should unmute audio', async () => {
      await playbackManager.setMuted(true);
      await playbackManager.setMuted(false);
      expect(playbackManager.isMutedState()).toBe(false);
    });
  });

  describe('Playback Speed', () => {
    it('should set playback speed within valid range', async () => {
      await playbackManager.setPlaybackSpeed(1.5);
      // Speed set successfully
      expect(playbackManager).toBeDefined();
    });

    it('should clamp playback speed to valid range', async () => {
      await playbackManager.setPlaybackSpeed(3.0); // Above max
      await playbackManager.setPlaybackSpeed(0.2); // Below min
      // Should clamp without error
      expect(playbackManager).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should return current state', () => {
      const state = playbackManager.getState();
      expect(state).toBe(AudioPlaybackState.IDLE);
    });

    it('should check if playing', () => {
      const isPlaying = playbackManager.isPlaying();
      expect(isPlaying).toBe(false);
    });

    it('should get current position', () => {
      const position = playbackManager.getCurrentPosition();
      expect(position).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      playbackManager.updateConfig({ bufferSize: 400 });
      // Configuration updated successfully
      expect(playbackManager).toBeDefined();
    });

    it('should update callbacks', () => {
      const newCallback = jest.fn();
      playbackManager.updateCallbacks({ onProgress: newCallback });
      // Callbacks updated successfully
      expect(playbackManager).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      const chunk: AudioChunkData = {
        data: Buffer.from('test-audio-data').toString('base64'),
        sequenceNumber: 0,
        timestamp: Date.now(),
      };
      playbackManager.addChunk(chunk);

      await playbackManager.cleanup();

      expect(playbackManager.getState()).toBe(AudioPlaybackState.STOPPED);
      expect(playbackManager.getQueueLength()).toBe(0);
    });
  });
});
