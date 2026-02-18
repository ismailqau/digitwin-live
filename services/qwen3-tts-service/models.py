"""Pydantic request/response models for Qwen3-TTS service."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SpeakerName(str, Enum):
    VIVIAN = "Vivian"
    SERENA = "Serena"
    UNCLE_FU = "Uncle_Fu"
    DYLAN = "Dylan"
    ERIC = "Eric"
    RYAN = "Ryan"
    AIDEN = "Aiden"
    ONO_ANNA = "Ono_Anna"
    SOHEE = "Sohee"


class LanguageCode(str, Enum):
    ZH = "zh"
    EN = "en"
    JA = "ja"
    KO = "ko"
    DE = "de"
    FR = "fr"
    RU = "ru"
    PT = "pt"
    ES = "es"
    IT = "it"


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    speaker: SpeakerName = Field(default=SpeakerName.VIVIAN)
    language: LanguageCode = Field(default=LanguageCode.EN)
    instruction: Optional[str] = Field(None, max_length=500)
    streaming: bool = Field(default=False)


class CloneRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    speaker_audio: str = Field(..., description="Base64-encoded audio (WAV/MP3/FLAC)")
    ref_text: Optional[str] = Field(None, max_length=2000, description="Transcript of the reference audio for better cloning quality")
    language: LanguageCode = Field(default=LanguageCode.EN)


class SynthesizeResponse(BaseModel):
    audio_data: str  # base64-encoded WAV
    sample_rate: int
    duration: float
    language: str
    speaker: str
    device_used: str
    processing_time: float


class StreamChunk(BaseModel):
    chunk: str  # base64-encoded audio segment
    sequence_number: int
    is_last: bool
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    device: str
    platform: str
    custom_voice_model_loaded: bool
    base_model_loaded: bool
    gpu_available: bool
    gpu_memory_used_mb: Optional[float] = None
    gpu_memory_total_mb: Optional[float] = None
