# Voice Model Management

This document describes the voice model management system for the Real-Time Conversational Clone platform.

## Overview

The Voice Model Management system provides comprehensive CRUD operations, analytics, and lifecycle management for user voice models. It supports multiple TTS providers (XTTS-v2, Google Cloud TTS, OpenAI TTS) and includes features for model comparison, backup/restore, and automatic cleanup.

## Features

### Core Operations

- **Create**: Create new voice models from training jobs
- **Read**: Retrieve voice models with filtering and pagination
- **Update**: Modify voice model metadata and settings
- **Delete**: Soft delete with automatic activation of next best model

### Advanced Features

- **Activation Management**: Automatic activation/deactivation with single active model per user
- **Model Comparison**: Compare multiple models with usage statistics
- **Analytics**: Comprehensive usage and performance analytics
- **Export/Import**: Full model export with training data and analytics
- **Backup/Restore**: Complete backup and restore functionality
- **Cleanup**: Automatic cleanup of expired and unused models
- **Sharing**: Optional team sharing capabilities (for enterprise)

## API Endpoints

### Voice Model CRUD

#### Create Voice Model

```http
POST /voice-models
Content-Type: application/json

{
  "userId": "user-123",
  "provider": "xtts-v2",
  "modelPath": "gs://bucket/models/user-123/model.pth",
  "sampleRate": 22050,
  "qualityScore": 0.85,
  "metadata": {
    "version": "1.0",
    "trainingDuration": "15min"
  }
}
```

#### Get User's Voice Models

```http
GET /voice-models/user/{userId}?limit=20&offset=0&provider=xtts-v2&isActive=true&minQualityScore=0.7
```

#### Get Specific Voice Model

```http
GET /voice-models/{modelId}?userId={userId}
```

#### Update Voice Model

```http
PUT /voice-models/{modelId}
Content-Type: application/json

{
  "userId": "user-123",
  "qualityScore": 0.9,
  "metadata": {
    "updated": true
  }
}
```

#### Delete Voice Model

```http
DELETE /voice-models/{modelId}
Content-Type: application/json

{
  "userId": "user-123"
}
```

### Activation Management

#### Activate Voice Model

```http
POST /voice-models/{modelId}/activate
Content-Type: application/json

{
  "userId": "user-123"
}
```

#### Deactivate Voice Model

```http
POST /voice-models/{modelId}/deactivate
Content-Type: application/json

{
  "userId": "user-123"
}
```

#### Get Active Voice Model

```http
GET /voice-models/user/{userId}/active
```

### Comparison and Selection

#### Compare Voice Models

```http
POST /voice-models/compare
Content-Type: application/json

{
  "modelIds": ["model-1", "model-2", "model-3"],
  "userId": "user-123"
}
```

#### Select Best Voice Model

```http
POST /voice-models/select-best
Content-Type: application/json

{
  "userId": "user-123",
  "criteria": {
    "minQualityScore": 0.8,
    "preferredProvider": "xtts-v2",
    "maxLatency": 1000
  }
}
```

### Analytics

#### Get Voice Model Analytics

```http
GET /voice-models/user/{userId}/analytics
```

Response:

```json
{
  "totalModels": 5,
  "activeModels": 1,
  "modelsByProvider": {
    "xtts-v2": 3,
    "openai-tts": 2
  },
  "averageQualityScore": 0.82,
  "totalUsageCount": 150,
  "totalCost": 25.5,
  "storageUsedMb": 250,
  "lastUsed": "2024-01-15T10:30:00Z"
}
```

#### Get Voice Model Usage Stats

```http
GET /voice-models/{modelId}/usage-stats
```

Response:

```json
{
  "modelId": "model-123",
  "usageCount": 45,
  "totalCost": 8.75,
  "averageLatency": 650,
  "lastUsed": "2024-01-15T10:30:00Z",
  "qualityRating": 4.2
}
```

### Export and Backup

#### Export Voice Model

```http
GET /voice-models/{modelId}/export?userId={userId}
```

