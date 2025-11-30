# Face Processing Service API

Complete API reference for face detection, validation, embedding, and model management.

## Base URL

```
/api/v1/face
```

## Face Validation Endpoints

### POST /detect

Detect faces in a single image.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user-123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "faces": [
      {
        "faceId": "face-uuid",
        "boundingBox": { "x": 100, "y": 50, "width": 200, "height": 200 },
        "landmarks": [...],
        "confidence": 0.95,
        "isPrimary": true,
        "quality": {
          "overallScore": 85,
          "blurScore": 0.9,
          "lightingScore": 0.8,
          "poseScore": 0.85
        }
      }
    ],
    "imageMetadata": {
      "width": 1920,
      "height": 1080,
      "format": "jpeg"
    }
  }
}
```

### POST /validate

Validate a face image for quality requirements.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user-123"
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
      "primaryFace": {...},
      "pose": { "yaw": 5, "pitch": -3, "roll": 1 },
      "recommendations": [],
      "processingTimeMs": 150
    },
    "qualityAssessment": {
      "overallScore": 85,
      "meetsThreshold": true,
      "issues": []
    }
  }
}
```

### POST /preprocess

Preprocess a face image (crop, align, normalize).

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user-123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "processedImage": "base64_encoded_processed_image",
    "metadata": {
      "width": 256,
      "height": 256,
      "aligned": true,
      "normalized": true
    },
    "originalFace": {...}
  }
}
```

### POST /batch

Process multiple images in batch (max 20).

**Request:**

```json
{
  "images": ["base64_image_1", "base64_image_2", ...],
  "userId": "user-123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [...],
    "summary": {
      "totalFrames": 10,
      "validFrames": 8,
      "averageQuality": 82,
      "bestFrameIndex": 3
    }
  }
}
```

### POST /analyze

Detailed image analysis for quality metrics.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user-123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "imageMetadata": {
      "width": 1920,
      "height": 1080,
      "format": "jpeg",
      "channels": 3,
      "hasAlpha": false
    },
    "imageAnalysis": {
      "blurScore": 0.85,
      "lightingScore": 0.78,
      "contrastScore": 0.82
    },
    "faceCount": 1,
    "faces": [...],
    "thresholds": {...}
  }
}
```

### POST /landmarks

Extract 468 facial landmarks from image.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user-123",
  "faceIndex": 0
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "faceId": "face-uuid",
    "totalLandmarks": 468,
    "interPupillaryDistance": 65.5,
    "landmarks": {
      "all": [...],
      "byRegion": {
        "eyes": [...],
        "nose": [...],
        "mouth": [...],
        "contour": [...]
      }
    },
    "boundingBox": {...}
  }
}
```

### POST /quality-check

Quick quality check with pass/fail result.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user-123",
  "strictMode": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "passed": true,
    "qualityTier": "excellent",
    "faceDetected": true,
    "faceCount": 1,
    "overallScore": 88,
    "confidence": 0.96,
    "issues": [],
    "processingTimeMs": 120
  }
}
```

### GET /thresholds

Get current quality thresholds.

**Response:**

```json
{
  "success": true,
  "data": {
    "thresholds": {
      "MIN_CONFIDENCE": 0.8,
      "MIN_FACE_SIZE": 100,
      "MIN_RESOLUTION": 256,
      "MAX_YAW": 30,
      "MAX_PITCH": 25,
      "MAX_ROLL": 20,
      "MIN_BLUR_SCORE": 0.6,
      "MIN_LIGHTING_SCORE": 0.5,
      "MIN_OVERALL_QUALITY": 70
    },
    "description": {...}
  }
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "success": true,
  "service": "face-processing-service",
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "capabilities": [
    "face-detection",
    "landmark-extraction",
    "quality-validation",
    "batch-processing",
    "face-preprocessing"
  ]
}
```

---

## Face Embedding Endpoints

Base path: `/api/v1/face/embedding`

### POST /generate

Generate face embedding from an image.

**Request:**

```json
{
  "imageData": "base64_encoded_image",
  "userId": "user-123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "embedding": {
      "vector": [0.123, -0.456, ...],
      "confidence": 0.95
    },
    "validation": {
      "isValid": true,
      "magnitude": 1.0,
      "hasNaN": false
    },
    "faceId": "face-uuid",
    "faceConfidence": 0.96
  }
}
```

