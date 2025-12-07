# Deployment Script Updates for WebSocket Support

## Overview

The `scripts/gcp-deploy.sh` script has been updated to automatically apply WebSocket-specific Cloud Run configuration when deploying the `websocket-server` service.

## Changes Made

### 1. Service-Specific Configuration Detection

The deployment script now detects when deploying the `websocket-server` service and applies optimized configuration automatically.

### 2. WebSocket-Specific Settings

When deploying `websocket-server`, the following configuration is applied:

```bash
--min-instances=1                    # Keep 1 instance warm to reduce cold starts
--max-instances=10                   # Allow scaling up to 10 instances
--timeout=3600                       # 1 hour timeout for long-lived connections
--cpu-throttling                     # Disable CPU throttling for consistent performance
--session-affinity                   # Enable session affinity for sticky sessions
```

### 3. Standard Configuration for Other Services

Other services (api-gateway, face-processing-service) continue to use standard configuration:

```bash
--min-instances=0                    # Scale-to-zero for cost optimization
--max-instances=10                   # Standard scaling limit
--timeout=300                        # 5-minute timeout (standard)
```

## Usage

### Deploy WebSocket Server

```bash
# Production deployment
./scripts/gcp-deploy.sh deploy websocket-server --env=production

# Development deployment
./scripts/gcp-deploy.sh deploy websocket-server --env=development
```

The script will automatically:

1. Build and push the container image
2. Deploy to Cloud Run with WebSocket-specific configuration
3. Log the applied configuration for verification
4. Return the service URL

### Deploy All Services

```bash
# Deploy all services (WebSocket server gets special config automatically)
./scripts/gcp-deploy.sh deploy all --env=production
```

## Configuration Details

### WebSocket Server Configuration

| Setting          | Value          | Reason                                            |
| ---------------- | -------------- | ------------------------------------------------- |
| Min Instances    | 1              | Eliminates cold starts for first user             |
| Max Instances    | 10             | Allows scaling for concurrent users               |
| Timeout          | 3600s (1 hour) | Supports long conversations                       |
| CPU Throttling   | Disabled       | Ensures consistent WebSocket performance          |
| Session Affinity | Enabled        | Routes clients to same instance (sticky sessions) |
| Memory           | 512Mi          | Standard allocation                               |
| CPU              | 1              | Standard allocation                               |

### Other Services Configuration

| Setting          | Value        | Reason                            |
| ---------------- | ------------ | --------------------------------- |
| Min Instances    | 0            | Cost optimization (scale-to-zero) |
| Max Instances    | 10           | Standard scaling                  |
| Timeout          | 300s (5 min) | Standard HTTP timeout             |
| CPU Throttling   | Enabled      | Cost optimization                 |
| Session Affinity | Disabled     | Not needed for stateless services |
| Memory           | 512Mi        | Standard allocation               |
| CPU              | 1            | Standard allocation               |

## Verification

After deployment, verify the configuration:

```bash
# Check WebSocket server configuration
gcloud run services describe websocket-server \
  --region=us-central1 \
  --format=json | jq '.spec.template.metadata.annotations'

# Expected output should include:
# {
#   "autoscaling.knative.dev/minScale": "1",
#   "run.googleapis.com/cpu-throttling": "false",
#   "run.googleapis.com/session-affinity": "true"
# }

# Check timeout
gcloud run services describe websocket-server \
  --region=us-central1 \
  --format="value(spec.template.spec.timeoutSeconds)"

# Expected output: 3600
```

## Logging

The deployment script logs the applied configuration:

```
ℹ️  Deploying to Cloud Run...
ℹ️  Base Configuration:
  Memory: 512Mi
  CPU: 1
  Max instances: 10
  Authentication: Public (unauthenticated)
ℹ️  WebSocket-specific configuration applied:
  Min instances: 1 (reduced cold starts)
  Timeout: 3600s (1 hour for long connections)
  CPU throttling: disabled (consistent performance)
  Session affinity: enabled (sticky sessions)
```

## Cost Impact

### WebSocket Server (min-instances=1)

- **Additional Cost**: ~$10-20/month for keeping 1 instance warm
- **Benefit**: Eliminates cold starts, improves user experience
- **Justification**: Critical for real-time communication

### Other Services (min-instances=0)

- **Cost**: Pay only for actual usage
- **Benefit**: Cost optimization for services that can tolerate cold starts
- **Justification**: Appropriate for stateless HTTP services

## Rollback

If you need to revert to standard configuration:

```bash
# Update WebSocket server to standard configuration
gcloud run services update websocket-server \
  --region=us-central1 \
  --min-instances=0 \
  --timeout=300 \
  --no-cpu-throttling \
  --no-session-affinity
```

Or redeploy using an older version of the script.

## Related Documentation

- [Cloud Run WebSocket Configuration](./CLOUD-RUN-WEBSOCKET-CONFIG.md) - Detailed configuration guide
- [GCP Deployment Guide](./GCP-DEPLOYMENT-GUIDE.md) - General deployment instructions
- [WebSocket Connection Flow](./WEBSOCKET-CONNECTION.md) - Connection architecture

## Requirements Validated

- ✅ **Requirement 1.1**: WebSocket connection establishes within 5 seconds (accounting for cold start)
- ✅ **Requirement 5.5**: Connection timeout handling with 10-second timeout (accounting for cold start)

## Testing

After deploying with the updated script:

1. **Test Cold Start**: Stop all instances and connect - should be fast with min-instances=1
2. **Test Long Connection**: Keep connection open for > 5 minutes - should not timeout
3. **Test Session Affinity**: Connect multiple clients - should route to same instance
4. **Test Scaling**: Generate load - should scale up to max-instances

## Troubleshooting

### Issue: Configuration Not Applied

**Symptom**: WebSocket server deployed without special configuration

**Solution**:

- Verify service name is exactly `websocket-server` (case-sensitive)
- Check script logs for "WebSocket-specific configuration applied" message
- Manually verify with `gcloud run services describe`

### Issue: Deployment Fails

**Symptom**: Deployment fails with configuration error

**Solution**:

- Check gcloud CLI version: `gcloud version` (should be latest)
- Verify project permissions for Cloud Run Admin role
- Check deployment logs: `/tmp/deploy-websocket-server.log`

### Issue: High Costs

**Symptom**: Unexpected costs from min-instances=1

**Solution**:

- This is expected behavior for keeping instance warm
- Consider reducing to min-instances=0 if cost is critical
- Monitor actual usage vs. cost trade-off

## Future Enhancements

Potential improvements for future versions:

1. **Dynamic Min Instances**: Adjust based on time of day or usage patterns
2. **Auto-scaling Metrics**: Use custom metrics for smarter scaling
3. **Multi-Region**: Deploy to multiple regions for global availability
4. **Blue-Green Deployment**: Zero-downtime deployments with traffic splitting
