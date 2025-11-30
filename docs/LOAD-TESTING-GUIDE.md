# Load Testing Guide

## Quick Start

### 1. Start Services

```bash
pnpm dev
```

### 2. Run Simple Load Test (No Dependencies)

```bash
# Default: 10 users, 50 requests each
./scripts/simple-load-test.sh

# Custom load
CONCURRENT_USERS=50 REQUESTS_PER_USER=100 ./scripts/simple-load-test.sh
```

### 3. Manual Latency Tests

```bash
# API Gateway health check
time curl -s http://localhost:3000/health

# WebSocket server health check
time curl -s http://localhost:3001/health

# API endpoint (expects 401 without auth)
time curl -s http://localhost:3000/api/v1/voice/models
```

## Advanced Load Testing

### Using k6 (Recommended)

```bash
# Install k6
brew install k6

# Run load test
k6 run scripts/load-test.js

# Run with custom options
k6 run --vus 50 --duration 2m scripts/load-test.js
```

### Using Artillery

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run scripts/load-test.yml

# Generate HTML report
artillery run --output report.json scripts/load-test.yml
artillery report report.json
```

## Performance Targets

| Metric       | Target  | Description                   |
| ------------ | ------- | ----------------------------- |
| p95 Latency  | <2500ms | 95th percentile response time |
| Error Rate   | <10%    | Percentage of failed requests |
| Health Check | <100ms  | Health endpoint response time |

## Test Results Summary

### Latest Results (50 concurrent users, 5000 requests)

- **Average Latency**: 29.37ms ✅
- **Max Latency**: 173.48ms ✅
- **Error Rate**: 0% ✅
- **Throughput**: 628.42 req/s ✅

## Monitoring in Production

### GCP Cloud Monitoring

1. View latency metrics in GCP Console:
   - Navigate to Cloud Monitoring > Metrics Explorer
   - Select `custom.googleapis.com/http/latency`

2. Set up notification channel (one-time):

   ```bash
   gcloud alpha monitoring channels create \
     --display-name="DevOps Email" \
     --type=email \
     --channel-labels=email_address=your-email@example.com \
     --project=digitwinlive
   ```

3. List channels to get the channel ID:

   ```bash
   gcloud alpha monitoring channels list \
     --project=digitwinlive \
     --format="table(name,displayName,type)"
   ```

4. Set up latency alert using policy file:

   ```bash
   # Create alert policy from JSON file
   gcloud alpha monitoring policies create \
     --policy-from-file=scripts/gcp/high-latency-alert-policy.json \
     --project=digitwinlive
   ```

   The policy file (`scripts/gcp/high-latency-alert-policy.json`) configures:
   - Alert when average latency > 2500ms for 60 seconds
   - Email notification to configured channel

5. Initialize custom metric (required before first alert):
   ```bash
   ./scripts/gcp/write-custom-metric.sh
   ```

## Troubleshooting

### Rate Limiting (429 responses)

The API has rate limiting enabled. If you see many 429 responses:

- Reduce concurrent users
- Add delays between requests
- Check `.env` for `RATE_LIMIT_*` settings

### Connection Refused

Ensure services are running:

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### High Latency

- Check database connection pool settings
- Monitor CPU/memory usage
- Review slow query logs
