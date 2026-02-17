#!/usr/bin/env python3
"""Qwen3-TTS Service — FastAPI application with routes for synthesis, cloning, and streaming."""

import asyncio
import json
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn

from config import Config
from models import (
    CloneRequest,
    HealthResponse,
    LanguageCode,
    SpeakerName,
    SynthesizeRequest,
    SynthesizeResponse,
)
from service import Qwen3TTSService, DEVICE, PLATFORM

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
    logger.info("Starting Qwen3-TTS service...")
    asyncio.create_task(qwen3_service.initialize_models())


# ---------------------------------------------------------------------------
# Health & readiness
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    gpu_info = Qwen3TTSService.get_gpu_info()
    return HealthResponse(
        status="healthy" if qwen3_service.custom_voice_model_loaded else "initializing",
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
    raise HTTPException(status_code=503, detail="Models not loaded yet")


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
    {"code": lang.value, "name": name}
    for lang, name in zip(
        LanguageCode,
        [
            "Chinese", "English", "Japanese", "Korean", "German",
            "French", "Russian", "Portuguese", "Spanish", "Italian",
        ],
    )
]

SPEAKER_LIST = [{"name": s.value} for s in SpeakerName]


@app.get("/languages")
async def get_languages() -> dict:
    return {"languages": LANGUAGE_LIST}


@app.get("/speakers")
async def get_speakers() -> dict:
    return {"speakers": SPEAKER_LIST}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host=Config.HOST, port=Config.PORT, reload=False)
