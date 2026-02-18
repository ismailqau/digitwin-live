#!/usr/bin/env python3
"""Qwen3-TTS Service — FastAPI application with routes for synthesis, cloning, streaming,
voice library management, translation-synthesis, and audio-to-audio conversion."""

import asyncio
import json
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn

from config import Config
from models import (
    AddVoiceRequest,
    AudioToAudioRequest,
    CloneAudioToAudioRequest,
    CloneAudioToAudioResponse,
    CloneRequest,
    HealthResponse,
    LanguageCode,
    SpeakerName,
    SynthesizeRequest,
    SynthesizeResponse,
    TranslateSynthesizeRequest,
    TranslateSynthesizeResponse,
    UpdateVoiceRequest,
    VoiceEntryResponse,
)
from service import Qwen3TTSService, DEVICE, PLATFORM
from translation_provider import LANGUAGE_DISPLAY_NAMES
from voice_library import voice_library

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    import torch
except ImportError:
    torch = None  # type: ignore[assignment]

# Service singleton
qwen3_service = Qwen3TTSService()

app = FastAPI(title="Qwen3-TTS Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event() -> None:
    logger.info("Starting Qwen3-TTS service on %s:%s", Config.HOST, Config.PORT)
    logger.info("Device: %s, Platform: %s", DEVICE, PLATFORM)
    # Fire-and-forget model loading — server starts immediately
    asyncio.create_task(_safe_model_init())


async def _safe_model_init() -> None:
    """Initialize models with full error handling so the server never crashes."""
    try:
        await qwen3_service.initialize_models()
    except Exception as e:
        logger.error("Background model initialization failed: %s", e)
        # Service stays up — /health reports status, /ready returns 503


# ---------------------------------------------------------------------------
# Health & readiness
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Always returns 200 so Cloud Run keeps the container alive."""
    gpu_info = Qwen3TTSService.get_gpu_info()

    if qwen3_service.custom_voice_model_loaded and qwen3_service.base_model_loaded:
        status = "healthy"
    elif qwen3_service.init_error:
        status = f"error: {qwen3_service.init_error}"
    else:
        status = "initializing"

    return HealthResponse(
        status=status,
        device=DEVICE,
        platform=PLATFORM,
        custom_voice_model_loaded=qwen3_service.custom_voice_model_loaded,
        base_model_loaded=qwen3_service.base_model_loaded,
        gpu_available=gpu_info.get("gpu_available", False),
        gpu_memory_used_mb=gpu_info.get("gpu_memory_used_mb"),
        gpu_memory_total_mb=gpu_info.get("gpu_memory_total_mb"),
    )


@app.get("/ready")
async def readiness_check() -> dict:
    if qwen3_service.custom_voice_model_loaded and qwen3_service.base_model_loaded:
        return {"status": "ready"}
    detail = qwen3_service.init_error or "Models not loaded yet"
    raise HTTPException(status_code=503, detail=detail)


# ---------------------------------------------------------------------------
# Synthesis & cloning
# ---------------------------------------------------------------------------

@app.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(request: SynthesizeRequest) -> SynthesizeResponse:
    try:
        return await qwen3_service.synthesize(request)
    except RuntimeError as e:
        if torch is not None and isinstance(e.__cause__, torch.cuda.OutOfMemoryError):
            raise HTTPException(
                status_code=503,
                detail="GPU out of memory. Please retry later.",
                headers={"Retry-After": "30"},
            )
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        if torch is not None and isinstance(e, torch.cuda.OutOfMemoryError):
            raise HTTPException(
                status_code=503,
                detail="GPU out of memory. Please retry later.",
                headers={"Retry-After": "30"},
            )
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {e}")


@app.post("/clone", response_model=SynthesizeResponse)
async def clone_voice(request: CloneRequest) -> SynthesizeResponse:
    try:
        return await qwen3_service.clone_voice(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        if torch is not None and isinstance(e.__cause__, torch.cuda.OutOfMemoryError):
            raise HTTPException(
                status_code=503,
                detail="GPU out of memory. Please retry later.",
                headers={"Retry-After": "30"},
            )
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        if torch is not None and isinstance(e, torch.cuda.OutOfMemoryError):
            raise HTTPException(
                status_code=503,
                detail="GPU out of memory. Please retry later.",
                headers={"Retry-After": "30"},
            )
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {e}")


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

@app.post("/synthesize/stream")
async def synthesize_stream(request: SynthesizeRequest) -> StreamingResponse:
    async def event_generator():
        try:
            async for chunk in qwen3_service.synthesize_stream(request):
                yield json.dumps(chunk.model_dump()) + "\n"
        except Exception as e:
            if torch is not None and isinstance(e, torch.cuda.OutOfMemoryError):
                error_chunk = {"chunk": "", "sequence_number": 0, "is_last": True, "error": "GPU out of memory"}
                yield json.dumps(error_chunk) + "\n"
            else:
                error_chunk = {"chunk": "", "sequence_number": 0, "is_last": True, "error": str(e)}
                yield json.dumps(error_chunk) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

LANGUAGE_LIST = [
    {"code": code, "name": name, "native": code in {"zh", "en", "ja", "ko", "de", "fr", "ru", "pt", "es", "it"}}
    for code, name in LANGUAGE_DISPLAY_NAMES.items()
]

SPEAKER_LIST = [{"name": s.value} for s in SpeakerName]


@app.get("/languages")
async def get_languages() -> dict:
    return {"languages": LANGUAGE_LIST}


@app.get("/speakers")
async def get_speakers() -> dict:
    return {"speakers": SPEAKER_LIST}


# ---------------------------------------------------------------------------
# Voice library
# ---------------------------------------------------------------------------

@app.post("/voices", response_model=VoiceEntryResponse, status_code=201)
async def add_voice(request: AddVoiceRequest) -> VoiceEntryResponse:
    """Register a cloned voice in the library from a reference audio sample."""
    try:
        # Validate the audio sample before storing
        tmp_path, _ = qwen3_service.validate_audio_sample(request.ref_audio)
        import os; os.unlink(tmp_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    entry = voice_library.add_voice(
        name=request.name,
        ref_audio_b64=request.ref_audio,
        description=request.description,
        ref_text=request.ref_text,
        language_hint=request.language_hint.value,
    )
    return VoiceEntryResponse(
        id=entry.id,
        name=entry.name,
        description=entry.description,
        ref_text=entry.ref_text,
        created_at=entry.created_at,
        language_hint=entry.language_hint,
    )


@app.get("/voices", response_model=list[VoiceEntryResponse])
async def list_voices() -> list[VoiceEntryResponse]:
    """List all voices in the library."""
    return [
        VoiceEntryResponse(
            id=v.id,
            name=v.name,
            description=v.description,
            ref_text=v.ref_text,
            created_at=v.created_at,
            language_hint=v.language_hint,
        )
        for v in voice_library.list_voices()
    ]


@app.get("/voices/{voice_id}", response_model=VoiceEntryResponse)
async def get_voice(voice_id: str) -> VoiceEntryResponse:
    entry = voice_library.get_voice(voice_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Voice not found")
    return VoiceEntryResponse(
        id=entry.id,
        name=entry.name,
        description=entry.description,
        ref_text=entry.ref_text,
        created_at=entry.created_at,
        language_hint=entry.language_hint,
    )


@app.patch("/voices/{voice_id}", response_model=VoiceEntryResponse)
async def update_voice(voice_id: str, request: UpdateVoiceRequest) -> VoiceEntryResponse:
    entry = voice_library.update_voice(voice_id, name=request.name, description=request.description)
    if not entry:
        raise HTTPException(status_code=404, detail="Voice not found")
    return VoiceEntryResponse(
        id=entry.id,
        name=entry.name,
        description=entry.description,
        ref_text=entry.ref_text,
        created_at=entry.created_at,
        language_hint=entry.language_hint,
    )


@app.delete("/voices/{voice_id}", status_code=204)
async def delete_voice(voice_id: str) -> None:
    if not voice_library.delete_voice(voice_id):
        raise HTTPException(status_code=404, detail="Voice not found")


@app.post("/voices/{voice_id}/synthesize", response_model=SynthesizeResponse)
async def synthesize_with_voice(voice_id: str, request: SynthesizeRequest) -> SynthesizeResponse:
    """Synthesize text using a specific library voice (voice cloning)."""
    try:
        return await qwen3_service.synthesize_with_library_voice(
            text=request.text,
            voice_id=voice_id,
            language=request.language.value,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Translation + synthesis
# ---------------------------------------------------------------------------

@app.post("/translate-synthesize", response_model=TranslateSynthesizeResponse)
async def translate_and_synthesize(request: TranslateSynthesizeRequest) -> TranslateSynthesizeResponse:
    """Translate text from source_language to target_language, then synthesize audio.

    Supports all 13 languages including Urdu, Arabic, and Hindi.
    Extended languages are translated to English before synthesis.
    Set voice_id to use a library voice for cloning instead of a preset speaker.
    """
    try:
        return await qwen3_service.translate_and_synthesize(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Audio-to-audio
# ---------------------------------------------------------------------------

@app.post("/audio-to-audio", response_model=TranslateSynthesizeResponse)
async def audio_to_audio(request: AudioToAudioRequest) -> TranslateSynthesizeResponse:
    """Transcribe input audio → translate to target language → synthesize audio output.

    Pipeline: base64 audio → Whisper ASR (auto-detects language) → translation → TTS.
    Set voice_id to synthesize using a library voice instead of a preset speaker.
    """
    try:
        return await qwen3_service.audio_to_audio(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Clone audio-to-audio (no translation)
# ---------------------------------------------------------------------------

@app.post("/clone/audio-to-audio", response_model=CloneAudioToAudioResponse)
async def clone_audio_to_audio(request: CloneAudioToAudioRequest) -> CloneAudioToAudioResponse:
    """Transcribe input audio and re-synthesize in the same language using a cloned voice.

    No translation is applied — the output preserves the original language while
    replacing the speaker voice. Provide either:
    - voice_id: use a saved library voice
    - speaker_audio: inline base64 reference audio for one-shot cloning
    """
    try:
        return await qwen3_service.clone_audio_to_audio(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/voices/{voice_id}/audio-to-audio", response_model=CloneAudioToAudioResponse)
async def voice_audio_to_audio(voice_id: str, request: CloneAudioToAudioRequest) -> CloneAudioToAudioResponse:
    """Shorthand: transcribe input audio and re-synthesize using a specific library voice.

    Equivalent to POST /clone/audio-to-audio with voice_id set, but voice_id
    comes from the URL path instead of the request body.
    """
    patched = request.model_copy(update={"voice_id": voice_id})
    try:
        return await qwen3_service.clone_audio_to_audio(patched)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host=Config.HOST, port=Config.PORT, reload=False)
