export interface FaceModel {
  id: string;
  userId: string;
  modelPath: string;
  resolution: { width: number; height: number };
  keypoints: FacialKeypoint[];
  embeddings: FaceEmbedding[];
  neutralPose: string;
  expressionTemplates: ExpressionTemplate[];
  createdAt: Date;
  qualityScore: number;
}

export interface FacialKeypoint {
  x: number;
  y: number;
  confidence: number;
  landmark: string;
}

export interface FaceEmbedding {
  vector: number[];
  confidence: number;
}

export interface ExpressionTemplate {
  name: string;
  keypoints: FacialKeypoint[];
  blendshapes: number[];
}

export interface VideoFrame {
  data: Buffer;
  timestamp: number;
  format: 'jpeg' | 'h264';
  width: number;
  height: number;
  audioTimestamp: number;
}

export interface FaceQualityResult {
  isValid: boolean;
  faceDetected: boolean;
  resolution: { width: number; height: number };
  lighting: 'good' | 'poor' | 'acceptable';
  angle: 'frontal' | 'profile' | 'angled';
  clarity: number;
  recommendations: string[];
}

// Face Detection Types
export interface FaceDetectionResult {
  faceId: string;
  boundingBox: BoundingBox;
  landmarks: FacialKeypoint[];
  confidence: number;
  isPrimary: boolean;
  quality: FaceQualityMetrics;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceQualityMetrics {
  overallScore: number;
  blurScore: number;
  lightingScore: number;
  poseScore: number;
  occlusionScore: number;
  resolutionScore: number;
}

export interface FacePose {
  yaw: number; // Left-right rotation (-90 to 90)
  pitch: number; // Up-down rotation (-90 to 90)
  roll: number; // Tilt rotation (-180 to 180)
}

export interface FaceValidationResult {
  isValid: boolean;
  faceDetected: boolean;
  faceCount: number;
  primaryFace: FaceDetectionResult | null;
  allFaces: FaceDetectionResult[];
  quality: FaceQualityResult;
  pose: FacePose | null;
  recommendations: string[];
  processingTimeMs: number;
}

export interface FaceDetectionConfig {
  minConfidence: number;
  maxFaces: number;
  minFaceSize: number;
  enableLandmarks: boolean;
  enableQualityMetrics: boolean;
}

export interface BatchFaceDetectionResult {
  frameIndex: number;
  timestamp: number;
  result: FaceValidationResult;
}

export interface FaceProcessingRequest {
  userId: string;
  mediaType: 'image' | 'video';
  mediaData: Buffer;
  filename: string;
  config?: Partial<FaceDetectionConfig>;
}

export interface FaceProcessingResponse {
  requestId: string;
  userId: string;
  status: 'success' | 'partial' | 'failed';
  results: FaceValidationResult[];
  batchResults?: BatchFaceDetectionResult[];
  summary: {
    totalFrames: number;
    validFrames: number;
    averageQuality: number;
    bestFrameIndex: number;
  };
  processingTimeMs: number;
}

// MediaPipe Landmark indices for key facial features
export const FACE_LANDMARK_INDICES = {
  // Eyes
  LEFT_EYE_CENTER: 468,
  RIGHT_EYE_CENTER: 473,
  LEFT_EYE_INNER: 133,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,

  // Eyebrows
  LEFT_EYEBROW_INNER: 107,
  LEFT_EYEBROW_OUTER: 70,
  RIGHT_EYEBROW_INNER: 336,
  RIGHT_EYEBROW_OUTER: 300,

  // Nose
  NOSE_TIP: 1,
  NOSE_BRIDGE: 6,
  NOSE_LEFT: 129,
  NOSE_RIGHT: 358,

  // Mouth
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  MOUTH_TOP: 13,
  MOUTH_BOTTOM: 14,
  UPPER_LIP_TOP: 0,
  LOWER_LIP_BOTTOM: 17,

  // Face contour
  CHIN: 152,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  FOREHEAD: 10,

  // Jaw
  JAW_LEFT: 172,
  JAW_RIGHT: 397,
} as const;

// Quality thresholds
export const FACE_QUALITY_THRESHOLDS = {
  MIN_CONFIDENCE: 0.8,
  MIN_FACE_SIZE: 100,
  MIN_RESOLUTION: 256,
  MAX_YAW: 30,
  MAX_PITCH: 25,
  MAX_ROLL: 20,
  MIN_BLUR_SCORE: 0.6,
  MIN_LIGHTING_SCORE: 0.5,
  MIN_OVERALL_QUALITY: 70,
} as const;
