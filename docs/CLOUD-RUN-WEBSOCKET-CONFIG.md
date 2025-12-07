# Cloud Run WebSocket Configuration

This document describes the Cloud Run configuration optimizations for WebSocket support in the DigiTwin Live application.

## Overview

WebSocket connections on Cloud Run require specific configuration to handle long-lived connections, cold starts, and session affinity. This document outlines the implemented configuration.

## Cloud Run Service Configuration

### WebSocket Server Settings

The following Terraform configuration is applied to the websocket-server Cloud Run service:

```hcl
resource "google_cloud_run_service" "websocket_server" {
  template {
    metadata {
      annotations = {
        # Minimum instances set to 1 to reduce cold starts
        "autoscaling.knative.dev/minScale" = "1"

        # CPU always allocated for consistent WebSocket performance
        "run.googleapis.com/cpu-throttling" = "false"

        # Enable session affinity for sticky sessions
        "run.googleapis.com/session-affinity" = "true"
      }
    }

    spec {
      # Increased timeout for long-lived WebSocket connections (1 hour)
      timeout_seconds = 3600
    }
  }
}
```

### Configuration Details

#### 1. Session Affinity (`session-affinity: true`)

**Purpose**: Ensures that requests from the same client are routed to the same instance.

**Why it's needed**: WebSocket connections are stateful. If a client's requests are load-balanced across multiple instances, the connection will break.

**How it works**: Cloud Run uses cookies to track which instance a client should connect to.

#### 2. Minimum Instances (`minScale: 1`)

**Purpose**: Keeps at least one instance warm at all times.

**Why it's needed**: Cold starts can take 5-10 seconds, causing connection timeouts for the first user.

**Trade-off**: Increases cost slightly but dramatically improves user experience.

#### 3. CPU Always Allocated (`cpu-throttling: false`)

**Purpose**: Ensures CPU is always available, even when the instance is idle.

**Why it's needed**: WebSocket connections need to respond to heartbeats and messages immediately. CPU throttling can cause delays.

**Trade-off**: Increases cost but ensures consistent performance.

#### 4. Request Timeout (3600 seconds)

**Purpose**: Allows WebSocket connections to stay open for up to 1 hour.

**Why it's needed**: Default timeout is 300 seconds (5 minutes), which is too short for long conversations.

**Note**: Clients should implement reconnection logic for connections longer than 1 hour.

## Socket.IO Configuration

### Server Configuration

```typescript
const io = new SocketIOServer(httpServer, {
  transports: ['polling', 'websocket'], // Polling first for Cloud Run compatibility
  pingTimeout: 60000,
  pingInterval: 25000, // Aligned with client heartbeat interval
  allowUpgrades: true, // Allow upgrade to websocket after polling connects
  perMessageDeflate: false, // Disable compression for lower latency
});
```

### Client Configuration

```typescript
const socket = io(WEBSOCKET_URL, {
  transports: ['polling', 'websocket'], // Polling first for Cloud Run compatibility
  reconnection: false, // We handle reconnection manually
  timeout: 30000, // Increased for Cloud Run cold start
  upgrade: true, // Allow upgrade to websocket after polling connects
  forceNew: true,
});
```

### Transport Order: Polling First

**Why polling first?**

1. **Cold Start Compatibility**: HTTP polling works immediately, even during cold starts
2. **Firewall Friendly**: Some corporate firewalls block WebSocket but allow HTTP
3. **Graceful Upgrade**: Socket.IO automatically upgrades to WebSocket after initial connection
4. **Better Reliability**: If WebSocket fails, falls back to polling automatically

**Connection Flow**:

```
1. Client connects via HTTP polling (works immediately)
2. Server responds and establishes session
3. Socket.IO upgrades to WebSocket (if available)
4. Connection continues on WebSocket for lower latency
```

### Heartbeat Alignment

Both client and server use **25-second intervals** for heartbeats:

- **Server**: `pingInterval: 25000`
- **Client**: `HEARTBEAT_INTERVAL = 25000`

**Why 25 seconds?**

- Keeps connection alive without excessive overhead
- Detects disconnections within 25-50 seconds
- Balances between responsiveness and network efficiency

## Timeouts

### Connection Timeouts

| Timeout                   | Value      | Purpose                                                       |
| ------------------------- | ---------- | ------------------------------------------------------------- |
| `CONNECT_TIMEOUT`         | 30 seconds | Socket.IO connection establishment (accounts for cold start)  |
| `SESSION_CREATED_TIMEOUT` | 10 seconds | Waiting for authentication response (accounts for cold start) |
| `pingTimeout`             | 60 seconds | Server considers client disconnected if no pong received      |

