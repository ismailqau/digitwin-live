# Face Model Creation

Face model creation enables users to create personalized face models for realistic lip-sync animations during conversations.

## Overview

The face model creation flow guides users through capturing photos or video of their face, validating quality, uploading to the server, and processing to create a face model.

## User Flow

1. **Photo Capture** - Capture 3-10 photos at different angles
2. **Video Recording** (optional) - Record 30-60 seconds of head movement
3. **Review** - Review captured media with quality scores
4. **Upload** - Upload media to server with progress tracking
5. **Processing** - Server-side face detection, embedding, and model training
6. **Preview** - Preview the generated face model and activate

## Components

### Screens

| Screen                       | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `FaceCaptureScreen`          | Camera preview with face detection overlay and guided capture |
| `FaceVideoRecordScreen`      | Video recording with head turn guidance                       |
| `FaceReviewScreen`           | Gallery view of captured media with quality badges            |
| `FaceUploadScreen`           | Upload progress with individual item status                   |
| `FaceProcessingStatusScreen` | Processing stages with real-time updates                      |
| `FacePreviewScreen`          | Face model preview with activation option                     |

### Services

| Service                | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `FaceQualityValidator` | Validates face detection, lighting, angle, resolution, and blur |

### State Management

The `faceStore` (Zustand) manages:

- Captured photos and video
- Upload and processing state
- Face model result

## Quality Requirements

| Metric             | Requirement |
| ------------------ | ----------- |
| Face confidence    | > 80%       |
| Resolution         | ≥ 256x256   |
| Angle deviation    | ≤ 30°       |
| Blur score         | < 0.3       |
| Minimum photos     | 3           |
| Recommended photos | 5-10        |

## Processing Stages

1. **Uploading** - Transfer media to server
2. **Detecting** - Face detection and landmark extraction
3. **Embedding** - Generate face identity vectors
4. **Training** - Train personalized face model
5. **Complete** - Model ready for use

## API Integration

The face model creation integrates with:

- Face Processing Service for model creation
- Cloud Storage for media upload
- WebSocket for real-time processing updates

## Related Documentation

- [Lipsync Service](./LIPSYNC-SERVICE.md)
- [Security & Access Controls](./SECURITY-ACCESS-CONTROLS.md)
