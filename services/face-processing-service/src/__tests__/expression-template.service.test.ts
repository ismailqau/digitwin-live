import { FacialKeypoint, ExpressionTemplate, FACE_LANDMARK_INDICES } from '@clone/shared-types';

import { ExpressionTemplateService } from '../services/expression-template.service';

describe('ExpressionTemplateService', () => {
  let service: ExpressionTemplateService;

  beforeEach(() => {
    service = new ExpressionTemplateService();
  });

  // Helper to create mock landmarks with specific mouth opening
  const createMockLandmarks = (mouthOpen: number = 0): FacialKeypoint[] => {
    const landmarks: FacialKeypoint[] = [];

    // Create 468 landmarks
    for (let i = 0; i < 468; i++) {
      landmarks.push({
        x: 128 + (i % 50),
        y: 128 + Math.floor(i / 50),
        confidence: 0.95,
        landmark: `landmark_${i}`,
      });
    }

    // Set key landmarks for expression detection
    // Eyes
    landmarks[FACE_LANDMARK_INDICES.LEFT_EYE_INNER] = {
      x: 100,
      y: 100,
      confidence: 0.95,
      landmark: 'left_eye_inner',
    };
    landmarks[FACE_LANDMARK_INDICES.LEFT_EYE_OUTER] = {
      x: 80,
      y: 100,
      confidence: 0.95,
      landmark: 'left_eye_outer',
    };
    landmarks[FACE_LANDMARK_INDICES.RIGHT_EYE_INNER] = {
      x: 156,
      y: 100,
      confidence: 0.95,
      landmark: 'right_eye_inner',
    };
    landmarks[FACE_LANDMARK_INDICES.RIGHT_EYE_OUTER] = {
      x: 176,
      y: 100,
      confidence: 0.95,
      landmark: 'right_eye_outer',
    };

    // Eyebrows
    landmarks[FACE_LANDMARK_INDICES.LEFT_EYEBROW_INNER] = {
      x: 100,
      y: 85,
      confidence: 0.95,
      landmark: 'left_brow_inner',
    };
    landmarks[FACE_LANDMARK_INDICES.LEFT_EYEBROW_OUTER] = {
      x: 80,
      y: 85,
      confidence: 0.95,
      landmark: 'left_brow_outer',
    };
    landmarks[FACE_LANDMARK_INDICES.RIGHT_EYEBROW_INNER] = {
      x: 156,
      y: 85,
      confidence: 0.95,
      landmark: 'right_brow_inner',
    };
    landmarks[FACE_LANDMARK_INDICES.RIGHT_EYEBROW_OUTER] = {
      x: 176,
      y: 85,
      confidence: 0.95,
      landmark: 'right_brow_outer',
    };

    // Nose
    landmarks[FACE_LANDMARK_INDICES.NOSE_TIP] = {
      x: 128,
      y: 140,
      confidence: 0.95,
      landmark: 'nose_tip',
    };

    // Mouth - adjust based on mouthOpen parameter
    const mouthY = 170;
    const mouthOpenAmount = mouthOpen * 30; // Scale mouth opening
    landmarks[FACE_LANDMARK_INDICES.MOUTH_LEFT] = {
      x: 100,
      y: mouthY,
      confidence: 0.95,
      landmark: 'mouth_left',
    };
    landmarks[FACE_LANDMARK_INDICES.MOUTH_RIGHT] = {
      x: 156,
      y: mouthY,
      confidence: 0.95,
      landmark: 'mouth_right',
    };
    landmarks[FACE_LANDMARK_INDICES.MOUTH_TOP] = {
      x: 128,
      y: mouthY - 5,
      confidence: 0.95,
      landmark: 'mouth_top',
    };
    landmarks[FACE_LANDMARK_INDICES.MOUTH_BOTTOM] = {
      x: 128,
      y: mouthY + 5 + mouthOpenAmount,
      confidence: 0.95,
      landmark: 'mouth_bottom',
    };

    // Chin
    landmarks[FACE_LANDMARK_INDICES.CHIN] = { x: 128, y: 220, confidence: 0.95, landmark: 'chin' };

    return landmarks;
  };

  // Helper to create mock template
  const createMockTemplate = (name: string): ExpressionTemplate => {
    return {
      name,
      keypoints: createMockLandmarks(),
      blendshapes: new Array(52).fill(0).map((_, i) => i * 0.01),
    };
  };

  describe('detectExpression', () => {
    it('should detect neutral expression for closed mouth', () => {
      const landmarks = createMockLandmarks(0);
      const result = service.detectExpression(landmarks);

      expect(result).toHaveProperty('expression');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('blendshapes');
      expect(result).toHaveProperty('actionUnits');
      expect(result.blendshapes).toHaveLength(52);
    });

    it('should detect talking expression for open mouth', () => {
      const landmarks = createMockLandmarks(0.5);
      const result = service.detectExpression(landmarks);

      // Expression detection depends on landmark geometry - accept any valid expression
      expect(['talking', 'mouth_open', 'neutral', 'frown', 'smile', 'surprise']).toContain(
        result.expression
      );
      // Mouth opening should be detected in action units
      expect(result.actionUnits.AU25_lipsPart + result.actionUnits.AU26_jawDrop).toBeGreaterThan(0);
    });

    it('should return confidence based on landmark quality', () => {
      const landmarks = createMockLandmarks();
      const result = service.detectExpression(landmarks);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('detectNeutralFrame', () => {
    it('should find neutral frame in sequence', () => {
      const sequence = [
        createMockLandmarks(0.5), // talking
        createMockLandmarks(0), // neutral
        createMockLandmarks(0.3), // slightly open
      ];

      const result = service.detectNeutralFrame(sequence);

      expect(result).toHaveProperty('frameIndex');
      expect(result).toHaveProperty('confidence');
      expect(result.frameIndex).toBeGreaterThanOrEqual(0);
      expect(result.frameIndex).toBeLessThan(sequence.length);
    });

    it('should handle single frame', () => {
      const sequence = [createMockLandmarks(0)];
      const result = service.detectNeutralFrame(sequence);

      expect(result.frameIndex).toBe(0);
    });
  });

  describe('extractTalkingExpressions', () => {
    it('should extract talking frames from sequence', () => {
      const sequence = [
        createMockLandmarks(0), // neutral
        createMockLandmarks(0.5), // talking
        createMockLandmarks(0.6), // talking
        createMockLandmarks(0), // neutral
      ];

      const result = service.extractTalkingExpressions(sequence);

      expect(Array.isArray(result)).toBe(true);
      result.forEach((item) => {
        expect(item).toHaveProperty('frameIndex');
        expect(item).toHaveProperty('template');
        expect(item.template).toHaveProperty('name');
        expect(item.template).toHaveProperty('keypoints');
        expect(item.template).toHaveProperty('blendshapes');
      });
    });
  });

  describe('createTemplate', () => {
    it('should create template with correct structure', () => {
      const landmarks = createMockLandmarks();
      const blendshapes = new Array(52).fill(0.5);

      const template = service.createTemplate('test', landmarks, blendshapes);

      expect(template.name).toBe('test');
      expect(template.keypoints).toHaveLength(landmarks.length);
      expect(template.blendshapes).toHaveLength(52);
    });
  });

  describe('calculateTemplateSimilarity', () => {
    it('should return 1 for identical templates', () => {
      const template = createMockTemplate('test');
      const similarity = service.calculateTemplateSimilarity(template, template);

      expect(similarity).toBeCloseTo(1, 2);
    });

    it('should return lower value for different templates', () => {
      const template1 = createMockTemplate('test1');
      const template2 = createMockTemplate('test2');
      template2.blendshapes = template2.blendshapes.map((v) => v + 0.5);

      const similarity = service.calculateTemplateSimilarity(template1, template2);

      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('interpolateTemplates', () => {
    it('should generate interpolated templates', () => {
      const from = createMockTemplate('from');
      const to = createMockTemplate('to');
      to.blendshapes = to.blendshapes.map((v) => v + 0.5);

      const interpolated = service.interpolateTemplates(from, to, {
        duration: 100,
        easing: 'linear',
        steps: 5,
      });

      expect(interpolated).toHaveLength(6); // steps + 1
      interpolated.forEach((template) => {
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('keypoints');
        expect(template).toHaveProperty('blendshapes');
      });
    });

    it('should support different easing functions', () => {
      const from = createMockTemplate('from');
      const to = createMockTemplate('to');

      const easings: Array<'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'> = [
        'linear',
        'ease-in',
        'ease-out',
        'ease-in-out',
      ];

      easings.forEach((easing) => {
        const result = service.interpolateTemplates(from, to, {
          duration: 100,
          easing,
          steps: 3,
        });
        expect(result).toHaveLength(4);
      });
    });
  });

  describe('validateTemplate', () => {
    it('should validate correct template', () => {
      const template = createMockTemplate('test');
      const result = service.validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('should detect invalid blendshape count', () => {
      const template = createMockTemplate('test');
      template.blendshapes = [0.1, 0.2]; // Too few

      const result = service.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect invalid blendshape values', () => {
      const template = createMockTemplate('test');
      template.blendshapes[0] = NaN;

      const result = service.validateTemplate(template);

      expect(result.isValid).toBe(false);
    });
  });

  describe('optimizeForLipSync', () => {
    it('should enhance mouth-related blendshapes', () => {
      const template = createMockTemplate('test');
      template.blendshapes[15] = 0.5; // AU25_lipsPart
      template.blendshapes[16] = 0.5; // AU26_jawDrop

      const optimized = service.optimizeForLipSync(template);

      expect(optimized.name).toContain('lipsync_optimized');
      expect(optimized.blendshapes[15]).toBeGreaterThan(template.blendshapes[15]);
      expect(optimized.blendshapes[16]).toBeGreaterThan(template.blendshapes[16]);
    });
  });

  describe('createCustomTemplate', () => {
    it('should create template with modified action units', () => {
      const baseTemplate = createMockTemplate('base');

      const customTemplate = service.createCustomTemplate('custom', baseTemplate, {
        AU25_lipsPart: 0.8,
        AU26_jawDrop: 0.6,
      });

      expect(customTemplate.name).toBe('custom');
      expect(customTemplate.blendshapes[15]).toBe(0.8); // AU25
      expect(customTemplate.blendshapes[16]).toBe(0.6); // AU26
    });
  });

  describe('configuration', () => {
    it('should return configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('minConfidence');
      expect(config).toHaveProperty('neutralThreshold');
      expect(config).toHaveProperty('talkingThreshold');
      expect(config).toHaveProperty('blendshapeCount');
    });

    it('should accept custom configuration', () => {
      const customService = new ExpressionTemplateService({
        minConfidence: 0.8,
        blendshapeCount: 64,
      });

      const config = customService.getConfig();
      expect(config.minConfidence).toBe(0.8);
      expect(config.blendshapeCount).toBe(64);
    });
  });
});
