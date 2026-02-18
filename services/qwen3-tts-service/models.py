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
    # Natively supported by Qwen3-TTS
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
    # Extended languages (translated to English before synthesis)
    UR = "ur"   # Urdu
    AR = "ar"   # Arabic
    HI = "hi"   # Hindi


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


# ---------------------------------------------------------------------------
# Voice library models
# ---------------------------------------------------------------------------

class AddVoiceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    ref_audio: str = Field(..., description="Base64-encoded audio (WAV/MP3/FLAC/M4A)")
    description: str = Field(default="", max_length=500)
    ref_text: Optional[str] = Field(None, max_length=2000, description="Transcript of reference audio")
    language_hint: LanguageCode = Field(default=LanguageCode.EN, description="Language of the reference audio")


class UpdateVoiceRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class VoiceEntryResponse(BaseModel):
    id: str
    name: str
    description: str
    ref_text: Optional[str]
    created_at: str
    language_hint: str


# ---------------------------------------------------------------------------
# Audio-to-audio / translate-synthesize models
# ---------------------------------------------------------------------------

class AudioToAudioRequest(BaseModel):
    """Transcribe input audio, translate if needed, then synthesize in target language."""
    audio: str = Field(..., description="Base64-encoded input audio (WAV/MP3/FLAC/M4A)")
    target_language: LanguageCode = Field(default=LanguageCode.EN)
    speaker: SpeakerName = Field(default=SpeakerName.VIVIAN)
    voice_id: Optional[str] = Field(None, description="Use a library voice instead of a preset speaker")
    instruction: Optional[str] = Field(None, max_length=500)


class TranslateSynthesizeRequest(BaseModel):
    """Translate text from source language and synthesize in target language."""
    text: str = Field(..., min_length=1, max_length=2000)
    source_language: LanguageCode = Field(default=LanguageCode.EN)
    target_language: LanguageCode = Field(default=LanguageCode.EN)
    speaker: SpeakerName = Field(default=SpeakerName.VIVIAN)
    voice_id: Optional[str] = Field(None, description="Use a library voice instead of a preset speaker")
    instruction: Optional[str] = Field(None, max_length=500)


class TranslateSynthesizeResponse(BaseModel):
    audio_data: str
    sample_rate: int
    duration: float
    source_language: str
    target_language: str
    original_text: str
    translated_text: str
    speaker: str
    device_used: str
    processing_time: float


class CloneAudioToAudioRequest(BaseModel):
    """Transcribe input audio and re-synthesize using a cloned voice — no translation.

    The transcribed text is synthesized as-is in the detected source language.
    Provide either voice_id (library voice) or speaker_audio (inline reference).
    """
    audio: str = Field(..., description="Base64-encoded input audio to transcribe (WAV/MP3/FLAC/M4A)")
    # Option A: use a saved library voice
    voice_id: Optional[str] = Field(None, description="Library voice ID to clone")
    # Option B: inline reference audio for one-shot cloning
    speaker_audio: Optional[str] = Field(None, description="Base64-encoded reference audio for inline cloning")
    ref_text: Optional[str] = Field(None, max_length=2000, description="Transcript of reference audio (improves quality)")


class CloneAudioToAudioResponse(BaseModel):
    audio_data: str
    sample_rate: int
    duration: float
    detected_language: str
    transcribed_text: str
    speaker: str
    device_used: str
    processing_time: float
