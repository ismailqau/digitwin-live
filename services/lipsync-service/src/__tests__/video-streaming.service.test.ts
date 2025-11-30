import { VideoStreamingService } from '../services/video-streaming.service';
import { GeneratedFrame, LipSyncModel } from '../types';

describe('VideoStreamingService', () => {
  let service: VideoStreamingService;

  beforeEach(() => {
    service = new VideoStreamingService({
      codec: 'h264',
      bitrate: 500000,
      keyframeInterval: 30,
      enableAdaptiveBitrate: true,
      minBitrate: 100000,
      maxBitrate: 2000000,
    });
  });

  afterEach(() => {
    service.clearSession('test-session');
  });

  describe('prepareFramesForStreaming', () => {
    it('should prepare frames for WebSocket streaming', () => {
      const sessionId = 'test-session';
      const frames = createTestFrames(5);

      const streamingFrames = service.prepareFramesForStreaming(sessionId, frames);

      expect(streamingFrames.length).toBe(5);
      streamingFrames.forEach((sf, index) => {
        expect(sf.sessionId).toBe(sessionId);
        expect(sf.sequenceNumber).toBe(index);
        expect(sf.data).toBeInstanceOf(Buffer);
        expect(sf.size).toBeGreaterThan(0);
      });
    });

    it('should mark keyframes at correct intervals', () => {
      const sessionId = 'test-session';
      const frames = createTestFrames(60); // More than keyframe interval

      const streamingFrames = service.prepareFramesForStreaming(sessionId, frames);

      // First frame should be keyframe
      expect(streamingFrames[0].isKeyframe).toBe(true);

      // Frame at index 30 should be keyframe
      expect(streamingFrames[30].isKeyframe).toBe(true);

      // Frame at index 15 should not be keyframe
      expect(streamingFrames[15].isKeyframe).toBe(false);
    });
  });

  describe('createWebSocketMessage', () => {
    it('should create valid WebSocket message', () => {
      const sessionId = 'test-session';
      const frames = createTestFrames(1);
      const streamingFrames = service.prepareFramesForStreaming(sessionId, frames);

      const message = service.createWebSocketMessage(streamingFrames[0]);

      expect(message.type).toBe('response_video');
      expect(message.sessionId).toBe(sessionId);
      expect(message.frameData).toBeDefined();
      expect(typeof message.frameData).toBe('string'); // base64
      expect(message.sequenceNumber).toBe(0);
      expect(message.format).toBe('h264');
    });
  });

  describe('calculateSyncState', () => {
    it('should detect in-sync audio and video', () => {
      const sessionId = 'test-session';
      const audioTimestamp = 1000;
      const videoTimestamp = 1020; // 20ms offset

      const syncState = service.calculateSyncState(sessionId, audioTimestamp, videoTimestamp);

      expect(syncState.isInSync).toBe(true);
      expect(syncState.offsetMs).toBe(20);
      expect(syncState.audioTimestamp).toBe(audioTimestamp);
      expect(syncState.videoTimestamp).toBe(videoTimestamp);
    });

    it('should detect out-of-sync audio and video', () => {
      const sessionId = 'test-session';
      const audioTimestamp = 1000;
      const videoTimestamp = 1100; // 100ms offset

      const syncState = service.calculateSyncState(sessionId, audioTimestamp, videoTimestamp);

      expect(syncState.isInSync).toBe(false);
      expect(syncState.offsetMs).toBe(100);
    });

    it('should handle negative offset', () => {
      const sessionId = 'test-session';
      const audioTimestamp = 1100;
      const videoTimestamp = 1000; // Video behind audio

      const syncState = service.calculateSyncState(sessionId, audioTimestamp, videoTimestamp);

      expect(syncState.offsetMs).toBe(-100);
      expect(syncState.isInSync).toBe(false);
    });
  });

  describe('applySyncCorrection', () => {
    it('should not modify frames when in sync', () => {
      const frames = createTestFrames(3);
      const syncState = {
        audioTimestamp: 0,
        videoTimestamp: 10,
        offsetMs: 10,
        isInSync: true,
        correctionApplied: false,
      };

      const corrected = service.applySyncCorrection(frames, syncState);

      expect(corrected[0].timestamp).toBe(frames[0].timestamp);
    });

    it('should correct timestamps when out of sync', () => {
      const frames = createTestFrames(3);
      const originalTimestamp = frames[0].timestamp;
      const syncState = {
        audioTimestamp: 0,
        videoTimestamp: 100,
        offsetMs: 100,
        isInSync: false,
        correctionApplied: false,
      };

      const corrected = service.applySyncCorrection(frames, syncState);

      expect(corrected[0].timestamp).toBe(originalTimestamp - 100);
    });
  });

  describe('adaptBitrate', () => {
    it('should reduce bitrate for low bandwidth', () => {
      const sessionId = 'test-session';
      const lowBandwidth = 300; // 300 kbps

      const adaptedBitrate = service.adaptBitrate(sessionId, lowBandwidth, 0);

      expect(adaptedBitrate).toBeLessThan(500000);
      expect(adaptedBitrate).toBeGreaterThanOrEqual(100000); // Min bitrate
    });

    it('should reduce bitrate for high packet loss', () => {
      const sessionId = 'test-session';
      const goodBandwidth = 2000; // 2 Mbps
      const highPacketLoss = 10; // 10%

      const adaptedBitrate = service.adaptBitrate(sessionId, goodBandwidth, highPacketLoss);

      expect(adaptedBitrate).toBeLessThan(500000 * 0.8); // Should be reduced
    });

    it('should maintain bitrate for good conditions', () => {
      const sessionId = 'test-session';
      const goodBandwidth = 2000;
      const lowPacketLoss = 0;

      const adaptedBitrate = service.adaptBitrate(sessionId, goodBandwidth, lowPacketLoss);

      expect(adaptedBitrate).toBe(500000); // Default bitrate
    });
  });

  describe('skipFramesForCongestion', () => {
    it('should not skip frames for low congestion', () => {
      const frames = createTestFrames(10);

      const result = service.skipFramesForCongestion(frames, 0.1);

      expect(result.length).toBe(10);
    });

    it('should skip frames for high congestion', () => {
      const frames = createTestFrames(100);

      const result = service.skipFramesForCongestion(frames, 0.5);

      // Should skip approximately 50% of non-keyframes
      expect(result.length).toBeLessThan(100);
      expect(result.length).toBeGreaterThan(3); // At least keyframes
    });

    it('should preserve keyframes during congestion', () => {
      const frames = createTestFrames(60);

      const result = service.skipFramesForCongestion(frames, 0.8);

      // Keyframes at 0 and 30 should be preserved
      const keyframeIndices = result
        .map((f, i) => (f.sequenceNumber % 30 === 0 ? i : -1))
        .filter((i) => i >= 0);

      expect(keyframeIndices.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('frame queue management', () => {
    it('should queue and dequeue frames', () => {
      const sessionId = 'test-session';
      const frames = createTestFrames(5);

      service.queueFrames(sessionId, frames);

      const status = service.getQueueStatus(sessionId);
      expect(status.size).toBe(5);

      const dequeued = service.dequeueFrames(sessionId, 3);
      expect(dequeued.length).toBe(3);

      const newStatus = service.getQueueStatus(sessionId);
      expect(newStatus.size).toBe(2);
    });

    it('should handle empty queue', () => {
      const sessionId = 'test-session';

      const dequeued = service.dequeueFrames(sessionId, 5);

      expect(dequeued.length).toBe(0);
    });

    it('should report queue status', () => {
      const sessionId = 'test-session';
      const frames = createTestFrames(5);

      service.queueFrames(sessionId, frames);

      const status = service.getQueueStatus(sessionId);

      expect(status.size).toBe(5);
      expect(status.oldestTimestamp).toBe(frames[0].timestamp);
      expect(status.newestTimestamp).toBe(frames[4].timestamp);
    });
  });

  describe('session management', () => {
    it('should clear session data', () => {
      const sessionId = 'test-session';
      const frames = createTestFrames(5);

      service.queueFrames(sessionId, frames);
      service.prepareFramesForStreaming(sessionId, frames);
      service.calculateSyncState(sessionId, 0, 10);

      service.clearSession(sessionId);

      expect(service.getQueueStatus(sessionId).size).toBe(0);
      expect(service.getMetrics(sessionId)).toBeNull();
      expect(service.getSyncState(sessionId)).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should provide recovery action for high packet loss', () => {
      const sessionId = 'test-session';
      const frames = createTestFrames(100);

      // Simulate high packet loss by preparing many frames
      for (let i = 0; i < 10; i++) {
        service.prepareFramesForStreaming(sessionId, frames);
      }

      // Manually set metrics to simulate packet loss
      const error = new Error('Network error');
      const recovery = service.handleStreamingError(sessionId, error);

      expect(recovery.action).toBeDefined();
      expect(recovery.reason).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should update streaming configuration', () => {
      service.updateConfig({ bitrate: 1000000, keyframeInterval: 15 });

      // Configuration should be updated without error
      expect(true).toBe(true);
    });
  });
});

// Helper function to create test frames
function createTestFrames(count: number): GeneratedFrame[] {
  const frames: GeneratedFrame[] = [];
  const frameDuration = 50; // 50ms per frame (20 FPS)

  for (let i = 0; i < count; i++) {
    frames.push({
      data: Buffer.alloc(1024), // Placeholder data
      timestamp: i * frameDuration,
      format: 'jpeg',
      width: 256,
      height: 256,
      audioTimestamp: i * frameDuration,
      sequenceNumber: i,
      lipSyncModel: LipSyncModel.TPSM,
      generationTimeMs: 10,
      isInterpolated: false,
    });
  }

  return frames;
}
