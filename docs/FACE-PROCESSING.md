# Face Processing Service

The Face Processing Service provides face detection, 468 facial landmark extraction, quality validation, and face embedding/identity management for the Real-Time Conversational Clone System.

## Overview

This service handles:

- Face detection using MediaPipe Face Mesh
- 468 facial landmark extraction
- Face quality validation (lighting, blur, pose, resolution)
- Multi-face detection with primary face selection
- Face cropping and alignment preprocessing
- Batch processing for multiple images/video frames
- Face embedding generation (FaceNet/ArcFace-style)
- Face identity creation and verification
- Embedding consistency checking and clustering

## Architecture

```
Image Input → MediaPipe Adapter → Face Detection → Quality Assessment → Validation Result
                    ↓                    ↓                ↓
              468 Landmarks        Bounding Box      Recommendations
                    ↓                    ↓                ↓
              Pose Estimation      Quality Metrics    Pass/Fail
```

## API Endpoints

### POST /api/v1/face/detect

Detect faces in a single image.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user_123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "faces": [...],
    "imageMetadata": { "width": 640, "height": 480, "format": "jpeg" }
  }
}
```

### POST /api/v1/face/validate

Validate a face image for quality requirements.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user_123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "validation": {
      "isValid": true,
      "faceDetected": true,
      "faceCount": 1,
      "quality": { ... },
      "pose": { "yaw": 5, "pitch": -2, "roll": 1 },
      "recommendations": []
    },
    "qualityAssessment": { ... }
  }
}
```

### POST /api/v1/face/landmarks

Extract 468 facial landmarks from image.

### POST /api/v1/face/quality-check

Quick quality check with pass/fail result.

### POST /api/v1/face/analyze

Detailed image analysis for quality metrics.

### POST /api/v1/face/batch

Process multiple images in batch.

### GET /api/v1/face/thresholds

Get current quality thresholds.

## Quality Thresholds

| Threshold           | Value | Description                       |
| ------------------- | ----- | --------------------------------- |
| MIN_CONFIDENCE      | 0.8   | Minimum face detection confidence |
| MIN_FACE_SIZE       | 100px | Minimum face size in pixels       |
| MIN_RESOLUTION      | 256px | Minimum face resolution           |
| MAX_YAW             | 30°   | Maximum left-right rotation       |
| MAX_PITCH           | 25°   | Maximum up-down rotation          |
| MAX_ROLL            | 20°   | Maximum head tilt                 |
| MIN_BLUR_SCORE      | 0.6   | Minimum sharpness score           |
| MIN_LIGHTING_SCORE  | 0.5   | Minimum lighting score            |
| MIN_OVERALL_QUALITY | 70    | Minimum overall score (0-100)     |

## Quality Tiers

- **Excellent** (90+): Ideal for face model creation
- **Good** (80-89): Suitable for most use cases
- **Acceptable** (70-79): Meets minimum requirements
- **Poor** (<70): Rejected, needs improvement

## Usage Example

```typescript
import { FaceDetectionService } from '@clone/face-processing-service';

const service = new FaceDetectionService({
  minConfidence: 0.8,
  maxFaces: 5,
  enableLandmarks: true,
});

// Detect faces
const faces = await service.detectFaces(imageBuffer, 640, 480);

// Validate face quality
const validation = await service.validateFace(imageBuffer, 640, 480);

if (validation.isValid) {
  console.log('Face is valid for processing');
} else {
  console.log('Issues:', validation.recommendations);
}
```

## Face Embedding API

### POST /api/v1/face/embedding/generate

Generate face embedding from an image.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user_123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "embedding": { "vector": [...], "confidence": 0.95 },
    "validation": { "isValid": true, "qualityScore": 100 },
    "faceId": "face_123",
    "faceConfidence": 0.98
  }
}
```

### POST /api/v1/face/embedding/identity/create

Create a face identity from multiple samples (minimum 3 images).

**Request:**

```json
{
  "userId": "user_123",
  "images": ["base64_image_1", "base64_image_2", "base64_image_3"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "identityId": "identity_123",
    "sampleCount": 3,
    "confidence": 0.92,
    "consistency": { "isConsistent": true, "score": 0.89 }
  }
}
```

### POST /api/v1/face/embedding/identity/verify

Verify a face against an existing identity.

### POST /api/v1/face/embedding/identity/update

Update an identity with a new face sample.

### POST /api/v1/face/embedding/cluster

Cluster multiple face embeddings to find distinct identities.

### POST /api/v1/face/embedding/consistency

Check consistency of multiple face samples.

## Embedding Configuration

| Parameter              | Default | Description                            |
| ---------------------- | ------- | -------------------------------------- |
| embeddingDimension     | 512     | FaceNet/ArcFace standard dimension     |
| similarityThreshold    | 0.6     | Minimum cosine similarity for match    |
| strongMatchThreshold   | 0.85    | Strong match threshold                 |
| moderateMatchThreshold | 0.7     | Moderate match threshold               |
| minSamplesForIdentity  | 3       | Minimum samples for identity creation  |
| maxSamplesForIdentity  | 10      | Maximum samples per identity           |
| outlierThreshold       | 0.4     | Below this, consider as outlier        |
| minConsistencyScore    | 0.7     | Minimum consistency for valid identity |

## Face Embedding Usage

```typescript
import { FaceEmbeddingService } from '@clone/face-processing-service';

