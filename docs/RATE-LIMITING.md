# Rate Limiting and Usage Controls

## Overview

The Real-Time Conversational Clone System implements comprehensive rate limiting and usage controls to ensure fair resource allocation across users and subscription tiers. The system uses PostgreSQL for persistent rate limit tracking with a sliding window algorithm.

## Architecture

### Rate Limiting Strategy

- **User-based limiting**: Tracks usage per user ID (not IP address)
- **Subscription-aware**: Different limits for free, pro, and enterprise tiers
- **Sliding window algorithm**: Uses PostgreSQL for accurate, distributed rate limiting
- **Multiple endpoints**: Different limits for different endpoint types

### Storage

Rate limits are stored in the `rate_limits` table in PostgreSQL:

```sql
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  window_start TIMESTAMP NOT NULL,
  request_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, endpoint, window_start),
  INDEX idx_user_endpoint_window (user_id, endpoint, window_start),
  INDEX idx_window_start (window_start)
);
```

## Subscription Tiers

### Free Tier

- **Conversation time**: 60 minutes per day
- **API requests**: 100 requests per hour
- **Upload requests**: 10 uploads per minute
- **Batch uploads**: 2 batch uploads per minute
- **Search requests**: 30 searches per minute

### Pro Tier

- **Conversation time**: Unlimited
- **API requests**: 1,000 requests per hour
- **Upload requests**: 50 uploads per minute
- **Batch uploads**: 10 batch uploads per minute
- **Search requests**: 100 searches per minute

### Enterprise Tier

- **All limits**: Unlimited

## API Endpoints

### Check Rate Limit Status

```http
GET /api/v1/usage/rate-limits
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": {
    "subscriptionTier": "free",
    "conversationMinutesUsed": 30,
    "conversationMinutesLimit": 60,
    "conversationMinutesRemaining": 30,
    "apiRequestsPerHourLimit": 100,
    "uploadRequestsPerMinuteLimit": 10,
    "batchUploadRequestsPerMinuteLimit": 2,
    "searchRequestsPerMinuteLimit": 30,
    "resetAt": "2024-12-03T00:00:00Z"
  },
  "timestamp": "2024-12-02T15:30:00Z"
}
```

### Check Conversation Time Usage

```http
GET /api/v1/usage/conversation-time
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": {
    "subscriptionTier": "free",
    "minutesUsed": 30,
    "minutesLimit": 60,
    "minutesRemaining": 30,
    "percentageUsed": 50,
    "resetAt": "2024-12-03T00:00:00Z",
    "isUnlimited": false
  },
  "timestamp": "2024-12-02T15:30:00Z"
}
```

### Get Usage Summary

```http
GET /api/v1/usage/summary
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": {
    "subscription": {
      "tier": "free",
      "conversationMinutesUsed": 30,
      "conversationMinutesLimit": 60,
      "conversationMinutesRemaining": 30,
      "apiRequestsPerHourLimit": 100,
      "uploadRequestsPerMinuteLimit": 10,
      "searchRequestsPerMinuteLimit": 30
    },
    "usage": {
      "conversationSessions": 5,
      "documents": 12,
      "voiceModels": 1,
      "faceModels": 1
    },
    "resetAt": "2024-12-03T00:00:00Z"
  },
  "timestamp": "2024-12-02T15:30:00Z"
}
```

## Rate Limit Responses

### When Rate Limit Exceeded

**Status Code**: 429 Too Many Requests

**Headers**:

- `Retry-After`: Seconds until retry is allowed
- `X-RateLimit-Limit`: Total limit for the window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: ISO timestamp when limit resets

**Response Body**:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You have exceeded your rate limit",
    "details": {
      "retryAfter": 3600,
      "resetAt": "2024-12-02T16:30:00Z",
      "subscriptionTier": "free",
      "upgradeUrl": "https://example.com/upgrade"
    }
  }
}
```

### Conversation Time Limit Exceeded

**Status Code**: 429 Too Many Requests

**Response Body**:

```json
{
  "error": {
    "code": "CONVERSATION_TIME_LIMIT_EXCEEDED",
    "message": "You have exceeded your daily conversation time limit",
    "details": {
      "minutesUsed": 60,
      "minutesLimit": 60,
      "retryAfter": 28800,
      "resetAt": "2024-12-03T00:00:00Z",
      "subscriptionTier": "free",
      "upgradeUrl": "https://example.com/upgrade"
    }
  }
}
```

## Implementation Details

### Rate Limiting Service

The `RateLimitService` class handles all rate limiting logic:

```typescript
class RateLimitService {
  // Check if request is allowed
  async checkRateLimit(
    userId: string,
    endpoint: string,
    subscriptionTier: 'free' | 'pro' | 'enterprise'
  ): Promise<RateLimitResult>;

