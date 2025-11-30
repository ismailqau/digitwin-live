#!/bin/bash
# Script to create and write a custom metric to GCP Cloud Monitoring
# This initializes the metric so alerts can be created

PROJECT_ID="digitwinlive"

# First, write a sample data point to create the metric
curl -X POST \
  "https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "timeSeries": [{
      "metric": {
        "type": "custom.googleapis.com/http/latency",
        "labels": {
          "endpoint": "/api/v1/health"
        }
      },
      "resource": {
        "type": "global",
        "labels": {
          "project_id": "'"${PROJECT_ID}"'"
        }
      },
      "points": [{
        "interval": {
          "endTime": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
        },
        "value": {
          "doubleValue": 150.0
        }
      }]
    }]
  }'

echo ""
echo "Custom metric written. Wait 1-2 minutes, then create the alert policy."
