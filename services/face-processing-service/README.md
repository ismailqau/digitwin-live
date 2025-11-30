# Face Processing Service

The Face Processing Service provides face detection, 468 facial landmark extraction, quality validation, and face embedding/identity management for the Real-Time Conversational Clone System.

## Features

- **Face Detection**: MediaPipe-based face detection with 468 facial landmarks
- **Face Embedding**: FaceNet/ArcFace-style embedding generation for identity recognition
- **Expression Templates**: Action Unit-based expression detection and template extraction
- **Model Storage**: Face model CRUD operations with versioning and quality scoring
- **Preview Generation**: Model preview and A/B testing capabilities
- **GPU Workers**: Scalable GPU job queue management and worker orchestration

## Quick Start

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Start development server
pnpm dev
```

## API Endpoints

### Face Detection

- `POST /api/v1/face/detect` - Detect faces in images
- `POST /api/v1/face/validate` - Validate face quality
- `POST /api/v1/face/landmarks` - Extract 468 facial landmarks
- `POST /api/v1/face/quality-check` - Quick quality check
- `POST /api/v1/face/analyze` - Detailed image analysis
- `POST /api/v1/face/batch` - Batch process multiple images
- `GET /api/v1/face/thresholds` - Get quality thresholds

### Face Embedding

- `POST /api/v1/face/embedding/generate` - Generate face embeddings
- `POST /api/v1/face/embedding/identity/create` - Create face identity
- `POST /api/v1/face/embedding/identity/verify` - Verify face against identity
- `POST /api/v1/face/embedding/identity/update` - Update identity with new sample
- `POST /api/v1/face/embedding/cluster` - Cluster face embeddings
- `POST /api/v1/face/embedding/consistency` - Check sample consistency

## Services

| Service                     | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `FaceDetectionService`      | Face detection using MediaPipe Face Mesh          |
| `FaceEmbeddingService`      | Face embedding generation and identity management |
| `ExpressionTemplateService` | Expression detection and template extraction      |
| `FaceModelStorageService`   | Face model storage, versioning, and lifecycle     |
| `FaceModelPreviewService`   | Preview generation and model validation           |
| `GPUWorkerService`          | GPU job queuing and worker orchestration          |

## Configuration

```typescript
{
  // Face Detection
  minConfidence: 0.8,
  maxFaces: 5,
  enableLandmarks: true,

  // Face Embedding
  embeddingDimension: 512,
  similarityThreshold: 0.6,
  minSamplesForIdentity: 3,

  // Model Storage
  maxModelsPerUser: 5,
  bucket: 'digitwin-live-face-models',

  // GPU Workers
  autoScaling: {
    minWorkers: 1,
    maxWorkers: 10,
    scaleUpThreshold: 5
  }
}
```

## Testing

```bash
# Run all tests (from repo root)
pnpm --filter @clone/face-processing-service test

# Run with coverage (from repo root)
pnpm --filter @clone/face-processing-service test -- --coverage

# Run specific test file (from repo root)
pnpm --filter @clone/face-processing-service test -- --testPathPattern=face-detection

# Or navigate to this directory first
cd services/face-processing-service
pnpm test
pnpm test -- --testPathPattern=face-detection
```

## Documentation

For detailed API documentation and usage examples, see:

- [Face Processing Guide](../../docs/FACE-PROCESSING.md)
- [Database Architecture](../../docs/DATABASE-ARCHITECTURE.md)
- [GCP Infrastructure](../../docs/GCP-INFRASTRUCTURE.md)

## Dependencies

- MediaPipe for face detection
- Sharp for image processing
- Express for API routing
- Jest for testing
