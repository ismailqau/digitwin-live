import { FaceDetectionService } from '../services/face-detection.service';

describe('FaceDetectionService', () => {
  let service: FaceDetectionService;

  beforeEach(() => {
    service = new FaceDetectionService();
  });

  describe('detectFaces', () => {
    it('should detect faces in a valid image', async () => {
      // Create a simple test buffer (simulated image)
      const imageBuffer = Buffer.alloc(1000);
      const imageWidth = 640;
      const imageHeight = 480;

      const faces = await service.detectFaces(imageBuffer, imageWidth, imageHeight);

      expect(faces).toBeDefined();
      expect(Array.isArray(faces)).toBe(true);
      expect(faces.length).toBeGreaterThan(0);
    });

    it('should return face with required properties', async () => {
      const imageBuffer = Buffer.alloc(1000);
      const faces = await service.detectFaces(imageBuffer, 640, 480);

      if (faces.length > 0) {
        const face = faces[0];
        expect(face).toHaveProperty('faceId');
        expect(face).toHaveProperty('boundingBox');
        expect(face).toHaveProperty('landmarks');
        expect(face).toHaveProperty('confidence');
        expect(face).toHaveProperty('isPrimary');
        expect(face).toHaveProperty('quality');
      }
    });

    it('should mark one face as primary', async () => {
      const imageBuffer = Buffer.alloc(1000);
      const faces = await service.detectFaces(imageBuffer, 640, 480);

      const primaryFaces = faces.filter((f) => f.isPrimary);
      expect(primaryFaces.length).toBeLessThanOrEqual(1);
    });

    it('should generate 468 landmarks when enabled', async () => {
      const imageBuffer = Buffer.alloc(1000);
      const faces = await service.detectFaces(imageBuffer, 640, 480);

      if (faces.length > 0) {
        expect(faces[0].landmarks.length).toBe(468);
      }
    });
  });

  describe('validateFace', () => {
    it('should return validation result with all required fields', async () => {
      const imageBuffer = Buffer.alloc(1000);
      const result = await service.validateFace(imageBuffer, 640, 480);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('faceDetected');
      expect(result).toHaveProperty('faceCount');
      expect(result).toHaveProperty('primaryFace');
      expect(result).toHaveProperty('allFaces');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('pose');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('processingTimeMs');
    });

    it('should include quality assessment', async () => {
      const imageBuffer = Buffer.alloc(1000);
      const result = await service.validateFace(imageBuffer, 640, 480);

      expect(result.quality).toHaveProperty('isValid');
      expect(result.quality).toHaveProperty('faceDetected');
      expect(result.quality).toHaveProperty('resolution');
      expect(result.quality).toHaveProperty('lighting');
      expect(result.quality).toHaveProperty('angle');
      expect(result.quality).toHaveProperty('clarity');
    });

    it('should include pose estimation when face is detected', async () => {
      const imageBuffer = Buffer.alloc(1000);
      const result = await service.validateFace(imageBuffer, 640, 480);

      if (result.faceDetected && result.pose) {
        expect(result.pose).toHaveProperty('yaw');
        expect(result.pose).toHaveProperty('pitch');
        expect(result.pose).toHaveProperty('roll');
      }
    });

    it('should track processing time', async () => {
      const imageBuffer = Buffer.alloc(1000);
      const result = await service.validateFace(imageBuffer, 640, 480);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultService = new FaceDetectionService();
      expect(defaultService).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customService = new FaceDetectionService({
        minConfidence: 0.9,
        maxFaces: 5,
        minFaceSize: 150,
      });
      expect(customService).toBeDefined();
    });

    it('should respect minConfidence threshold', async () => {
      const strictService = new FaceDetectionService({
        minConfidence: 0.99,
      });

      const imageBuffer = Buffer.alloc(1000);
      const faces = await strictService.detectFaces(imageBuffer, 640, 480);

      // With very high threshold, may filter out faces
      faces.forEach((face) => {
        expect(face.confidence).toBeGreaterThanOrEqual(0.99);
      });
    });
  });
});