#### Create Backup

```http
POST /voice-models/user/{userId}/backup
```

#### Restore from Backup

```http
POST /voice-models/user/{userId}/restore
Content-Type: application/json

{
  "backupPath": "gs://bucket/backups/user-123/backup_123.json",
  "overwriteExisting": false,
  "activateRestored": true
}
```

### Sharing (Optional)

#### Share Voice Model

```http
POST /voice-models/{modelId}/share
Content-Type: application/json

{
  "ownerId": "user-123",
  "targetUserIds": ["user-456", "user-789"],
  "permissions": "use"
}
```

#### Get Shared Voice Models

```http
GET /voice-models/user/{userId}/shared
```

### Cleanup

#### Cleanup Expired Models (Admin)

```http
POST /voice-models/cleanup
```

#### Get Expiring Models

```http
GET /voice-models/expiring?userId={userId}
```

## Data Models

### VoiceModel

```typescript
interface VoiceModel {
  id: string;
  userId: string;
  provider: TTSProvider;
  modelPath: string;
  sampleRate: number;
  qualityScore: number;
  isActive: boolean;
  status: 'pending' | 'training' | 'completed' | 'failed';
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

### VoiceModelAnalytics

```typescript
interface VoiceModelAnalytics {
  totalModels: number;
  activeModels: number;
  modelsByProvider: Record<TTSProvider, number>;
  averageQualityScore: number;
  totalUsageCount: number;
  totalCost: number;
  storageUsedMb: number;
  lastUsed?: Date;
}
```

### VoiceModelUsageStats

```typescript
interface VoiceModelUsageStats {
  modelId: string;
  usageCount: number;
  totalCost: number;
  averageLatency: number;
  lastUsed?: Date;
  qualityRating: number;
}
```

## Business Logic

### Activation Rules

- Only one voice model can be active per user at a time
- When activating a model, all other models are automatically deactivated
- First model created is automatically activated
- High-quality models (score > 0.8) are automatically activated upon creation
- When deleting an active model, the next best model is automatically activated

### Quality Scoring

Voice models are scored on a 0-1 scale based on:

- **Similarity** (0.4 weight): How similar the generated voice sounds to the original
- **Naturalness** (0.3 weight): How natural and human-like the voice sounds
- **Clarity** (0.2 weight): Audio clarity and absence of artifacts
- **Consistency** (0.1 weight): Consistency across different text inputs

### Cleanup Criteria

Models are eligible for cleanup if they meet ALL criteria:

- **Age**: Created more than 6 months ago
- **Status**: Not currently active
- **Quality**: Quality score below 0.5
- **Usage**: No usage in the last 30 days

### Storage Management

- Voice models are stored in Google Cloud Storage
- Model files are organized by user: `gs://digitwin-live-voice-models/{userId}/{modelId}/`
- Backups are stored in: `gs://digitwin-live-voice-models/backups/{userId}/`
- Deleted models are moved to: `gs://digitwin-live-voice-models/deleted/{userId}/`

## Caching Strategy

Following the PostgreSQL caching architecture:

### Cache Tables

- **Voice Model Metadata**: Cached in `cache_voice_models` table (TTL: 1 hour)
- **Usage Statistics**: Cached in `cache_voice_stats` table (TTL: 5 minutes)
- **Analytics Data**: Cached in `cache_voice_analytics` table (TTL: 15 minutes)

### Cache Keys

```typescript
// Voice model metadata
const cacheKey = `voice_model:${modelId}`;

// User's voice models list
const listCacheKey = `voice_models:user:${userId}:${filtersHash}`;

// Analytics data
const analyticsCacheKey = `voice_analytics:${userId}`;
```

### Cache Invalidation

- Model metadata cache is invalidated on create/update/delete operations
- Analytics cache is invalidated on usage events
- List cache is invalidated when models are added/removed/activated

## Error Handling

### Common Error Codes

