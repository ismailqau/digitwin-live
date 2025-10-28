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
