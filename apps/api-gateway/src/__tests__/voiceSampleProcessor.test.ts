/**
 * Voice Sample Processor Tests
 */

import { VoiceSampleProcessor } from '../services/voiceSampleProcessor.service';

describe('VoiceSampleProcessor', () => {
  let processor: VoiceSampleProcessor;

  beforeEach(() => {
    processor = new VoiceSampleProcessor();
  });

  describe('Initialization', () => {
    it('should initialize with default requirements', () => {
      const requirements = processor.getRequirements();

      expect(requirements.minDuration).toBe(60);
      expect(requirements.maxDuration).toBe(300);
      expect(requirements.minSNR).toBe(20);
      expect(requirements.maxClippingPercentage).toBe(5);
      expect(requirements.minQualityScore).toBe(70);
      expect(requirements.requiredSampleRate).toBe(16000);
      expect(requirements.requiredChannels).toBe(1);
      expect(requirements.requiredBitDepth).toBe(16);
    });

    it('should initialize with custom requirements', () => {
      const customProcessor = new VoiceSampleProcessor({
        minDuration: 30,
        maxDuration: 600,
        minSNR: 25,
      });

      const requirements = customProcessor.getRequirements();

      expect(requirements.minDuration).toBe(30);
      expect(requirements.maxDuration).toBe(600);
      expect(requirements.minSNR).toBe(25);
      // Should keep defaults for other values
      expect(requirements.minQualityScore).toBe(70);
    });
  });

  describe('Requirements', () => {
    it('should return current requirements', () => {
      const requirements = processor.getRequirements();

      expect(requirements).toHaveProperty('minDuration');
      expect(requirements).toHaveProperty('maxDuration');
      expect(requirements).toHaveProperty('minSNR');
      expect(requirements).toHaveProperty('maxClippingPercentage');
      expect(requirements).toHaveProperty('minQualityScore');
      expect(requirements).toHaveProperty('requiredSampleRate');
      expect(requirements).toHaveProperty('requiredChannels');
      expect(requirements).toHaveProperty('requiredBitDepth');
      expect(requirements).toHaveProperty('supportedFormats');
    });

    it('should have correct supported formats', () => {
      const requirements = processor.getRequirements();

      expect(requirements.supportedFormats).toContain('wav');
      expect(requirements.supportedFormats).toContain('mp3');
      expect(requirements.supportedFormats).toContain('flac');
      expect(requirements.supportedFormats).toContain('m4a');
      expect(requirements.supportedFormats).toContain('aac');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup temporary files', async () => {
      const filePaths = ['/tmp/test1.wav', '/tmp/test2.wav'];

      // This should not throw an error even if files don't exist
      await expect(processor.cleanup(filePaths)).resolves.not.toThrow();
    });

    it('should handle empty file paths array', async () => {
      await expect(processor.cleanup([])).resolves.not.toThrow();
    });
  });
});
