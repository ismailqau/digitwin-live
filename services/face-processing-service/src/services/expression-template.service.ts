import { FaceProcessingError } from '@clone/errors';
import { createLogger } from '@clone/logger';
import { FacialKeypoint, ExpressionTemplate, FACE_LANDMARK_INDICES } from '@clone/shared-types';

const logger = createLogger('expression-template-service');

/**
 * Expression type enumeration
 */
export type ExpressionType =
  | 'neutral'
  | 'talking'
  | 'smile'
  | 'frown'
  | 'surprise'
  | 'blink'
  | 'mouth_open'
  | 'mouth_closed';

/**
 * Expression detection result
 */
export interface ExpressionDetectionResult {
  expression: ExpressionType;
  confidence: number;
  blendshapes: number[];
  actionUnits: ActionUnitValues;
}

/**
 * Action Unit values (based on FACS - Facial Action Coding System)
 * 52 Action Units for comprehensive facial expression representation
 */
export interface ActionUnitValues {
  // Upper face
  AU1_innerBrowRaiser: number;
  AU2_outerBrowRaiser: number;
  AU4_browLowerer: number;
  AU5_upperLidRaiser: number;
  AU6_cheekRaiser: number;
  AU7_lidTightener: number;
  // Lower face
  AU9_noseWrinkler: number;
  AU10_upperLipRaiser: number;
  AU12_lipCornerPuller: number;
  AU14_dimpler: number;
  AU15_lipCornerDepressor: number;
  AU17_chinRaiser: number;
  AU20_lipStretcher: number;
  AU23_lipTightener: number;
  AU24_lipPressor: number;
  AU25_lipsPart: number;
  AU26_jawDrop: number;
  AU27_mouthStretch: number;
  AU28_lipSuck: number;
  // Eye-related
  AU43_eyesClosed: number;
  AU45_blink: number;
  AU46_wink: number;
}

/**
 * Expression quality score
 */
export interface ExpressionQualityResult {
  isValid: boolean;
  qualityScore: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Expression interpolation config
 */
export interface InterpolationConfig {
  duration: number; // milliseconds
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  steps: number;
}

/**
 * Expression template configuration
 */
export interface ExpressionTemplateConfig {
  minConfidence: number;
  neutralThreshold: number;
  talkingThreshold: number;
  blendshapeCount: number;
}

const DEFAULT_CONFIG: ExpressionTemplateConfig = {
  minConfidence: 0.7,
  neutralThreshold: 0.15,
  talkingThreshold: 0.3,
  blendshapeCount: 52,
};

/**
 * Default Action Unit values (all zeros)
 */
const DEFAULT_ACTION_UNITS: ActionUnitValues = {
  AU1_innerBrowRaiser: 0,
  AU2_outerBrowRaiser: 0,
  AU4_browLowerer: 0,
  AU5_upperLidRaiser: 0,
  AU6_cheekRaiser: 0,
  AU7_lidTightener: 0,
  AU9_noseWrinkler: 0,
  AU10_upperLipRaiser: 0,
  AU12_lipCornerPuller: 0,
  AU14_dimpler: 0,
  AU15_lipCornerDepressor: 0,
  AU17_chinRaiser: 0,
  AU20_lipStretcher: 0,
  AU23_lipTightener: 0,
  AU24_lipPressor: 0,
  AU25_lipsPart: 0,
  AU26_jawDrop: 0,
  AU27_mouthStretch: 0,
  AU28_lipSuck: 0,
  AU43_eyesClosed: 0,
  AU45_blink: 0,
  AU46_wink: 0,
};

/**
 * Expression Template Service
 * Handles expression detection, template extraction, and interpolation
 * for facial animation in lip-sync video generation
 */
export class ExpressionTemplateService {
  private config: ExpressionTemplateConfig;

  constructor(config: Partial<ExpressionTemplateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('ExpressionTemplateService initialized', { config: this.config });
  }