- **400**: Invalid request parameters
- **403**: Access denied (user doesn't own the model)
- **404**: Voice model not found
- **409**: Conflict (e.g., trying to activate already active model)
- **503**: Service unavailable (database connection issues)

### Error Response Format

```json
{
  "error": "Voice model not found or access denied: model-123",
  "code": "VOICE_MODEL_NOT_FOUND",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-123"
}
```

## Security Considerations

### Access Control

- All operations require user authentication
- Users can only access their own voice models
- Sharing requires explicit permission grants
- Admin operations require elevated privileges

### Data Privacy

- Voice models contain sensitive biometric data
- All model files are encrypted at rest
- Access logs are maintained for audit purposes
- Models are automatically deleted after user account deletion

### Rate Limiting

- Model creation: 5 per hour per user
- Model updates: 20 per hour per user
- Analytics queries: 60 per hour per user
- Backup operations: 2 per day per user

## Monitoring and Alerting

### Key Metrics

- **Model Creation Rate**: New models created per hour
- **Storage Usage**: Total storage used by voice models
- **Quality Distribution**: Distribution of quality scores
- **Usage Patterns**: Most/least used models
- **Cleanup Efficiency**: Models cleaned up vs. total eligible

### Alerts

- **High Storage Usage**: Alert when storage exceeds 80% of quota
- **Low Quality Models**: Alert when average quality drops below 0.7
- **Failed Operations**: Alert on high error rates
- **Cleanup Issues**: Alert when cleanup fails or finds too many eligible models

## Integration Points

### TTS Service Integration

```typescript
// Get active voice model for synthesis
const activeModel = await voiceModelService.getActiveVoiceModel(userId);
if (activeModel) {
  const ttsRequest = {
    text,
    voiceModelId: activeModel.id,
    provider: activeModel.provider,
  };
  return await ttsService.synthesize(ttsRequest);
}
```

### Training Service Integration

```typescript
// Create voice model after successful training
const trainingResult = await trainingService.getResult(jobId);
if (trainingResult.status === 'completed') {
  await voiceModelService.createVoiceModel({
    userId: trainingResult.userId,
    provider: trainingResult.provider,
    modelPath: trainingResult.modelPath,
    qualityScore: trainingResult.qualityScore,
  });
}
```

### Mobile App Integration

```typescript
// Get user's voice models for selection UI
const { models } = await voiceModelService.getUserVoiceModels(
  userId,
  {
    isActive: undefined, // Show all models
  },
  50,
  0
);

// Display models in comparison view
const comparison = await voiceModelService.compareVoiceModels(selectedModelIds, userId);
```

## Performance Considerations

### Database Optimization

- Indexes on `userId`, `isActive`, `qualityScore`, `createdAt`
- Composite index on `(userId, isActive, deletedAt)`
- Partial index on active models: `WHERE isActive = true AND deletedAt IS NULL`

### Query Optimization

- Use pagination for large model lists
- Cache frequently accessed data (active models, analytics)
- Batch operations where possible (bulk updates, cleanup)

### Storage Optimization

- Compress model files before storage
- Use lifecycle policies for automatic archival
- Implement deduplication for similar models

## Future Enhancements

### Planned Features

- **Model Versioning**: Track model versions and allow rollback
- **A/B Testing**: Compare model performance in production
- **Quality Prediction**: Predict quality score before training
- **Auto-Optimization**: Automatically retrain models based on usage patterns
- **Cross-Platform Sync**: Sync models across multiple devices
- **Voice Style Transfer**: Apply different speaking styles to existing models

### API Evolution

- GraphQL API for complex queries
- WebSocket events for real-time updates
- Batch operations API for bulk management
- Advanced filtering and search capabilities

## Related Documentation

- [TTS Multi-Provider Guide](./TTS-MULTI-PROVIDER.md)
- [Voice Model Training](./VOICE-MODEL-TRAINING.md)
- [Voice Sample Recording](./VOICE-SAMPLE-RECORDING.md)
- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [Database Architecture](./DATABASE-ARCHITECTURE.md)
