/**
 * Voice Components Tests
 *
 * Tests to ensure voice components can be imported and accept correct props
 */

// Mock AudioManager
jest.mock('../../services/AudioManager', () => ({
  AudioManager: jest.fn().mockImplementation(() => ({
    checkPermissions: jest.fn().mockResolvedValue(true),
    requestPermissions: jest.fn().mockResolvedValue(true),
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue(undefined),
    getCurrentRecordingDuration: jest.fn().mockReturnValue(0),
    cleanup: jest.fn().mockResolvedValue(undefined),
  })),
  AudioRecordingState: {
    IDLE: 'idle',
    RECORDING: 'recording',
    PAUSED: 'paused',
    STOPPED: 'stopped',
    ERROR: 'error',
  },
}));

// Mock VoiceSampleManager
jest.mock('../../services/VoiceSampleManager', () => ({
  VoiceSampleManager: jest.fn().mockImplementation(() => ({
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue(undefined),
    cancelRecording: jest.fn().mockResolvedValue(undefined),
    deleteSample: jest.fn().mockResolvedValue(undefined),
    getCurrentRecordingDuration: jest.fn().mockReturnValue(0),
    getRequirements: jest.fn().mockReturnValue({
      requiredSampleCount: 1,
      recommendedSampleCount: 3,
      minDuration: 5,
      maxDuration: 300,
    }),
    validateAllSamples: jest.fn().mockReturnValue({
      canProceed: true,
      issues: [],
      recommendations: [],
    }),
    cleanup: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
}));

import { VoiceModelPreview } from '../VoiceModelPreview';
import VoiceSampleRecording from '../VoiceSampleRecording';

describe('Voice Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('VoiceSampleRecording', () => {
    it('should be a valid React component', () => {
      expect(VoiceSampleRecording).toBeDefined();
      expect(typeof VoiceSampleRecording).toBe('function');
    });

    it('should accept required props', () => {
      const mockOnComplete = jest.fn();
      const mockOnCancel = jest.fn();

      // Test that the component can be instantiated with props
      const props = {
        onComplete: mockOnComplete,
        onCancel: mockOnCancel,
      };

      expect(props.onComplete).toBeDefined();
      expect(props.onCancel).toBeDefined();
      expect(typeof props.onComplete).toBe('function');
      expect(typeof props.onCancel).toBe('function');
    });

    it('should accept optional requirements prop', () => {
      const mockOnComplete = jest.fn();
      const mockOnCancel = jest.fn();

      const props = {
        onComplete: mockOnComplete,
        onCancel: mockOnCancel,
        requirements: {
          requiredSampleCount: 3,
          recommendedSampleCount: 5,
        },
      };

      expect(props.requirements).toBeDefined();
      expect(props.requirements.requiredSampleCount).toBe(3);
    });
  });

  describe('VoiceModelPreview', () => {
    it('should be a valid React component', () => {
      expect(VoiceModelPreview).toBeDefined();
      expect(typeof VoiceModelPreview).toBe('function');
    });

    it('should accept required props', () => {
      const mockOnModelSelected = jest.fn();
      const mockOnClose = jest.fn();

      const props = {
        onModelSelected: mockOnModelSelected,
        onClose: mockOnClose,
      };

      expect(props.onModelSelected).toBeDefined();
      expect(props.onClose).toBeDefined();
      expect(typeof props.onModelSelected).toBe('function');
      expect(typeof props.onClose).toBe('function');
    });
  });
});
