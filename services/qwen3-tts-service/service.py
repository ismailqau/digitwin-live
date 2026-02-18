"""Qwen3-TTS service class handling model loading, synthesis, cloning, and streaming."""

import asyncio
import base64
import io
import logging
import os
import platform
import tempfile
import time
from typing import AsyncGenerator, Optional

import numpy as np
import soundfile as sf

try:
    import torch
except ImportError:
    torch = None  # type: ignore[assignment]

from config import Config
from models import (
    CloneRequest,
    StreamChunk,
    SynthesizeRequest,
    SynthesizeResponse,
)

logger = logging.getLogger(__name__)

PLATFORM = platform.system().lower()

SUPPORTED_AUDIO_FORMATS = {"WAV", "FLAC", "MP3"}
MIN_AUDIO_DURATION_SECONDS = 3.0

# Map short language codes to full names expected by qwen-tts
LANGUAGE_MAP = {
    "zh": "Chinese",
    "en": "English",
    "ja": "Japanese",
    "ko": "Korean",
    "de": "German",
    "fr": "French",
    "ru": "Russian",
    "pt": "Portuguese",
    "es": "Spanish",
    "it": "Italian",
}


def get_device() -> str:
    """Determine the best available device for inference."""
    if torch is not None and torch.cuda.is_available():
        return "cuda"
    return "cpu"


DEVICE = get_device()
logger.info("Platform: %s, Device: %s", PLATFORM, DEVICE)

_model_lock = asyncio.Lock()