const embeddingService = new FaceEmbeddingService({
  similarityThreshold: 0.6,
  minSamplesForIdentity: 3,
});

// Generate embedding
const embedding = await embeddingService.generateEmbedding(imageBuffer, landmarks);

// Create identity from multiple samples
const identity = embeddingService.createIdentity('user_123', embeddings);

// Verify face against identity
const verification = embeddingService.verifyIdentity(newEmbedding, identity);

if (verification.isVerified) {
  console.log('Match strength:', verification.matchStrength);
}
```

## Expression Template Service

Handles expression detection and template extraction for facial animation:

```typescript
import { ExpressionTemplateService } from '@clone/face-processing-service';

const expressionService = new ExpressionTemplateService();

// Detect expression from landmarks
const detection = expressionService.detectExpression(landmarks);
console.log('Expression:', detection.expression); // 'neutral', 'talking', 'smile', etc.

// Extract talking expressions from video
const talkingFrames = expressionService.extractTalkingExpressions(landmarkSequence);

// Interpolate between expressions
const interpolated = expressionService.interpolateTemplates(fromTemplate, toTemplate, {
  duration: 100,
  easing: 'ease-in-out',
  steps: 10,
});
```

## Face Model Storage Service

Manages face model CRUD operations, versioning, and storage:

```typescript
import { FaceModelStorageService } from '@clone/face-processing-service';

const storageService = new FaceModelStorageService({
  bucket: 'digitwin-live-face-models',
  maxModelsPerUser: 5,
});

// Create model
const model = await storageService.createModel('user_123', modelData);

// Activate model
await storageService.activateModel(model.id);

// Get quality assessment
const assessment = storageService.assessModelQuality(model);
```

## Face Model Preview Service

Handles preview generation and A/B testing:

```typescript
import { FaceModelPreviewService } from '@clone/face-processing-service';

const previewService = new FaceModelPreviewService();

// Generate preview
const preview = await previewService.generatePreview(model, { duration: 5000 });

// Compare two models
const comparison = await previewService.compareModels(modelA, modelB);

// Validate model for activation
const validation = await previewService.validateModel(model);
```

## GPU Worker Service

Manages GPU job queuing and worker orchestration:

```typescript
import { GPUWorkerService } from '@clone/face-processing-service';

const gpuService = new GPUWorkerService();

// Submit job
const job = await gpuService.submitJob('face_detection', 'user_123', payload, {
  priority: 'high',
});

// Register worker
gpuService.registerWorker('worker_1', 'gpu-pool', 'T4', 16000);

// Get queue stats
const stats = gpuService.getQueueStats();
```

## Related Documentation

- [Voice Model Training](./VOICE-MODEL-TRAINING.md) - Voice cloning and TTS model training
- [Voice Model Management](./VOICE-MODEL-MANAGEMENT.md) - Managing voice models
- [Voice Sample Recording](./VOICE-SAMPLE-RECORDING.md) - Recording voice samples for cloning
- [TTS Multi-Provider](./TTS-MULTI-PROVIDER.md) - Text-to-speech provider configuration
- [XTTS Service](./XTTS-SERVICE.md) - XTTS voice cloning service
- [Audio Processing](./AUDIO-PROCESSING.md) - Audio capture and streaming
- [Audio Preprocessing](./AUDIO-PREPROCESSING.md) - Audio enhancement and normalization
- [GCP Infrastructure](./GCP-INFRASTRUCTURE.md) - Cloud infrastructure setup
- [Database Architecture](./DATABASE-ARCHITECTURE.md) - Data models and storage
- [Caching Architecture](./CACHING-ARCHITECTURE.md) - PostgreSQL caching strategy
