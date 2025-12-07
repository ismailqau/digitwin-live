import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthLatency = new Trend('health_latency');
const apiLatency = new Trend('api_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2500'], // 95% of requests should be below 2500ms
    errors: ['rate<0.1'], // Error rate should be below 10%
    health_latency: ['p(95)<100'], // Health checks should be fast
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WEBSOCKET_URL = __ENV.WEBSOCKET_URL || 'ws://localhost:3001';

export default function () {
  // Test 1: Health check - API Gateway
  const healthRes = http.get(`${BASE_URL}/health`);
  healthLatency.add(healthRes.timings.duration);

  check(healthRes, {
    'API Gateway health status is 200': (r) => r.status === 200,
    'API Gateway health response is healthy': (r) => {
      const body = JSON.parse(r.body);
      return body.status === 'healthy';
    },
  });
  errorRate.add(healthRes.status !== 200);

  sleep(0.5);

  // Test 2: Health check - WebSocket Server
  const wsHealthRes = ws.get(`${WEBSOCKET_URL}/health`);

  check(wsHealthRes, {
    'WebSocket health status is 200': (r) => r.status === 200,
    'WebSocket health response is healthy': (r) => {
      const body = JSON.parse(r.body);
      return body.status === 'healthy';
    },
  });
  errorRate.add(wsHealthRes.status !== 200);

  sleep(0.5);

  // Test 3: API endpoint (voice models - requires auth, expect 401)
  const voiceRes = http.get(`${BASE_URL}/api/v1/voice/models`);
  apiLatency.add(voiceRes.timings.duration);

  check(voiceRes, {
    'Voice models returns 401 without auth': (r) => r.status === 401,
  });

  sleep(0.5);

  // Test 4: API endpoint with mock auth header
  const authHeaders = {
    Authorization: 'Bearer mock-token-for-load-test',
    'Content-Type': 'application/json',
  };

  const docsRes = http.get(`${BASE_URL}/api/v1/documents`, { headers: authHeaders });
  apiLatency.add(docsRes.timings.duration);

  check(docsRes, {
    'Documents endpoint responds': (r) => r.status === 401 || r.status === 200,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'scripts/load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const { metrics } = data;

  let summary = '\n========== LOAD TEST SUMMARY ==========\n\n';

  summary += `Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}\n`;
  summary += `Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  summary += `HTTP Request Duration:\n`;
  summary += `  - Average: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  summary += `  - p95: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `  - p99: ${(metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms\n\n`;

  summary += `Health Check Latency:\n`;
  summary += `  - Average: ${(metrics.health_latency?.values?.avg || 0).toFixed(2)}ms\n`;
  summary += `  - p95: ${(metrics.health_latency?.values?.['p(95)'] || 0).toFixed(2)}ms\n\n`;

  summary += `API Latency:\n`;
  summary += `  - Average: ${(metrics.api_latency?.values?.avg || 0).toFixed(2)}ms\n`;
  summary += `  - p95: ${(metrics.api_latency?.values?.['p(95)'] || 0).toFixed(2)}ms\n\n`;

  summary += '========================================\n';

  return summary;
}