class Qwen3TTSService:
    """Core service for Qwen3-TTS model inference."""

    def __init__(self) -> None:
        self.custom_voice_model = None
        self.base_model = None
        self.custom_voice_model_loaded: bool = False
        self.base_model_loaded: bool = False
        self.device: str = DEVICE
        self.init_error: Optional[str] = None

    async def initialize_models(self) -> None:
        """Load CustomVoice and Base models.

        Loading order:
        1. Check local cache (already downloaded)
        2. Download from GCS bucket if GCS_MODEL_BUCKET is set
        3. Fall back to HuggingFace from_pretrained
        """
        async with _model_lock:
            if self.custom_voice_model_loaded and self.base_model_loaded:
                return

            try:
                logger.info("Importing qwen_tts package...")
                from qwen_tts import Qwen3TTSModel

                cache_dir = Config.MODEL_CACHE_DIR
                os.makedirs(cache_dir, exist_ok=True)

                custom_voice_path = self._resolve_model_path(
                    Config.CUSTOM_VOICE_MODEL, "CustomVoice", cache_dir
                )
                base_path = self._resolve_model_path(
                    Config.BASE_MODEL, "Base", cache_dir
                )

                # Build from_pretrained kwargs based on device
                load_kwargs = self._get_load_kwargs()

                logger.info(
                    "Loading CustomVoice model from: %s (device_map=%s)",
                    custom_voice_path,
                    load_kwargs.get("device_map", "N/A"),
                )
                self.custom_voice_model = Qwen3TTSModel.from_pretrained(
                    custom_voice_path, **load_kwargs
                )
                self.custom_voice_model_loaded = True
                logger.info("CustomVoice model loaded successfully")

                logger.info("Loading Base model from: %s", base_path)
                self.base_model = Qwen3TTSModel.from_pretrained(
                    base_path, **load_kwargs
                )
                self.base_model_loaded = True
                logger.info("Base model loaded successfully")

            except Exception as e:
                self.init_error = str(e)
                logger.error("Failed to initialize models: %s", e)
                # Don't re-raise — let the service stay up so health checks pass

    def _get_load_kwargs(self) -> dict:
        """Build kwargs for Qwen3TTSModel.from_pretrained based on device.

        The qwen-tts library accepts ``device_map`` for GPU placement and
        ``dtype`` for precision.  On CPU we omit ``device_map`` entirely so
        the library falls back to its default CPU path — passing
        ``device_map="cpu"`` causes an unexpected ``device`` kwarg error
        inside the underlying model constructor.
        """
        kwargs: dict = {}
        if self.device == "cuda":
            kwargs["device_map"] = "cuda:0"
            if torch is not None:
                kwargs["dtype"] = torch.bfloat16
            # Enable FlashAttention 2 when available (Ada Lovelace / Ampere+)
            try:
                import flash_attn  # noqa: F401
                kwargs["attn_implementation"] = "flash_attention_2"
            except ImportError:
                pass
        # On CPU / MPS: don't pass device_map — let the library default
        return kwargs

    @staticmethod
    def _resolve_model_path(hf_model_id: str, gcs_prefix: str, cache_dir: str) -> str:
        """Resolve model path: GCS download → local cache → HuggingFace ID.

        Returns a local path if GCS download succeeds, otherwise the original
        HuggingFace model ID for from_pretrained to handle.
        """
        # Check if models already exist locally from a previous GCS download
        local_path = os.path.join(cache_dir, gcs_prefix)
        marker = os.path.join(local_path, ".download_complete")
        if os.path.exists(marker):
            logger.info("Using cached model at %s", local_path)
            return local_path

        # Try GCS download
        bucket_name = Config.GCS_MODEL_BUCKET
        if bucket_name:
            try:
                from gcs_loader import download_model_from_gcs

                path = download_model_from_gcs(
                    bucket_name=bucket_name,
                    model_prefix=f"models/{gcs_prefix}/",
                    local_dir=cache_dir,
                )
                return path
            except Exception as e:
                logger.warning(
                    "GCS download failed for %s, falling back to HuggingFace: %s",
                    gcs_prefix, e,
                )

        # Fall back to HuggingFace
        logger.info("Using HuggingFace model ID: %s", hf_model_id)
        return hf_model_id

    @staticmethod
    def _to_language_name(code: str) -> str:
        """Convert short language code to full name expected by qwen-tts."""
        return LANGUAGE_MAP.get(code, "Auto")

    async def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        """Generate audio using CustomVoice model with a premium timbre."""
        if not self.custom_voice_model_loaded:
            if self.init_error:
                raise RuntimeError(f"Model initialization failed: {self.init_error}")
            await self.initialize_models()
            if not self.custom_voice_model_loaded:
                raise RuntimeError(f"Model not available: {self.init_error}")

        start_time = time.time()

        try:
            language_name = self._to_language_name(request.language.value)

            kwargs: dict = {
                "text": request.text,
                "speaker": request.speaker.value,
                "language": language_name,
            }
            if request.instruction:
                kwargs["instruct"] = request.instruction

            wavs, sample_rate = self.custom_voice_model.generate_custom_voice(**kwargs)

            audio_data = np.array(wavs[0], dtype=np.float32)
            duration = len(audio_data) / sample_rate

            audio_b64 = self._encode_audio_to_base64(audio_data, sample_rate)

            return SynthesizeResponse(
                audio_data=audio_b64,
                sample_rate=sample_rate,
                duration=round(duration, 3),
                language=request.language.value,
                speaker=request.speaker.value,
                device_used=self.device,
                processing_time=round(time.time() - start_time, 3),
            )

        except Exception as e:
            if torch is not None and isinstance(e, torch.cuda.OutOfMemoryError):
                raise
            logger.error("Synthesis failed: %s", e)
            raise RuntimeError(f"Synthesis failed: {e}") from e

    async def clone_voice(self, request: CloneRequest) -> SynthesizeResponse:
        """Generate audio using Base model with voice cloning from an audio sample."""
        if not self.base_model_loaded:
            if self.init_error:
                raise RuntimeError(f"Model initialization failed: {self.init_error}")
            await self.initialize_models()
            if not self.base_model_loaded:
                raise RuntimeError(f"Model not available: {self.init_error}")

        start_time = time.time()
        tmp_path: Optional[str] = None

        try:
            tmp_path, audio_duration = self.validate_audio_sample(
                request.speaker_audio
            )

            language_name = self._to_language_name(request.language.value)

            clone_kwargs: dict = {
                "text": request.text,
                "ref_audio": tmp_path,
                "language": language_name,
            }

            # If ref_text is provided, use full clone mode for better quality.
            # Otherwise use x_vector_only_mode (speaker embedding only).
            if request.ref_text:
                clone_kwargs["ref_text"] = request.ref_text
            else:
                clone_kwargs["x_vector_only_mode"] = True

            wavs, sample_rate = self.base_model.generate_voice_clone(**clone_kwargs)

            audio_data = np.array(wavs[0], dtype=np.float32)
            duration = len(audio_data) / sample_rate

            audio_b64 = self._encode_audio_to_base64(audio_data, sample_rate)

            return SynthesizeResponse(
                audio_data=audio_b64,
                sample_rate=sample_rate,
                duration=round(duration, 3),
                language=request.language.value,
                speaker="clone",
                device_used=self.device,
                processing_time=round(time.time() - start_time, 3),
            )

        except ValueError:
            raise
        except Exception as e:
            if torch is not None and isinstance(e, torch.cuda.OutOfMemoryError):
                raise
            logger.error("Voice cloning failed: %s", e)
            raise RuntimeError(f"Voice cloning failed: {e}") from e
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    async def synthesize_stream(
        self, request: SynthesizeRequest
    ) -> AsyncGenerator[StreamChunk, None]:
        """Stream audio chunks by splitting text into sentences and generating each.

        Note: qwen-tts does not have a native streaming API, so we simulate
        streaming by splitting text on sentence boundaries and generating
        each segment individually.
        """
        if not self.custom_voice_model_loaded:
            if self.init_error:
                yield StreamChunk(chunk="", sequence_number=0, is_last=True, error=f"Model init failed: {self.init_error}")
                return
            await self.initialize_models()
            if not self.custom_voice_model_loaded:
                yield StreamChunk(chunk="", sequence_number=0, is_last=True, error=f"Model not available: {self.init_error}")
                return

        sequence = 0

        try:
            # Split text into sentence-level chunks for pseudo-streaming
            sentences = self._split_sentences(request.text)
            language_name = self._to_language_name(request.language.value)

            for i, sentence in enumerate(sentences):
                if not sentence.strip():
                    continue

                kwargs: dict = {
                    "text": sentence,
                    "speaker": request.speaker.value,
                    "language": language_name,
                }
                if request.instruction:
                    kwargs["instruct"] = request.instruction

                wavs, sample_rate = self.custom_voice_model.generate_custom_voice(**kwargs)
                audio_data = np.array(wavs[0], dtype=np.float32)
                chunk_b64 = self._encode_audio_to_base64(audio_data, sample_rate)
                is_last = (i == len(sentences) - 1)

                yield StreamChunk(
                    chunk=chunk_b64,
                    sequence_number=sequence,
                    is_last=is_last,
                )
                sequence += 1

            # If no chunks were yielded, send an empty final chunk
            if sequence == 0:
                yield StreamChunk(chunk="", sequence_number=0, is_last=True)

        except Exception as e:
            logger.error("Streaming synthesis failed: %s", e)
            yield StreamChunk(
                chunk="",
                sequence_number=sequence,
                is_last=True,
                error=str(e),
            )

    @staticmethod
    def _split_sentences(text: str) -> list[str]:
        """Split text into sentences on common delimiters."""
        import re
        # Split on sentence-ending punctuation (keep the delimiter attached)
        parts = re.split(r'(?<=[.!?。！？])\s*', text)
        return [p for p in parts if p.strip()]

    def validate_audio_sample(self, audio_b64: str) -> tuple[str, float]:
        """Decode base64 audio, detect format (WAV/MP3/FLAC), validate >= 3s duration.

        Returns:
            Tuple of (temporary file path, duration in seconds).

        Raises:
            ValueError: If audio is invalid format or too short.
        """
        try:
            audio_bytes = base64.b64decode(audio_b64)
        except Exception as e:
            raise ValueError(f"Invalid base64 audio data: {e}") from e

        # Detect format from file signature
        fmt = self._detect_audio_format(audio_bytes)
        if fmt not in SUPPORTED_AUDIO_FORMATS:
            raise ValueError(
                f"Unsupported audio format. Supported formats: {', '.join(sorted(SUPPORTED_AUDIO_FORMATS))}"
            )

        suffix_map = {"WAV": ".wav", "MP3": ".mp3", "FLAC": ".flac"}
        suffix = suffix_map.get(fmt, ".wav")

        tmp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        try:
            tmp_file.write(audio_bytes)
            tmp_file.flush()
            tmp_file.close()

            data, sample_rate = sf.read(tmp_file.name)
            duration = len(data) / sample_rate

            if duration < MIN_AUDIO_DURATION_SECONDS:
                os.unlink(tmp_file.name)
                raise ValueError(
                    f"Audio sample too short ({duration:.1f}s). "
                    f"Minimum duration is {MIN_AUDIO_DURATION_SECONDS:.0f} seconds."
                )

            return tmp_file.name, duration

        except ValueError:
            raise
        except Exception as e:
            if os.path.exists(tmp_file.name):
                os.unlink(tmp_file.name)
            raise ValueError(f"Failed to read audio file: {e}") from e

    @staticmethod
    def _detect_audio_format(data: bytes) -> str:
        """Detect audio format from file header bytes."""
        if len(data) < 12:
            return "UNKNOWN"
        if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
            return "WAV"
        if data[:4] == b"fLaC":
            return "FLAC"
        # MP3: check for ID3 tag or MPEG sync word
        if data[:3] == b"ID3" or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
            return "MP3"
        return "UNKNOWN"

    @staticmethod
    def get_gpu_info() -> dict:
        """Return CUDA GPU memory usage and availability."""
        info: dict = {"gpu_available": False}
        if torch is not None and torch.cuda.is_available():
            info["gpu_available"] = True
            mem_used = torch.cuda.memory_allocated() / (1024 * 1024)
            mem_total = torch.cuda.get_device_properties(0).total_mem / (
                1024 * 1024
            )
            info["gpu_memory_used_mb"] = round(mem_used, 1)
            info["gpu_memory_total_mb"] = round(mem_total, 1)
        return info

    @staticmethod
    def _encode_audio_to_base64(
        audio_data: np.ndarray, sample_rate: int
    ) -> str:
        """Encode numpy audio array to base64 WAV string."""
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)

        buffer = io.BytesIO()
        sf.write(buffer, audio_data, sample_rate, format="WAV")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
