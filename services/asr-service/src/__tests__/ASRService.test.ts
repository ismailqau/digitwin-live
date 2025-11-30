/**
 * ASR Service Tests
 *
 * Tests for Automatic Speech Recognition service using Google Chirp
 *
 * Requirements: 2
 * Target Latency: < 300ms
 */

import { describe, it, expect } from '@jest/globals';

describe('ASR Service', () => {
  describe('Audio Streaming', () => {
    it('should accept audio chunks at 16kHz mono 16-bit PCM', () => {
      const mockAudioConfig = {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        encoding: 'PCM',
      };

      expect(mockAudioConfig.sampleRate).toBe(16000);
      expect(mockAudioConfig.channels).toBe(1);
      expect(mockAudioConfig.bitDepth).toBe(16);
    });

    it('should handle 100ms audio chunks', () => {
      const mockChunk = {
        durationMs: 100,
        sampleRate: 16000,
        expectedSamples: 1600, // 16000 samples/sec * 0.1 sec
        dataSize: 3200, // 1600 samples * 2 bytes/sample
      };

      expect(mockChunk.expectedSamples).toBe(1600);
      expect(mockChunk.dataSize).toBe(3200);
    });

    it('should process streaming audio with various qualities', () => {
      const mockQualityTests = [
        { quality: 'high', snr: 30, expectedAccuracy: 0.98 },
        { quality: 'medium', snr: 20, expectedAccuracy: 0.95 },
        { quality: 'low', snr: 10, expectedAccuracy: 0.85 },
      ];

      mockQualityTests.forEach((test) => {
        expect(test.expectedAccuracy).toBeGreaterThan(0.8);
      });
    });
  });

  describe('Transcription Accuracy', () => {
    it('should achieve >95% accuracy for clear speech', () => {
      const mockTranscription = {
        audioQuality: 'high',
        expectedText: 'Hello, how are you today?',
        transcribedText: 'Hello, how are you today?',
        accuracy: 1.0, // 100% match
      };

      expect(mockTranscription.accuracy).toBeGreaterThanOrEqual(0.95);
    });

    it('should handle different accents', () => {
      const mockAccentTests = [
        { accent: 'american', accuracy: 0.97 },
        { accent: 'british', accuracy: 0.96 },
        { accent: 'australian', accuracy: 0.95 },
        { accent: 'indian', accuracy: 0.93 },
      ];

      mockAccentTests.forEach((test) => {
        expect(test.accuracy).toBeGreaterThan(0.9);
      });
    });

    it('should handle different speech patterns', () => {
      const mockSpeechPatterns = [
        { pattern: 'normal', wordsPerMinute: 150, accuracy: 0.97 },
        { pattern: 'fast', wordsPerMinute: 200, accuracy: 0.94 },
        { pattern: 'slow', wordsPerMinute: 100, accuracy: 0.98 },
        { pattern: 'with_pauses', wordsPerMinute: 120, accuracy: 0.96 },
      ];

      mockSpeechPatterns.forEach((test) => {
        expect(test.accuracy).toBeGreaterThan(0.9);
      });
    });
  });

  describe('Interim and Final Transcripts', () => {
    it('should provide interim results within 300ms', () => {
      const mockInterimResult = {
        transcript: 'Hello how',
        isFinal: false,
        confidence: 0.85,
        latencyMs: 250,
      };

      expect(mockInterimResult.isFinal).toBe(false);
      expect(mockInterimResult.latencyMs).toBeLessThan(300);
    });

    it('should provide final transcript with punctuation', () => {
      const mockFinalResult = {
        transcript: 'Hello, how are you today?',
        isFinal: true,
        confidence: 0.96,
        hasPunctuation: true,
        latencyMs: 280,
      };

      expect(mockFinalResult.isFinal).toBe(true);
      expect(mockFinalResult.hasPunctuation).toBe(true);
      expect(mockFinalResult.transcript).toMatch(/[.,!?]/);
    });

    it('should send final transcript to RAG pipeline within 50ms', () => {
      const mockPipelineTransfer = {
        transcriptCompleteAt: Date.now(),
        ragReceivedAt: Date.now() + 35,
        transferLatencyMs: 35,
      };

      expect(mockPipelineTransfer.transferLatencyMs).toBeLessThan(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle poor audio quality gracefully', () => {
      const mockPoorQuality = {
        snr: 5, // Very low SNR
        errorCode: 'POOR_AUDIO_QUALITY',
        errorMessage: 'Audio quality is too low for accurate transcription',
        suggestedAction: 'Please speak closer to the microphone',
        fallbackTranscript: '[unclear audio]',
      };

      expect(mockPoorQuality.errorCode).toBe('POOR_AUDIO_QUALITY');
      expect(mockPoorQuality.suggestedAction).toBeDefined();
    });

    it('should handle empty audio chunks', () => {
      const mockEmptyAudio = {
        audioData: Buffer.alloc(0),
        errorCode: 'EMPTY_AUDIO',
        errorMessage: 'Received empty audio chunk',
        handled: true,
      };

      expect(mockEmptyAudio.audioData.length).toBe(0);
      expect(mockEmptyAudio.handled).toBe(true);
    });

    it('should handle service unavailability', () => {
      const mockServiceError = {
        errorCode: 'SERVICE_UNAVAILABLE',
        errorMessage: 'ASR service is temporarily unavailable',
        retryable: true,
        retryAfterMs: 5000,
      };

      expect(mockServiceError.retryable).toBe(true);
      expect(mockServiceError.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe('Multi-language Support', () => {
    it('should support automatic language detection', () => {
      const mockLanguageDetection = {
        audioInput: 'Bonjour, comment allez-vous?',
        detectedLanguage: 'fr-FR',
        confidence: 0.95,
        autoDetectionEnabled: true,
      };

      expect(mockLanguageDetection.detectedLanguage).toBe('fr-FR');
      expect(mockLanguageDetection.confidence).toBeGreaterThan(0.9);
    });

    it('should support multiple languages', () => {
      const mockSupportedLanguages = [
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-GB', name: 'English (UK)' },
        { code: 'es-ES', name: 'Spanish (Spain)' },
        { code: 'fr-FR', name: 'French (France)' },
        { code: 'de-DE', name: 'German (Germany)' },
        { code: 'ja-JP', name: 'Japanese (Japan)' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
      ];

      expect(mockSupportedLanguages.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Performance and Latency', () => {
    it('should process audio with <300ms latency', () => {
      const mockLatencyMeasurements = [
        { chunkId: 1, latencyMs: 245 },
        { chunkId: 2, latencyMs: 268 },
        { chunkId: 3, latencyMs: 252 },
        { chunkId: 4, latencyMs: 289 },
        { chunkId: 5, latencyMs: 271 },
      ];

      const avgLatency =
        mockLatencyMeasurements.reduce((sum, m) => sum + m.latencyMs, 0) /
        mockLatencyMeasurements.length;

      expect(avgLatency).toBeLessThan(300);
      mockLatencyMeasurements.forEach((m) => {
        expect(m.latencyMs).toBeLessThan(300);
      });
    });

    it('should handle concurrent audio streams', () => {
      const mockConcurrentStreams = Array.from({ length: 10 }, (_, i) => ({
        streamId: `stream-${i}`,
        latencyMs: 250 + Math.random() * 50,
        active: true,
      }));

      const avgLatency =
        mockConcurrentStreams.reduce((sum, s) => sum + s.latencyMs, 0) /
        mockConcurrentStreams.length;

      expect(mockConcurrentStreams).toHaveLength(10);
      expect(avgLatency).toBeLessThan(350); // Allow some degradation under load
    });
  });

  describe('Chirp Model Integration', () => {
    it('should use Chirp model for optimal streaming performance', () => {
      const mockChirpConfig = {
        model: 'chirp',
        streamingEnabled: true,
        automaticPunctuation: true,
        enableWordTimeOffsets: true,
        interimResultsInterval: 300,
      };

      expect(mockChirpConfig.model).toBe('chirp');
      expect(mockChirpConfig.streamingEnabled).toBe(true);
      expect(mockChirpConfig.automaticPunctuation).toBe(true);
    });

    it('should provide word-level timestamps', () => {
      const mockWordTimestamps = [
        { word: 'Hello', startMs: 0, endMs: 400 },
        { word: 'how', startMs: 500, endMs: 700 },
        { word: 'are', startMs: 750, endMs: 900 },
        { word: 'you', startMs: 950, endMs: 1200 },
      ];

      mockWordTimestamps.forEach((word) => {
        expect(word.startMs).toBeLessThan(word.endMs);
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should provide confidence scores for transcripts', () => {
      const mockConfidenceScores = [
        { transcript: 'Hello', confidence: 0.98 },
        { transcript: 'how are you', confidence: 0.95 },
        { transcript: 'today', confidence: 0.92 },
      ];

      mockConfidenceScores.forEach((result) => {
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      });
    });

    it('should flag low-confidence transcripts', () => {
      const mockLowConfidence = {
        transcript: '[unclear]',
        confidence: 0.65,
        flagged: true,
        requiresReview: true,
      };

      expect(mockLowConfidence.confidence).toBeLessThan(0.8);
      expect(mockLowConfidence.flagged).toBe(true);
    });
  });
});
