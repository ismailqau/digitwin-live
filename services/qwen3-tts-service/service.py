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

    async def initialize_models(self) -> None:
        """Load CustomVoice and Base models, downloading and caching if not present."""
        async with _model_lock:
            if self.custom_voice_model_loaded and self.base_model_loaded:
                return

            try:
                from qwen_tts import Qwen3TTSModel

                cache_dir = Config.MODEL_CACHE_DIR
                os.makedirs(cache_dir, exist_ok=True)

                logger.info(
                    "Loading CustomVoice model: %s", Config.CUSTOM_VOICE_MODEL
                )
                self.custom_voice_model = Qwen3TTSModel.from_pretrained(
                    Config.CUSTOM_VOICE_MODEL,
                    cache_dir=cache_dir,
                    device=self.device,
                )
                self.custom_voice_model_loaded = True
                logger.info("CustomVoice model loaded successfully")

                logger.info("Loading Base model: %s", Config.BASE_MODEL)
                self.base_model = Qwen3TTSModel.from_pretrained(
                    Config.BASE_MODEL,
                    cache_dir=cache_dir,
                    device=self.device,
                )
                self.base_model_loaded = True
                logger.info("Base model loaded successfully")

            except Exception as e:
                logger.error("Failed to initialize models: %s", e)
                raise

    async def synthesize(self, request: SynthesizeRequest) -> SynthesizeResponse:
        """Generate audio using CustomVoice model with a premium timbre."""
        if not self.custom_voice_model_loaded:
            await self.initialize_models()

        start_time = time.time()

        try:
            kwargs = {
                "text": request.text,
                "speaker": request.speaker.value,
                "language": request.language.value,
            }
            if request.instruction:
                kwargs["instruction"] = request.instruction

            result = self.custom_voice_model.generate_custom_voice(**kwargs)

            audio_data = np.array(result["audio"], dtype=np.float32)
            sample_rate = int(result.get("sample_rate", 24000))
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
            await self.initialize_models()

        start_time = time.time()
        tmp_path: Optional[str] = None

        try:
            tmp_path, audio_duration = self.validate_audio_sample(
                request.speaker_audio
            )

            result = self.base_model.generate_voice_clone(
                text=request.text,
                speaker_audio=tmp_path,
                language=request.language.value,
            )

            audio_data = np.array(result["audio"], dtype=np.float32)
            sample_rate = int(result.get("sample_rate", 24000))
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
        """Stream audio chunks using CustomVoice model's dual-track hybrid streaming."""
        if not self.custom_voice_model_loaded:
            await self.initialize_models()

        sequence = 0

        try:
            kwargs = {
                "text": request.text,
                "speaker": request.speaker.value,
                "language": request.language.value,
                "streaming": True,
            }
            if request.instruction:
                kwargs["instruction"] = request.instruction

            stream = self.custom_voice_model.generate_custom_voice(**kwargs)

            for chunk_audio in stream:
                audio_data = np.array(chunk_audio["audio"], dtype=np.float32)
                sample_rate = int(chunk_audio.get("sample_rate", 24000))
                chunk_b64 = self._encode_audio_to_base64(audio_data, sample_rate)
                is_last = chunk_audio.get("is_last", False)

                yield StreamChunk(
                    chunk=chunk_b64,
                    sequence_number=sequence,
                    is_last=is_last,
                )
                sequence += 1

                if is_last:
                    return

            # If the stream ended without an explicit is_last, send a final chunk
            if sequence == 0 or not is_last:
                yield StreamChunk(
                    chunk="",
                    sequence_number=sequence,
                    is_last=True,
                )

        except Exception as e:
            logger.error("Streaming synthesis failed: %s", e)
            yield StreamChunk(
                chunk="",
                sequence_number=sequence,
                is_last=True,
                error=str(e),
            )

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
