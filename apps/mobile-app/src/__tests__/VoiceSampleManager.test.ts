/**
 * Voice Sample Manager Tests
 */

import { VoiceSampleManager, VoiceSample } from '../services/VoiceSampleManager';

// Mock AudioManager
jest.mock('../services/AudioManager', () => ({
  AudioManager: jest.fn().mockImplementation(() => ({
    checkPermissions: jest.fn().mockResolvedValue(true),
    requestPermissions: jest.fn().mockResolvedValue(true),
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('VoiceSampleManager', () => {
  let manager: VoiceSampleManager;
  let mockCallbacks: {
    onSampleRecorded: jest.Mock;
    onSampleValidated: jest.Mock;
    onUploadProgress: jest.Mock;
    onTrainingProgress: jest.Mock;
    onError: jest.Mock;
  };

  beforeEach(() => {
    mockCallbacks = {
      onSampleRecorded: jest.fn(),
      onSampleValidated: jest.fn(),
      onUploadProgress: jest.fn(),
      onTrainingProgress: jest.fn(),
      onError: jest.fn(),
    };

    manager = new VoiceSampleManager(mockCallbacks);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default requirements', () => {
      const requirements = manager.getRequirements();

      // Development defaults (see DEFAULT_REQUIREMENTS in VoiceSampleManager.ts)
      expect(requirements.minDuration).toBe(5);
      expect(requirements.maxDuration).toBe(300);
      expect(requirements.minSNR).toBe(15);
      expect(requirements.maxClippingPercentage).toBe(10);
      expect(requirements.minQualityScore).toBe(50);
      expect(requirements.requiredSampleCount).toBe(1);
      expect(requirements.recommendedSampleCount).toBe(3);
    });

    it('should initialize with custom requirements', () => {
      const customManager = new VoiceSampleManager(
        {},
        {
          minDuration: 30,
          maxDuration: 600,
          minSNR: 25,
        }
      );

      const requirements = customManager.getRequirements();

      expect(requirements.minDuration).toBe(30);
      expect(requirements.maxDuration).toBe(600);
      expect(requirements.minSNR).toBe(25);
      // Should keep defaults for other values
      expect(requirements.minQualityScore).toBe(50);
    });
  });

  describe('Sample Management', () => {
    it('should start with empty samples array', () => {
      const samples = manager.getSamples();
      expect(samples).toEqual([]);
    });

    it('should return copy of samples array', () => {
      const samples1 = manager.getSamples();
      const samples2 = manager.getSamples();

      expect(samples1).not.toBe(samples2); // Different references
      expect(samples1).toEqual(samples2); // Same content
    });

    it('should delete sample by ID', async () => {
      // Add a mock sample to the internal array
      const mockSample: VoiceSample = {
        id: 'test-sample-1',
        filename: 'test.wav',
        filePath: '/tmp/test.wav',
        duration: 120,
        qualityScore: 85,
        snr: 25,
        hasClipping: false,
        hasBackgroundNoise: false,
        recordedAt: new Date(),
        metadata: {
          sampleRate: 16000,
          channels: 1,
          bitDepth: 16,
          fileSize: 1024,
          format: 'wav',
        },
      };

      // Access private samples array for testing
      (manager as unknown as { samples: VoiceSample[] }).samples = [mockSample];

      await manager.deleteSample('test-sample-1');

      const samples = manager.getSamples();
      expect(samples).toEqual([]);
    });

    it('should handle deleting non-existent sample', async () => {
      // Deleting non-existent sample should not throw or call error callback
      // It just logs a warning and returns silently
      await expect(manager.deleteSample('non-existent')).resolves.not.toThrow();
    });
  });

  describe('Recording State', () => {
    it('should not be recording initially', () => {
      expect(manager.isRecording()).toBe(false);
    });

    it('should return zero duration when not recording', () => {
      expect(manager.getCurrentRecordingDuration()).toBe(0);
    });
  });

  describe('Sample Validation', () => {
    it('should validate empty samples collection', () => {
      const validation = manager.validateAllSamples();

      expect(validation.isValid).toBe(false);
      expect(validation.canProceed).toBe(false);
      // Development default: requires at least 1 sample
      expect(validation.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Need at least 1 samples')])
      );
    });

    it('should provide recommendations for insufficient samples', () => {
      const validation = manager.validateAllSamples();

      // Development default: recommends 3 samples
      expect(validation.recommendations).toEqual(
        expect.arrayContaining([expect.stringContaining('Recommended to have 3 samples')])
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      await expect(manager.cleanup()).resolves.not.toThrow();
    });
  });
});
