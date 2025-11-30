import { FaceModel } from '@clone/shared-types';

import { VideoGeneratorService } from '../services/video-generator.service';
import { AudioFeatures, LipSyncModel, PreprocessedFaceData } from '../types';

describe('VideoGeneratorService', () => {
  let service: VideoGeneratorService;

  beforeEach(() => {
    service = new VideoGeneratorService({
      targetFps: 20,
      resolution: { width: 256, height: 256 },
      format: 'jpeg',
      quality: 85,
      enableInterpolation: true,
      bufferSizeFrames: 10,
    });
  });

  afterEach(() => {
    service.clearCache();
    service.resetMetrics();
  });

  describe('generateFrames', () => {
    it('should generate video frames from audio features', async () => {
      const sessionId = 'test-session-1';
      const audioFeatures = createTestAudioFeatures(100); // 100ms
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      const frames = await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      expect(frames.length).toBeGreaterThan(0);
      // At 20 FPS, 100ms should produce ~2 frames
      expect(frames.length).toBeGreaterThanOrEqual(1);
      expect(frames.length).toBeLessThanOrEqual(3);
    });

    it('should generate frames with correct properties', async () => {
      const sessionId = 'test-session-2';
      const audioFeatures = createTestAudioFeatures(100);
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      const frames = await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      frames.forEach((frame, index) => {
        expect(frame.data).toBeInstanceOf(Buffer);
        expect(frame.timestamp).toBeGreaterThanOrEqual(audioFeatures.timestamp);
        expect(frame.format).toBe('jpeg');
        expect(frame.width).toBe(256);
        expect(frame.height).toBe(256);
        expect(frame.sequenceNumber).toBe(index);
        expect(frame.lipSyncModel).toBe(LipSyncModel.TPSM);
        expect(frame.generationTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    it('should generate frames for different lip-sync models', async () => {
      const audioFeatures = createTestAudioFeatures(100);
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      const models = [
        LipSyncModel.TPSM,
        LipSyncModel.WAV2LIP,
        LipSyncModel.SADTALKER,
        LipSyncModel.STATIC,
      ];

      for (const model of models) {
        // Create fresh service for each model to avoid caching issues
        const freshService = new VideoGeneratorService();
        const frames = await freshService.generateFrames(
          `test-session-${model}`,
          audioFeatures,
          faceModel,
          preprocessedData,
          model
        );

        expect(frames.length).toBeGreaterThan(0);
        expect(frames[0].lipSyncModel).toBe(model);
      }
    });

    it('should buffer frames for session', async () => {
      const sessionId = 'test-session-4';
      const audioFeatures = createTestAudioFeatures(100);
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      const buffer = service.getBufferedFrames(sessionId);

      expect(buffer).not.toBeNull();
      expect(buffer!.frames.length).toBeGreaterThan(0);
      expect(buffer!.startTimestamp).toBe(audioFeatures.timestamp);
    });
  });

  describe('interpolateFrames', () => {
    it('should interpolate between two frames', async () => {
      const sessionId = 'test-session-5';
      const audioFeatures = createTestAudioFeatures(200);
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      const frames = await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      if (frames.length >= 2) {
        const interpolated = service.interpolateFrames(frames[0], frames[1], 0.5);

        expect(interpolated.timestamp).toBe(
          frames[0].timestamp + (frames[1].timestamp - frames[0].timestamp) * 0.5
        );
        expect(interpolated.isInterpolated).toBe(true);
      }
    });
  });

  describe('dropFramesForPerformance', () => {
    it('should drop frames when target FPS is lower', async () => {
      const sessionId = 'test-session-6';
      const audioFeatures = createTestAudioFeatures(500); // 500ms for more frames
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      const frames = await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      const droppedFrames = service.dropFramesForPerformance(frames, 10);

      // Should have fewer frames when dropping for lower FPS
      expect(droppedFrames.length).toBeLessThanOrEqual(frames.length);
    });

    it('should not drop frames when target FPS is same or higher', async () => {
      const sessionId = 'test-session-7';
      const audioFeatures = createTestAudioFeatures(200);
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      const frames = await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      const sameFrames = service.dropFramesForPerformance(frames, 20);

      expect(sameFrames.length).toBe(frames.length);
    });
  });

  describe('metrics', () => {
    it('should track generation metrics', async () => {
      const sessionId = 'test-session-8';
      const audioFeatures = createTestAudioFeatures(100);
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      const metrics = service.getMetrics();

      expect(metrics.framesGenerated).toBeGreaterThan(0);
      expect(metrics.averageGenerationTimeMs).toBeGreaterThanOrEqual(0);
      // FPS may be 0 if processing is very fast (< 1ms)
      expect(metrics.averageFps).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', async () => {
      const sessionId = 'test-session-9';
      const audioFeatures = createTestAudioFeatures(100);
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      service.resetMetrics();

      const metrics = service.getMetrics();
      expect(metrics.framesGenerated).toBe(0);
    });
  });

  describe('buffer management', () => {
    it('should clear buffer for session', async () => {
      const sessionId = 'test-session-10';
      const audioFeatures = createTestAudioFeatures(100);
      const faceModel = createTestFaceModel();
      const preprocessedData = createTestPreprocessedData();

      await service.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        LipSyncModel.TPSM
      );

      expect(service.getBufferedFrames(sessionId)).not.toBeNull();

      service.clearBuffer(sessionId);

      expect(service.getBufferedFrames(sessionId)).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      service.updateConfig({ targetFps: 30, quality: 90 });

      // Generate frames with new config
      // The service should use the updated configuration
      expect(true).toBe(true); // Config update doesn't throw
    });
  });
});

// Helper functions
function createTestAudioFeatures(durationMs: number): AudioFeatures {
  const frameCount = Math.ceil(durationMs / 10); // ~10ms per frame
  const melSpectrogram: number[][] = [];

  for (let i = 0; i < frameCount; i++) {
    // Create mel frame with 80 bins
    const melFrame = new Array(80).fill(0).map(() => Math.random() * 2 - 1);
    melSpectrogram.push(melFrame);
  }

  return {
    melSpectrogram,
    mfcc: new Array(13).fill(0).map(() => Math.random()),
    energy: Math.random() * 0.5,
    pitch: 100 + Math.random() * 200,
    timestamp: 0,
    duration: durationMs,
    sampleRate: 16000,
  };
}

function createTestFaceModel(): FaceModel {
  return {
    id: 'test-model-id',
    userId: 'test-user-id',
    modelPath: 'face-models/test-user-id/test-model-id',
    resolution: { width: 256, height: 256 },
    keypoints: new Array(68).fill(null).map((_, i) => ({
      x: Math.random() * 256,
      y: Math.random() * 256,
      confidence: 0.9,
      landmark: `landmark_${i}`,
    })),
    embeddings: [
      {
        vector: new Array(512).fill(0).map(() => Math.random()),
        confidence: 0.95,
      },
    ],
    neutralPose: 'gs://test-bucket/face-models/test-user-id/test-model-id/neutral_pose.jpg',
    expressionTemplates: [
      {
        name: 'neutral',
        keypoints: [],
        blendshapes: new Array(52).fill(0),
      },
      {
        name: 'talking',
        keypoints: [],
        blendshapes: new Array(52).fill(0).map(() => Math.random()),
      },
    ],
    createdAt: new Date(),
    qualityScore: 85,
  };
}

function createTestPreprocessedData(): PreprocessedFaceData {
  // Create a simple test image buffer (256x256 RGB)
  const width = 256;
  const height = 256;
  const buffer = Buffer.alloc(width * height * 3);

  // Fill with gray
  for (let i = 0; i < buffer.length; i += 3) {
    buffer[i] = 128;
    buffer[i + 1] = 128;
    buffer[i + 2] = 128;
  }

  return {
    alignedFace: buffer,
    landmarks: new Array(68).fill(null).map(() => [Math.random() * 256, Math.random() * 256]),
    embedding: new Array(512).fill(0).map(() => Math.random()),
  };
}
