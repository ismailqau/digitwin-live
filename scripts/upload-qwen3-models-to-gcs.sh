#!/bin/bash
# Upload Qwen3-TTS model weights from HuggingFace to GCS
# Usage: ./scripts/upload-qwen3-models-to-gcs.sh [bucket-name]

set -e

BUCKET="${1:-digitwinlive-qwen3-tts-models-dev}"
TMPDIR_MODELS="${TMPDIR:-/tmp}/qwen3-tts-models"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

if ! command -v gsutil &> /dev/null; then
    log_error "gsutil not found. Install Google Cloud SDK."
    exit 1
fi

log_info "Bucket: gs://$BUCKET"
log_info "Temp dir: $TMPDIR_MODELS"
mkdir -p "$TMPDIR_MODELS"

# Download both models using Python snapshot_download
log_info "Downloading models from HuggingFace (~8.4 GB total)..."

python3 -c "
import os
from huggingface_hub import snapshot_download

tmpdir = '$TMPDIR_MODELS'

print('Downloading Qwen3-TTS-12Hz-1.7B-CustomVoice (~4.2 GB)...')
snapshot_download(
    'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
    local_dir=os.path.join(tmpdir, 'CustomVoice'),
    local_dir_use_symlinks=False,
)
print('CustomVoice download complete.')

print('Downloading Qwen3-TTS-12Hz-1.7B-Base (~4.2 GB)...')
snapshot_download(
    'Qwen/Qwen3-TTS-12Hz-1.7B-Base',
    local_dir=os.path.join(tmpdir, 'Base'),
    local_dir_use_symlinks=False,
)
print('Base download complete.')
"

# Upload to GCS
log_info "Uploading CustomVoice to gs://$BUCKET/models/CustomVoice/..."
gsutil -m cp -r "$TMPDIR_MODELS/CustomVoice/*" "gs://$BUCKET/models/CustomVoice/"

log_info "Uploading Base to gs://$BUCKET/models/Base/..."
gsutil -m cp -r "$TMPDIR_MODELS/Base/*" "gs://$BUCKET/models/Base/"

# Verify
log_info "Verifying upload..."
CV_COUNT=$(gsutil ls "gs://$BUCKET/models/CustomVoice/" 2>/dev/null | wc -l | xargs)
BASE_COUNT=$(gsutil ls "gs://$BUCKET/models/Base/" 2>/dev/null | wc -l | xargs)
log_success "CustomVoice: $CV_COUNT files"
log_success "Base: $BASE_COUNT files"

log_success "Models uploaded to gs://$BUCKET/models/"
log_info "The qwen3-tts-service will now load models from GCS on startup."