  // Check conversation time limit
  async checkConversationTimeLimit(
    userId: string,
    subscriptionTier: 'free' | 'pro' | 'enterprise',
    additionalMinutes: number
  ): Promise<RateLimitResult>;

  // Update conversation minutes
  async updateConversationMinutes(userId: string, additionalMinutes: number): Promise<void>;

  // Get user's rate limit statistics
  async getUserRateLimitStats(userId: string): Promise<Record<string, any>>;

  // Clean up expired records
  async cleanupExpiredRecords(): Promise<void>;

  // Reset daily conversation minutes
  async resetDailyConversationMinutes(): Promise<void>;
}
```

### Middleware

Two middleware functions enforce rate limits:

1. **`userRateLimitMiddleware`**: Checks per-user rate limits based on subscription tier
2. **`conversationTimeLimitMiddleware`**: Checks daily conversation time limits

Both middleware are applied to all `/api` routes.

### Cleanup Service

The `RateLimitCleanupService` runs scheduled jobs:

- **Hourly cleanup**: Removes expired rate limit records older than 1 hour
- **Daily reset**: Resets conversation minutes for all users at midnight UTC

## Configuration

### Environment Variables

```bash
# Rate limiting is enabled by default
ENABLE_RATE_LIMITING=true

# Conversation time limits (in minutes)
FREE_TIER_CONVERSATION_MINUTES=60
PRO_TIER_CONVERSATION_MINUTES=unlimited
ENTERPRISE_TIER_CONVERSATION_MINUTES=unlimited

# API request limits (per hour)
FREE_TIER_API_REQUESTS_PER_HOUR=100
PRO_TIER_API_REQUESTS_PER_HOUR=1000
ENTERPRISE_TIER_API_REQUESTS_PER_HOUR=unlimited

# Upload limits (per minute)
FREE_TIER_UPLOAD_REQUESTS_PER_MINUTE=10
PRO_TIER_UPLOAD_REQUESTS_PER_MINUTE=50
ENTERPRISE_TIER_UPLOAD_REQUESTS_PER_MINUTE=unlimited
```

## Graceful Degradation

When a user exceeds their rate limit:

1. **API requests**: Return 429 with `Retry-After` header
2. **Conversation time**: Prevent new conversations, suggest upgrade
3. **Uploads**: Queue requests or suggest upgrade
4. **Search**: Return cached results or suggest upgrade

## Monitoring

### Rate Limit Statistics

Get cleanup service statistics:

```typescript
const stats = await cleanupService.getStats();
// {
//   totalRateLimitRecords: 1250,
//   expiredRecords: 45,
//   usersWithLimits: 320
// }
```

### Metrics to Track

- Total requests per user per window
- Rate limit violations per tier
- Conversation time usage distribution
- Peak usage times
- Upgrade conversion from rate limit hits

## Best Practices

### For Users

1. **Monitor usage**: Check `/api/v1/usage/summary` regularly
2. **Plan conversations**: Know your daily conversation time limit
3. **Upgrade when needed**: Pro tier removes most limits
4. **Batch operations**: Use batch endpoints to reduce request count

### For Developers

1. **Implement retry logic**: Use `Retry-After` header
2. **Cache responses**: Reduce API requests
3. **Batch requests**: Combine multiple operations
4. **Monitor limits**: Track usage in analytics
5. **Inform users**: Show remaining quota in UI

## Troubleshooting

### "Rate limit exceeded" errors

1. Check current usage: `GET /api/v1/usage/rate-limits`
2. Wait for window to reset (see `resetAt` in response)
3. Consider upgrading to higher tier
4. Implement request batching

### Conversation time limit reached

1. Check daily usage: `GET /api/v1/usage/conversation-time`
2. Wait until next day (midnight UTC)
3. Upgrade to Pro tier for unlimited conversation time

### Rate limits not resetting

1. Check server logs for cleanup service errors
2. Verify database connectivity
3. Manually trigger cleanup if needed
4. Contact support if issue persists

## References

- [Caching Architecture](./CACHING-ARCHITECTURE.md)
- [Database Architecture](./DATABASE-ARCHITECTURE.md)
- [API Gateway Documentation](./API-GATEWAY.md)
