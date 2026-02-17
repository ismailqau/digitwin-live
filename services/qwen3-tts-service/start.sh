#!/bin/bash
set -e

# Sync models from GCS if bucket is configured
if [ -n "$GCS_MODEL_BUCKET" ]; then
    echo "Syncing models from gs://${GCS_MODEL_BUCKET} to ${MODEL_CACHE_DIR:-/app/models}..."
    gsutil -m rsync -r "gs://${GCS_MODEL_BUCKET}/" "${MODEL_CACHE_DIR:-/app/models}/"
    echo "Model sync complete."
fi

exec uvicorn main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8001}"
