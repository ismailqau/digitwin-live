"""Download Qwen3-TTS model weights from GCS to local cache."""

import logging
import os
from pathlib import Path

from google.cloud import storage

logger = logging.getLogger(__name__)


def download_model_from_gcs(
    bucket_name: str,
    model_prefix: str,
    local_dir: str,
) -> str:
    """Download a model directory from GCS to local filesystem.

    Args:
        bucket_name: GCS bucket name (e.g. 'digitwinlive-qwen3-tts-models-dev').
        model_prefix: GCS prefix for the model (e.g. 'models/CustomVoice/').
        local_dir: Local directory to download into.

    Returns:
        Local path to the downloaded model directory.
    """
    local_path = os.path.join(local_dir, model_prefix.rstrip("/"))
    marker = os.path.join(local_path, ".download_complete")

    if os.path.exists(marker):
        logger.info("Model already cached at %s", local_path)
        return local_path

    logger.info("Downloading model from gs://%s/%s to %s", bucket_name, model_prefix, local_path)

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blobs = list(bucket.list_blobs(prefix=model_prefix))

    if not blobs:
        raise FileNotFoundError(
            f"No files found in gs://{bucket_name}/{model_prefix}"
        )

    total_bytes = sum(b.size or 0 for b in blobs)
    logger.info("Found %d files (%.1f GB) to download", len(blobs), total_bytes / 1024 / 1024 / 1024)

    downloaded = 0
    for blob in blobs:
        rel_path = blob.name[len(model_prefix):].lstrip("/")
        if not rel_path:
            continue

        dest = os.path.join(local_path, rel_path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)

        blob.download_to_filename(dest)
        downloaded += blob.size or 0
        pct = (downloaded / total_bytes * 100) if total_bytes else 0
        logger.info("  Downloaded %s (%.0f%%)", rel_path, pct)

    # Write marker so we skip next time
    Path(marker).touch()
    logger.info("Model download complete: %s", local_path)
    return local_path
