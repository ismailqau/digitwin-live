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

## Testing

### Test Scripts

The face processing service includes comprehensive test scripts for local, GCP, and integration testing.

#### Local Testing

```bash
# Run all local API tests
./scripts/test-face-processing-local.sh

# Run with specific test image
FACE_TEST_IMAGE=/path/to/face.jpg ./scripts/test-face-processing-local.sh

# Run with unit tests
./scripts/test-face-processing-local.sh --unit-tests

# Specify custom port
./scripts/test-face-processing-local.sh --port 3007
```

#### GCP Testing

```bash
# Test deployed service on Cloud Run
./scripts/test-face-processing-gcp.sh

# Deploy and test
./scripts/test-face-processing-gcp.sh --deploy

# Run load test
./scripts/test-face-processing-gcp.sh --load-test

# Test in specific region
./scripts/test-face-processing-gcp.sh --region us-west1
```

#### Integration Testing

```bash
# Run end-to-end integration tests
./scripts/test-face-processing-integration.sh

# Test against specific URL
./scripts/test-face-processing-integration.sh --url https://face-service.example.com

# Keep test data after tests
./scripts/test-face-processing-integration.sh --skip-cleanup
```

### Test Data

Test images should be placed in `test-data/face-samples/`. See the README in that directory for image requirements.

**Required test images:**

- `sample-face-1.jpg` - Single frontal face
- `sample-face-2.jpg` - Same person, different angle
- `sample-face-3.jpg` - Same person, different lighting

### Unit Tests

Run Jest unit tests:

```bash
# Run all tests
pnpm --filter @clone/face-processing-service test

# Run with coverage
pnpm --filter @clone/face-processing-service test -- --coverage

# Run specific test file
pnpm --filter @clone/face-processing-service test -- face-detection.service.test.ts
```

### Manual API Testing

Test endpoints with curl:

```bash
# Health check
curl http://localhost:3006/health

# Face detection
curl -X POST http://localhost:3006/api/v1/face/detect \
  -H "Content-Type: application/json" \
  -d '{"imageData": "'$(base64 -i image.jpg | tr -d '\n')'", "userId": "test"}'

# Quality check
curl -X POST http://localhost:3006/api/v1/face/quality-check \
  -H "Content-Type: application/json" \
  -d '{"imageData": "'$(base64 -i image.jpg | tr -d '\n')'", "userId": "test"}'

# Get thresholds
curl http://localhost:3006/api/v1/face/thresholds
```

## Troubleshooting

### Common Issues

#### "No face detected"

**Causes:**

- Face not visible or too small
- Poor lighting
- Extreme head angle
- Low image resolution

**Solutions:**

1. Ensure face occupies at least 20% of image
2. Use good lighting (natural or soft artificial)
3. Face camera directly (< 30° rotation)
4. Use minimum 256x256 resolution

#### "Quality score too low"

**Causes:**

- Blurry image
- Poor lighting
- Face too small
- Extreme expression

**Solutions:**

1. Use sharper images (avoid motion blur)
2. Improve lighting conditions
3. Move closer to camera
4. Use neutral expression

#### "Consistency check failed"

**Causes:**

- Images are of different people
- Extreme lighting differences
- Very different angles between images

**Solutions:**

1. Verify all images are of same person
2. Use similar lighting conditions
3. Keep angles within 30° of frontal

#### "Service not responding"

**Causes:**

- Service not started
- Wrong port
- Network issues

**Solutions:**

1. Start service: `pnpm --filter @clone/face-processing-service dev`
2. Check port: default is 3006
3. Verify network connectivity

### GCP-Specific Issues

#### "Service not found"

Deploy the service first:

```bash
./scripts/test-face-processing-gcp.sh --deploy
```

#### "Authentication failed"

Ensure you're authenticated:

```bash
gcloud auth login
gcloud auth application-default login
```

#### "Cloud SQL connection failed"

1. Verify Cloud SQL instance is running
2. Check connection string in environment
3. Ensure Cloud SQL Proxy is running (for local development)

### Logs

View service logs:

```bash
# Local logs
pnpm --filter @clone/face-processing-service dev 2>&1 | tee face-processing.log

# GCP Cloud Run logs
gcloud run services logs read face-processing-service --region=us-central1

# Follow logs in real-time
gcloud run services logs tail face-processing-service --region=us-central1
```

## GCP Deployment

### Prerequisites

1. GCP project with billing enabled
2. Cloud Run API enabled
3. Cloud SQL instance (for caching)
4. GCS bucket for face models

### Deploy to Cloud Run

```bash
# Build and deploy
gcloud run deploy face-processing-service \
  --source=services/face-processing-service \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="NODE_ENV=production"
```

### Environment Variables

Required environment variables for GCP deployment:

| Variable                 | Description             | Example                     |
| ------------------------ | ----------------------- | --------------------------- |
| `NODE_ENV`               | Environment             | `production`                |
| `GCP_PROJECT_ID`         | GCP project ID          | `my-project`                |
| `GCS_BUCKET_FACE_MODELS` | Face models bucket      | `digitwin-live-face-models` |
| `DATABASE_URL`           | PostgreSQL connection   | `postgresql://...`          |
| `ENABLE_CACHING`         | Enable PostgreSQL cache | `true`                      |

### Auto-Scaling Configuration

The service auto-scales based on:

- CPU utilization (target: 80%)
- Request concurrency (default: 80)
- Min instances: 0 (scale to zero)
- Max instances: 10

Adjust scaling:

```bash
gcloud run services update face-processing-service \
  --min-instances=1 \
  --max-instances=20 \
  --concurrency=100
```
