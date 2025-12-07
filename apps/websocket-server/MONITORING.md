# WebSocket Server Monitoring

## Overview

The WebSocket server includes comprehensive monitoring and metrics tracking for connection health and performance.

## Metrics Tracked

### Connection Success Metrics

- **Total Connection Attempts**: Count of all connection attempts
- **Successful Connections**: Count of successful authentications
- **Failed Connections**: Count of authentication failures
- **Connection Success Rate**: Percentage of successful connections (successful / total completed)

### Authentication Failure Tracking

Detailed breakdown of authentication failures by type:

- `AUTH_REQUIRED`: Missing authentication token
- `AUTH_INVALID`: Invalid or malformed token
- `AUTH_EXPIRED`: Expired authentication token
- `SESSION_CREATE_FAILED`: Session creation timeout or error

### Connection Timing Metrics

- **Average Connection Time**: Mean time from connection attempt to session creation
- **Min Connection Time**: Fastest connection establishment
- **Max Connection Time**: Slowest connection establishment
- **Total Connection Time**: Cumulative connection time

### Timeout Metrics

- **Total Timeouts**: Count of connection timeouts
- **Timeout Rate**: Percentage of connections that timed out

### Active Connection Metrics

- **Active Connections**: Current number of active connections
- **Peak Connections**: Maximum concurrent connections since startup

## Alert Thresholds

The system monitors key metrics and triggers alerts when thresholds are exceeded:

### Default Thresholds

- **Minimum Success Rate**: 95% (alerts if below)
- **Maximum Average Connection Time**: 3000ms (alerts if above)
- **Maximum Timeout Rate**: 5% (alerts if above)

### Configuring Thresholds

```typescript
import { MetricsService } from './application/services/MetricsService';

const metricsService = container.resolve(MetricsService);

metricsService.setAlertThresholds({
  minSuccessRate: 0.98, // 98% minimum
  maxAverageConnectionTime: 2000, // 2 seconds max
  maxTimeoutRate: 0.03, // 3% max
});
```

## Accessing Metrics

### HTTP Endpoint

Metrics are available via the `/metrics` endpoint:

```bash
curl http://localhost:8080/metrics
```

Response format:

```json
{
  "service": "websocket-server",
  "timestamp": "2024-12-07T10:00:00.000Z",
  "metrics": {
    "connectionSuccessRate": 0.95,
    "totalConnectionAttempts": 100,
    "successfulConnections": 95,
    "failedConnections": 5,
    "averageConnectionTimeMs": 1250,
    "minConnectionTimeMs": 500,
    "maxConnectionTimeMs": 3000,
    "timeoutRate": 0.02,
    "totalTimeouts": 2,
    "activeConnections": 15,
    "peakConnections": 25,
    "authFailures": {
      "AUTH_REQUIRED": 2,
      "AUTH_INVALID": 2,
      "AUTH_EXPIRED": 1,
      "SESSION_CREATE_FAILED": 0
    },
    "uptimeSeconds": 3600
  },
  "alerts": {
    "successRateAlert": false,
    "connectionTimeAlert": false,
    "timeoutRateAlert": false,
    "alerts": []
  }
}
```

### Programmatic Access

```typescript
import { MetricsService } from './application/services/MetricsService';

const metricsService = container.resolve(MetricsService);

// Get full metrics
const metrics = metricsService.getMetrics();

// Get summary for logging/monitoring
const summary = metricsService.getMetricsSummary();

// Check alert status
const alerts = metricsService.getAlertStatus();
if (alerts.alerts.length > 0) {
  console.warn('Alerts triggered:', alerts.alerts);
}
```

## Automatic Logging

The MetricsService automatically logs a metrics summary every 5 minutes, including:

- Current metrics snapshot
- Alert status
- Any threshold violations

## Integration with WebSocketController

The MetricsService is automatically integrated with the WebSocketController:

```typescript
// Connection attempt recorded
this.metricsService.recordConnectionAttempt(socketId);

// Success recorded with timing
this.metricsService.recordConnectionSuccess(socketId);

// Failure recorded with reason
this.metricsService.recordConnectionFailure(socketId, 'AUTH_INVALID');

// Timeout recorded
this.metricsService.recordConnectionTimeout(socketId);

// Disconnection recorded
this.metricsService.recordDisconnection(socketId);
```

## Monitoring Best Practices

### 1. Set Up External Monitoring

Configure your monitoring system (e.g., Prometheus, Datadog, CloudWatch) to scrape the `/metrics` endpoint regularly:

```yaml
# Example Prometheus config
scrape_configs:
  - job_name: 'websocket-server'
    scrape_interval: 30s
    static_configs:
      - targets: ['websocket-server:8080']
    metrics_path: '/metrics'
```

### 2. Configure Alerts

Set up alerts based on the metrics:

```yaml
# Example alert rules
- alert: LowConnectionSuccessRate
  expr: connection_success_rate < 0.95
  for: 5m
  annotations:
    summary: 'WebSocket connection success rate below 95%'

- alert: HighConnectionTime
  expr: average_connection_time_ms > 3000
  for: 5m
  annotations:
    summary: 'WebSocket connection time exceeds 3 seconds'

- alert: HighTimeoutRate
  expr: timeout_rate > 0.05
  for: 5m
  annotations:
    summary: 'WebSocket timeout rate exceeds 5%'
```

### 3. Monitor Trends

Track metrics over time to identify:

- Peak usage periods
- Performance degradation
- Authentication issues
- Infrastructure problems (e.g., Cloud Run cold starts)

### 4. Correlate with Logs

The MetricsService logs detailed information that correlates with the metrics:

- Connection attempts (Requirement 4.1)
- Session creation (Requirement 4.2)
- Authentication failures (Requirement 4.3)
- Disconnections (Requirement 4.4)
- Connection errors (Requirement 4.5)

Use log aggregation tools to correlate metrics with detailed logs for troubleshooting.

## Resetting Metrics

For testing or periodic resets:

```typescript
metricsService.resetMetrics();
```

**Note**: This resets all counters and rates. Use with caution in production.

## Requirements Validation

This monitoring implementation satisfies the following requirements:

- ✅ **Requirement 4.1**: Connection success rate metric tracked
- ✅ **Requirement 4.2**: Authentication failure reason tracking
- ✅ **Requirement 4.3**: Average connection establishment time metric
- ✅ **Timeout rate metric**: Tracked and alerted
- ✅ **Alert for success rate < 95%**: Configurable threshold with automatic alerts
- ✅ **Alert for connection time > 3 seconds**: Configurable threshold with automatic alerts