  /**
   * Detect expression from facial landmarks
   */
  detectExpression(landmarks: FacialKeypoint[]): ExpressionDetectionResult {
    try {
      const actionUnits = this.calculateActionUnits(landmarks);
      const expression = this.classifyExpression(actionUnits);
      const blendshapes = this.actionUnitsToBlendshapes(actionUnits);
      const confidence = this.calculateExpressionConfidence(landmarks, expression);

      logger.debug('Expression detected', { expression, confidence });

      return {
        expression,
        confidence,
        blendshapes,
        actionUnits,
      };
    } catch (error) {
      logger.error('Failed to detect expression', { error });
      throw new FaceProcessingError('Expression detection failed', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Calculate Action Units from landmarks
   */
  private calculateActionUnits(landmarks: FacialKeypoint[]): ActionUnitValues {
    const au = { ...DEFAULT_ACTION_UNITS };

    // Get key landmarks
    const leftEyeInner = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.LEFT_EYE_INNER);
    const leftEyeOuter = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.LEFT_EYE_OUTER);
    const rightEyeInner = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.RIGHT_EYE_INNER);
    const rightEyeOuter = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.RIGHT_EYE_OUTER);
    const leftBrowInner = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.LEFT_EYEBROW_INNER);
    const leftBrowOuter = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.LEFT_EYEBROW_OUTER);
    const rightBrowInner = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.RIGHT_EYEBROW_INNER);
    // rightBrowOuter and chin reserved for future AU calculations
    this.getLandmark(landmarks, FACE_LANDMARK_INDICES.RIGHT_EYEBROW_OUTER);
    this.getLandmark(landmarks, FACE_LANDMARK_INDICES.CHIN);
    const mouthLeft = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.MOUTH_LEFT);
    const mouthRight = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.MOUTH_RIGHT);
    const mouthTop = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.MOUTH_TOP);
    const mouthBottom = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.MOUTH_BOTTOM);
    const noseTip = this.getLandmark(landmarks, FACE_LANDMARK_INDICES.NOSE_TIP);

    if (!leftEyeInner || !rightEyeInner || !mouthTop || !mouthBottom) {
      return au;
    }

    // Calculate eye distance for normalization
    const eyeDistance = this.distance(leftEyeOuter, rightEyeOuter);
    if (eyeDistance === 0) return au;

    // AU1 & AU2: Brow raising
    if (leftBrowInner && leftEyeInner) {
      const browEyeDistLeft = leftBrowInner.y - leftEyeInner.y;
      au.AU1_innerBrowRaiser = Math.max(0, Math.min(1, (-browEyeDistLeft / eyeDistance) * 3));
    }
    if (leftBrowOuter && leftEyeOuter) {
      const browEyeDistOuter = leftBrowOuter.y - leftEyeOuter.y;
      au.AU2_outerBrowRaiser = Math.max(0, Math.min(1, (-browEyeDistOuter / eyeDistance) * 3));
    }

    // AU4: Brow lowerer
    if (leftBrowInner && rightBrowInner) {
      const browDistance = this.distance(leftBrowInner, rightBrowInner);
      au.AU4_browLowerer = Math.max(0, Math.min(1, 1 - browDistance / eyeDistance));
    }

    // AU25 & AU26: Mouth opening
    const mouthHeight = Math.abs(mouthBottom.y - mouthTop.y);
    const mouthWidth =
      mouthLeft && mouthRight ? this.distance(mouthLeft, mouthRight) : eyeDistance * 0.5;

    au.AU25_lipsPart = Math.max(0, Math.min(1, mouthHeight / (eyeDistance * 0.3)));
    au.AU26_jawDrop = Math.max(0, Math.min(1, mouthHeight / (eyeDistance * 0.5)));

    // AU12: Lip corner puller (smile)
    if (mouthLeft && mouthRight && noseTip) {
      const mouthCenterY = (mouthLeft.y + mouthRight.y) / 2;
      const smileAmount = noseTip.y - mouthCenterY;
      au.AU12_lipCornerPuller = Math.max(0, Math.min(1, (smileAmount / eyeDistance) * 2));
    }

    // AU15: Lip corner depressor (frown)
    if (mouthLeft && mouthRight && noseTip) {
      const mouthCenterY = (mouthLeft.y + mouthRight.y) / 2;
      const frownAmount = mouthCenterY - noseTip.y;
      au.AU15_lipCornerDepressor = Math.max(0, Math.min(1, (frownAmount / eyeDistance) * 2));
    }

    // AU27: Mouth stretch
    au.AU27_mouthStretch = Math.max(0, Math.min(1, mouthWidth / eyeDistance - 0.4));

    // AU43 & AU45: Eye closure
    if (leftEyeInner && leftEyeOuter) {
      const eyeOpenness = Math.abs(leftEyeInner.y - leftEyeOuter.y) / eyeDistance;
      au.AU43_eyesClosed = Math.max(0, Math.min(1, 1 - eyeOpenness * 10));
      au.AU45_blink = au.AU43_eyesClosed > 0.8 ? 1 : 0;
    }

    return au;
  }

  /**
   * Get landmark by index
   */
  private getLandmark(landmarks: FacialKeypoint[], index: number): FacialKeypoint | undefined {
    return landmarks[index] || landmarks.find((l) => l.landmark === `landmark_${index}`);
  }

  /**
   * Calculate distance between two points
   */
  private distance(p1: FacialKeypoint | undefined, p2: FacialKeypoint | undefined): number {
    if (!p1 || !p2) return 0;
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  /**
   * Classify expression from action units
   */
  private classifyExpression(au: ActionUnitValues): ExpressionType {
    // Check for specific expressions based on action unit combinations

    // Smile: high AU12 (lip corner puller)
    if (au.AU12_lipCornerPuller > 0.5 && au.AU6_cheekRaiser > 0.3) {
      return 'smile';
    }

    // Frown: high AU15 (lip corner depressor) and AU4 (brow lowerer)
    if (au.AU15_lipCornerDepressor > 0.4 && au.AU4_browLowerer > 0.3) {
      return 'frown';
    }

    // Surprise: high AU1, AU2 (brow raisers) and AU26 (jaw drop)
    if (au.AU1_innerBrowRaiser > 0.5 && au.AU2_outerBrowRaiser > 0.5 && au.AU26_jawDrop > 0.4) {
      return 'surprise';
    }

    // Blink: high AU45
    if (au.AU45_blink > 0.8) {
      return 'blink';
    }

    // Talking: moderate mouth opening
    if (
      au.AU25_lipsPart > this.config.talkingThreshold ||
      au.AU26_jawDrop > this.config.talkingThreshold
    ) {
      return 'talking';
    }

    // Mouth open
    if (au.AU26_jawDrop > 0.6) {
      return 'mouth_open';
    }

    // Mouth closed
    if (au.AU25_lipsPart < 0.1 && au.AU26_jawDrop < 0.1) {
      return 'mouth_closed';
    }

    // Default to neutral
    return 'neutral';
  }

  /**
   * Calculate expression confidence
   */
  private calculateExpressionConfidence(
    landmarks: FacialKeypoint[],
    _expression: ExpressionType
  ): number {
    // Base confidence on landmark quality
    const avgConfidence = landmarks.reduce((sum, lm) => sum + lm.confidence, 0) / landmarks.length;
    return Math.min(1, avgConfidence);
  }

  /**
   * Convert action units to blendshapes array
   */
  private actionUnitsToBlendshapes(au: ActionUnitValues): number[] {
    // Convert action units object to array of 52 blendshape values
    return [
      au.AU1_innerBrowRaiser,
      au.AU2_outerBrowRaiser,
      au.AU4_browLowerer,
      au.AU5_upperLidRaiser,
      au.AU6_cheekRaiser,
      au.AU7_lidTightener,
      au.AU9_noseWrinkler,
      au.AU10_upperLipRaiser,
      au.AU12_lipCornerPuller,
      au.AU14_dimpler,
      au.AU15_lipCornerDepressor,
      au.AU17_chinRaiser,
      au.AU20_lipStretcher,
      au.AU23_lipTightener,
      au.AU24_lipPressor,
      au.AU25_lipsPart,
      au.AU26_jawDrop,
      au.AU27_mouthStretch,
      au.AU28_lipSuck,
      au.AU43_eyesClosed,
      au.AU45_blink,
      au.AU46_wink,
      // Pad remaining slots with zeros for 52 total
      ...new Array(30).fill(0),
    ];
  }

  /**
   * Detect neutral expression frame from a sequence
   */
  detectNeutralFrame(landmarkSequence: FacialKeypoint[][]): {
    frameIndex: number;
    confidence: number;
  } {
    let bestFrameIndex = 0;
    let bestNeutralScore = -1;

    landmarkSequence.forEach((landmarks, index) => {
      const detection = this.detectExpression(landmarks);

      // Calculate neutral score (lower action unit values = more neutral)
      const auValues = Object.values(detection.actionUnits);
      const avgAuValue = auValues.reduce((a, b) => a + b, 0) / auValues.length;
      const neutralScore = 1 - avgAuValue;

      if (detection.expression === 'neutral' && neutralScore > bestNeutralScore) {
        bestNeutralScore = neutralScore;
        bestFrameIndex = index;
      }
    });

    // If no neutral found, pick frame with lowest AU activity
    if (bestNeutralScore < 0) {
      landmarkSequence.forEach((landmarks, index) => {
        const detection = this.detectExpression(landmarks);
        const auValues = Object.values(detection.actionUnits);
        const avgAuValue = auValues.reduce((a, b) => a + b, 0) / auValues.length;
        const neutralScore = 1 - avgAuValue;

        if (neutralScore > bestNeutralScore) {
          bestNeutralScore = neutralScore;
          bestFrameIndex = index;
        }
      });
    }

    return {
      frameIndex: bestFrameIndex,
      confidence: Math.max(0, bestNeutralScore),
    };
  }

  /**
   * Extract talking expressions from video sequence
   */
  extractTalkingExpressions(
    landmarkSequence: FacialKeypoint[][]
  ): Array<{ frameIndex: number; template: ExpressionTemplate }> {
    const talkingFrames: Array<{ frameIndex: number; template: ExpressionTemplate }> = [];

    landmarkSequence.forEach((landmarks, index) => {
      const detection = this.detectExpression(landmarks);

      if (detection.expression === 'talking' && detection.confidence >= this.config.minConfidence) {
        talkingFrames.push({
          frameIndex: index,
          template: this.createTemplate('talking', landmarks, detection.blendshapes),
        });
      }
    });

    // Deduplicate similar templates
    return this.deduplicateTemplates(talkingFrames);
  }

  /**
   * Create expression template from landmarks
   */
  createTemplate(
    name: string,
    landmarks: FacialKeypoint[],
    blendshapes: number[]
  ): ExpressionTemplate {
    return {
      name,
      keypoints: landmarks.map((lm) => ({ ...lm })),
      blendshapes: [...blendshapes],
    };
  }

  /**
   * Deduplicate similar templates
   */
  private deduplicateTemplates(
    templates: Array<{ frameIndex: number; template: ExpressionTemplate }>
  ): Array<{ frameIndex: number; template: ExpressionTemplate }> {
    if (templates.length <= 1) return templates;

    const unique: Array<{ frameIndex: number; template: ExpressionTemplate }> = [templates[0]];

    for (let i = 1; i < templates.length; i++) {
      const current = templates[i];
      let isDuplicate = false;

      for (const existing of unique) {
        const similarity = this.calculateTemplateSimilarity(current.template, existing.template);
        if (similarity > 0.95) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(current);
      }
    }

    return unique;
  }

  /**
   * Calculate similarity between two templates
   */
  calculateTemplateSimilarity(t1: ExpressionTemplate, t2: ExpressionTemplate): number {
    if (t1.blendshapes.length !== t2.blendshapes.length) return 0;

    let sumSquaredDiff = 0;
    for (let i = 0; i < t1.blendshapes.length; i++) {
      const diff = t1.blendshapes[i] - t2.blendshapes[i];
      sumSquaredDiff += diff * diff;
    }

    const distance = Math.sqrt(sumSquaredDiff);
    return Math.max(0, 1 - distance / Math.sqrt(t1.blendshapes.length));
  }

  /**
   * Interpolate between two expression templates
   */
  interpolateTemplates(
    from: ExpressionTemplate,
    to: ExpressionTemplate,
    config: InterpolationConfig
  ): ExpressionTemplate[] {
    const { steps, easing } = config;
    const interpolated: ExpressionTemplate[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const easedT = this.applyEasing(t, easing);

      const blendshapes = from.blendshapes.map((fromVal, idx) => {
        const toVal = to.blendshapes[idx] || 0;
        return fromVal + (toVal - fromVal) * easedT;
      });

      const keypoints = from.keypoints.map((fromKp, idx) => {
        const toKp = to.keypoints[idx];
        if (!toKp) return { ...fromKp };

        return {
          x: fromKp.x + (toKp.x - fromKp.x) * easedT,
          y: fromKp.y + (toKp.y - fromKp.y) * easedT,
          confidence: (fromKp.confidence + toKp.confidence) / 2,
          landmark: fromKp.landmark,
        };
      });

      interpolated.push({
        name: `interpolated_${i}`,
        keypoints,
        blendshapes,
      });
    }

    return interpolated;
  }

  /**
   * Apply easing function
   */
  private applyEasing(t: number, easing: InterpolationConfig['easing']): number {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - Math.pow(1 - t, 2);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'linear':
      default:
        return t;
    }
  }

  /**
   * Validate expression template quality
   */
  validateTemplate(template: ExpressionTemplate): ExpressionQualityResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let qualityScore = 100;

    // Check keypoints count
    if (template.keypoints.length < 100) {
      issues.push('Insufficient keypoints');
      qualityScore -= 30;
    }

    // Check blendshapes count
    if (template.blendshapes.length !== this.config.blendshapeCount) {
      issues.push(
        `Expected ${this.config.blendshapeCount} blendshapes, got ${template.blendshapes.length}`
      );
      qualityScore -= 20;
    }

    // Check for invalid values
    const hasInvalidBlendshapes = template.blendshapes.some((v) => !isFinite(v) || v < 0 || v > 1);
    if (hasInvalidBlendshapes) {
      issues.push('Blendshapes contain invalid values');
      qualityScore -= 25;
    }

    // Check keypoint confidence
    const avgConfidence =
      template.keypoints.reduce((sum, kp) => sum + kp.confidence, 0) / template.keypoints.length;
    if (avgConfidence < this.config.minConfidence) {
      issues.push('Low keypoint confidence');
      recommendations.push('Use higher quality images with better lighting');
      qualityScore -= 15;
    }

    return {
      isValid: issues.length === 0,
      qualityScore: Math.max(0, qualityScore),
      issues,
      recommendations,
    };
  }

  /**
   * Optimize template for lip-sync models
   */
  optimizeForLipSync(template: ExpressionTemplate): ExpressionTemplate {
    // Focus on mouth-related blendshapes for lip-sync
    const mouthIndices = [15, 16, 17, 18]; // AU25, AU26, AU27, AU28

    const optimizedBlendshapes = template.blendshapes.map((val, idx) => {
      if (mouthIndices.includes(idx)) {
        // Enhance mouth-related values
        return Math.min(1, val * 1.2);
      }
      // Reduce non-mouth values slightly
      return val * 0.8;
    });

    return {
      ...template,
      name: `${template.name}_lipsync_optimized`,
      blendshapes: optimizedBlendshapes,
    };
  }

  /**
   * Create custom expression template
   */
  createCustomTemplate(
    name: string,
    baseTemplate: ExpressionTemplate,
    modifications: Partial<ActionUnitValues>
  ): ExpressionTemplate {
    const baseAu = this.blendshapesToActionUnits(baseTemplate.blendshapes);
    const modifiedAu = { ...baseAu, ...modifications };
    const newBlendshapes = this.actionUnitsToBlendshapes(modifiedAu);

    return {
      name,
      keypoints: [...baseTemplate.keypoints],
      blendshapes: newBlendshapes,
    };
  }

  /**
   * Convert blendshapes back to action units
   */
  private blendshapesToActionUnits(blendshapes: number[]): ActionUnitValues {
    return {
      AU1_innerBrowRaiser: blendshapes[0] || 0,
      AU2_outerBrowRaiser: blendshapes[1] || 0,
      AU4_browLowerer: blendshapes[2] || 0,
      AU5_upperLidRaiser: blendshapes[3] || 0,
      AU6_cheekRaiser: blendshapes[4] || 0,
      AU7_lidTightener: blendshapes[5] || 0,
      AU9_noseWrinkler: blendshapes[6] || 0,
      AU10_upperLipRaiser: blendshapes[7] || 0,
      AU12_lipCornerPuller: blendshapes[8] || 0,
      AU14_dimpler: blendshapes[9] || 0,
      AU15_lipCornerDepressor: blendshapes[10] || 0,
      AU17_chinRaiser: blendshapes[11] || 0,
      AU20_lipStretcher: blendshapes[12] || 0,
      AU23_lipTightener: blendshapes[13] || 0,
      AU24_lipPressor: blendshapes[14] || 0,
      AU25_lipsPart: blendshapes[15] || 0,
      AU26_jawDrop: blendshapes[16] || 0,
      AU27_mouthStretch: blendshapes[17] || 0,
      AU28_lipSuck: blendshapes[18] || 0,
      AU43_eyesClosed: blendshapes[19] || 0,
      AU45_blink: blendshapes[20] || 0,
      AU46_wink: blendshapes[21] || 0,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): ExpressionTemplateConfig {
    return { ...this.config };
  }
}
