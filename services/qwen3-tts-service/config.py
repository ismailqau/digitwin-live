"""Configuration for Qwen3-TTS service, loaded from environment variables."""

import os


class Config:
    PORT: int = int(os.getenv("PORT", "8001"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    MODEL_CACHE_DIR: str = os.getenv("MODEL_CACHE_DIR", "/app/models")
    CUSTOM_VOICE_MODEL: str = os.getenv(
        "CUSTOM_VOICE_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
    )
    BASE_MODEL: str = os.getenv("BASE_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
    TOKENIZER_MODEL: str = os.getenv(
        "TOKENIZER_MODEL", "Qwen/Qwen3-TTS-Tokenizer-12Hz"
    )
    CUDA_VISIBLE_DEVICES: str = os.getenv("CUDA_VISIBLE_DEVICES", "0")
    MAX_TEXT_LENGTH: int = int(os.getenv("MAX_TEXT_LENGTH", "2000"))
    GCS_MODEL_BUCKET: str = os.getenv("GCS_MODEL_BUCKET", "")
    USE_VLLM: bool = os.getenv("USE_VLLM", "false").lower() == "true"