### Why These Values?

- **30s connection timeout**: Cloud Run cold starts can take 5-10 seconds
- **10s session timeout**: Authentication should be fast, but allows for cold start
- **60s ping timeout**: Generous timeout to handle network hiccups

## Deployment

### Automatic Configuration in Deployment Script

The `scripts/gcp-deploy.sh` script has been updated to automatically apply WebSocket-specific configuration when deploying the `websocket-server` service. No manual configuration is needed when using this script.

**Key Features:**

- Detects `websocket-server` service automatically
- Applies all WebSocket optimizations
- Maintains standard configuration for other services
- Logs applied configuration for verification

### Applying Configuration

#### Option 1: Using Deployment Script (Recommended)

The `gcp-deploy.sh` script automatically applies WebSocket-specific configuration:

```bash
# Deploy WebSocket server with optimized configuration
./scripts/gcp-deploy.sh deploy websocket-server --env=production

# The script automatically applies:
# - min-instances=1 (keep warm)
# - timeout=3600 (1 hour)
# - cpu-throttling disabled
# - session-affinity enabled
```

#### Option 2: Using Terraform

```bash
# Navigate to infrastructure directory
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply
```

#### Option 3: Manual gcloud Command

```bash
# Update existing service with WebSocket configuration
gcloud run services update websocket-server \
  --region=us-central1 \
  --min-instances=1 \
  --timeout=3600 \
  --cpu-throttling \
  --session-affinity
```

### Verification

After deployment, verify the configuration:

```bash
# Check service configuration
gcloud run services describe websocket-server \
  --region=us-central1 \
  --format=json | jq '.spec.template.metadata.annotations'

# Expected output should include:
# {
#   "autoscaling.knative.dev/minScale": "1",
#   "run.googleapis.com/cpu-throttling": "false",
#   "run.googleapis.com/session-affinity": "true"
# }
```

## Monitoring

### Key Metrics to Monitor

1. **Connection Success Rate**: Should be > 95%
2. **Average Connection Time**: Should be < 3 seconds (including cold starts)
3. **Cold Start Frequency**: Should be minimal with minScale=1
4. **Active Connections**: Track concurrent WebSocket connections
5. **Timeout Rate**: Should be < 5%

### Alerts

Set up alerts for:

- Connection success rate < 95%
- Average connection time > 5 seconds
- Timeout rate > 10%

## Troubleshooting

### Connection Timeouts

**Symptom**: Client times out waiting for `session_created`

**Possible Causes**:

1. Cold start taking too long (> 10 seconds)
2. Authentication service slow
3. Database connection issues

**Solutions**:

1. Increase `SESSION_CREATED_TIMEOUT` if cold starts are consistently slow
2. Optimize authentication logic
3. Check database connection pool settings

### Frequent Disconnections

**Symptom**: Clients disconnect and reconnect frequently

**Possible Causes**:

1. Session affinity not working
2. Load balancer timeout too short
3. Network issues

**Solutions**:

1. Verify `session-affinity: true` is set
2. Check Cloud Run timeout settings
3. Review client network quality

### High Latency

**Symptom**: Messages take a long time to arrive

**Possible Causes**:

1. CPU throttling enabled
2. Too many concurrent connections per instance
3. Network congestion

**Solutions**:

1. Verify `cpu-throttling: false` is set
2. Increase max instances or reduce concurrency
3. Check network quality metrics

## Cost Considerations

### Impact of Configuration

| Setting                 | Cost Impact   | Justification                            |
| ----------------------- | ------------- | ---------------------------------------- |
| `minScale: 1`           | +$10-20/month | Eliminates cold starts for better UX     |
| `cpu-throttling: false` | +$5-10/month  | Ensures consistent WebSocket performance |
| `timeout: 3600s`        | Minimal       | Only charges for active connection time  |

### Cost Optimization

If cost is a concern:

1. Use `minScale: 0` during off-peak hours
2. Implement connection pooling to reduce instance count
3. Monitor and optimize connection duration

## References

- [Cloud Run WebSocket Support](https://cloud.google.com/run/docs/triggering/websockets)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Cloud Run Autoscaling](https://cloud.google.com/run/docs/configuring/min-instances)
- [Session Affinity](https://cloud.google.com/run/docs/configuring/session-affinity)

## Related Documents

- [WebSocket Connection Flow](./WEBSOCKET-CONNECTION.md)
- [GCP Deployment Guide](./GCP-DEPLOYMENT-GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