### POST /compare

Compare two face embeddings.

**Request:**

```json
{
  "embedding1": [0.123, -0.456, ...],
  "embedding2": [0.124, -0.455, ...]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "similarity": 0.92,
    "isMatch": true,
    "matchStrength": "strong",
    "distance": 0.08
  }
}
```

### POST /identity/create

Create a face identity from multiple samples (min 3 images).

**Request:**

```json
{
  "userId": "user-123",
  "images": ["base64_image_1", "base64_image_2", "base64_image_3", ...]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "identityId": "identity-uuid",
    "userId": "user-123",
    "sampleCount": 5,
    "confidence": 0.94,
    "version": 1,
    "consistency": {
      "isConsistent": true,
      "score": 0.91,
      "outlierCount": 0,
      "recommendations": []
    },
    "metadata": {...},
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### POST /identity/verify

Verify a face against an existing identity.

**Request:**

```json
{
  "identityId": "identity-uuid",
  "imageData": "base64_encoded_image"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isVerified": true,
    "similarity": 0.93,
    "confidence": 0.95,
    "matchStrength": "strong",
    "bestMatchIndex": 2
  }
}
```

### POST /identity/update

Update an identity with a new face sample.

**Request:**

```json
{
  "identityId": "identity-uuid",
  "imageData": "base64_encoded_image"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "identityId": "identity-uuid",
    "version": 2,
    "sampleCount": 6,
    "confidence": 0.95,
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

### GET /identity/:identityId

Get identity details.

**Response:**

```json
{
  "success": true,
  "data": {
    "identityId": "identity-uuid",
    "userId": "user-123",
    "sampleCount": 5,
    "confidence": 0.94,
    "version": 1,
    "metadata": {...},
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "needsReEmbedding": false
  }
}
```

### DELETE /identity/:identityId

Delete an identity.

**Response:**

```json
{
  "success": true,
  "message": "Identity deleted successfully"
}
```

### POST /cluster

Cluster multiple face embeddings to find distinct identities.

**Request:**

```json
{
  "images": ["base64_image_1", "base64_image_2", ...]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalEmbeddings": 10,
    "clusterCount": 3,
    "clusters": [
      {
        "clusterId": 0,
        "size": 4,
        "memberIndices": [0, 2, 5, 8],
        "intraClusterSimilarity": 0.92
      },
      ...
    ]
  }
}
```

### POST /consistency

Check consistency of multiple face samples.

**Request:**

```json
{
  "images": ["base64_image_1", "base64_image_2", ...]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isConsistent": true,
    "consistencyScore": 0.89,
    "outlierIndices": [],
    "recommendations": [],
    "pairwiseSimilarities": [[1.0, 0.91, ...], ...]
  }
}
```

### GET /config

Get embedding service configuration.

**Response:**

```json
{
  "success": true,
  "data": {
    "embeddingDimension": 512,
    "similarityThreshold": 0.7,
    "strongMatchThreshold": 0.85,
    "moderateMatchThreshold": 0.75,
    "minSamplesForIdentity": 3,
    "maxSamplesForIdentity": 20,
    "modelVersion": "1.0.0"
  }
}
```

---

## Quality Tiers

| Tier       | Score Range | Description                    |
| ---------- | ----------- | ------------------------------ |
| excellent  | 90-100      | Perfect for all use cases      |
| good       | 80-89       | Suitable for most applications |
| acceptable | 70-79       | May have minor issues          |
| poor       | 0-69        | Not recommended for production |

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:

- `400` - Bad request (missing/invalid parameters)
- `404` - Resource not found
- `500` - Internal server error

## Rate Limits

| Endpoint      | Limit  |
| ------------- | ------ |
| /detect       | 60/min |
| /validate     | 60/min |
| /batch        | 10/min |
| /embedding/\* | 30/min |
| /identity/\*  | 20/min |

## Related Documentation

- [Lip-Sync Service](./LIPSYNC-SERVICE.md)
- [Face Processing Overview](./FACE-PROCESSING.md)
- [Audio Processing](./AUDIO-PROCESSING.md)
