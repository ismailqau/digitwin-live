#!/usr/bin/env python3
"""
XTTS-v2 Service - Cross-platform TTS service
Supports GPU (CUDA), Apple Silicon (MPS), and CPU inference
"""

import os
import asyncio
import logging
import platform
from typing import Optional, Dict, Any
import json
import base64
import time
import traceback

import torch
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from TTS.api import TTS
import soundfile as sf
import io
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Platform detection
PLATFORM = platform.system().lower()
IS_APPLE_SILICON = PLATFORM == "darwin" and platform.machine() == "arm64"

def get_device():
    """Determine the best device for inference"""
    if torch.cuda.is_available():
        return "cuda"
    elif IS_APPLE_SILICON and hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        # Check if MPS is actually working
        try:
            test_tensor = torch.tensor([1.0], device="mps")
            return "mps"  # Apple Metal Performance Shaders
        except Exception as e:
            logger.warning(f"MPS available but not working: {e}, falling back to CPU")
            return "cpu"
    else:
        return "cpu"

DEVICE = get_device()
logger.info(f"Platform: {PLATFORM}, Device: {DEVICE}")

# Configuration
class Config:
    MODEL_NAME = os.getenv("XTTS_MODEL_NAME", "tts_models/multilingual/multi-dataset/xtts_v2")
    MAX_TEXT_LENGTH = int(os.getenv("XTTS_MAX_TEXT_LENGTH", "500"))
    PORT = int(os.getenv("PORT", "8000"))
    HOST = os.getenv("HOST", "0.0.0.0")

# Pydantic models
class TTSRequest(BaseModel):
    text: str = Field(..., max_length=Config.MAX_TEXT_LENGTH)
    language: str = Field(default="en")
    speaker_wav: Optional[str] = Field(None, description="Base64 encoded speaker audio")
    speed: float = Field(default=1.0, ge=0.1, le=3.0)

class TTSResponse(BaseModel):
    audio_data: str
    sample_rate: int
    duration: float
    language: str
    device_used: str
    processing_time: float

class HealthResponse(BaseModel):
    status: str
    device: str
    platform: str
    model_loaded: bool
    gpu_available: bool
    mps_available: bool

# Global model
tts_model: Optional[TTS] = None
model_lock = asyncio.Lock()

class XTTSService:
    def __init__(self):
        self.model = None
        self.model_loaded = False
        
    async def initialize_model(self):
        global tts_model
        
        async with model_lock:
            if tts_model is not None:
                return tts_model
                
            try:
                logger.info(f"Initializing XTTS model on {DEVICE}")
                
                if DEVICE == "cuda":
                    tts_model = TTS(Config.MODEL_NAME, gpu=True)
                else:
                    tts_model = TTS(Config.MODEL_NAME, gpu=False)
                
                self.model = tts_model
                self.model_loaded = True
                logger.info("XTTS model initialized successfully")
                return tts_model
                
            except Exception as e:
                logger.error(f"Failed to initialize XTTS model: {e}")
                raise HTTPException(status_code=500, detail=f"Model initialization failed: {str(e)}")
    
    async def synthesize(self, request: TTSRequest) -> TTSResponse:
        start_time = time.time()
        
        if not self.model_loaded:
            await self.initialize_model()
        
        try:
            speaker_wav_path = None
            if request.speaker_wav:
                speaker_wav_path = await self._save_speaker_wav(request.speaker_wav)
            
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                output_path = tmp_file.name
            
            try:
                if speaker_wav_path:
                    self.model.tts_to_file(
                        text=request.text,
                        file_path=output_path,
                        speaker_wav=speaker_wav_path,
                        language=request.language
                    )
                else:
                    self.model.tts_to_file(
                        text=request.text,
                        file_path=output_path,
                        language=request.language
                    )
                
                audio_data, sample_rate = sf.read(output_path)
                audio_bytes = self._audio_to_bytes(audio_data, sample_rate)
                audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
                duration = len(audio_data) / sample_rate
                
                return TTSResponse(
                    audio_data=audio_b64,
                    sample_rate=sample_rate,
                    duration=duration,
                    language=request.language,
                    device_used=DEVICE,
                    processing_time=time.time() - start_time
                )
                
            finally:
                if os.path.exists(output_path):
                    os.unlink(output_path)
                if speaker_wav_path and os.path.exists(speaker_wav_path):
                    os.unlink(speaker_wav_path)
                    
        except Exception as e:
            logger.error(f"TTS synthesis failed: {e}")
            raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")
    
    async def _save_speaker_wav(self, audio_b64: str) -> str:
        try:
            audio_bytes = base64.b64decode(audio_b64)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_file.write(audio_bytes)
                return tmp_file.name
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid audio data: {str(e)}")
    
    def _audio_to_bytes(self, audio_data: np.ndarray, sample_rate: int) -> bytes:
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)
        
        audio_int16 = (audio_data * 32767).astype(np.int16)
        buffer = io.BytesIO()
        sf.write(buffer, audio_int16, sample_rate, format='WAV')
        return buffer.getvalue()

# Initialize service
xtts_service = XTTSService()

# FastAPI app
app = FastAPI(title="XTTS-v2 Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting XTTS-v2 service...")
    asyncio.create_task(xtts_service.initialize_model())

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy" if xtts_service.model_loaded else "initializing",
        device=DEVICE,
        platform=PLATFORM,
        model_loaded=xtts_service.model_loaded,
        gpu_available=torch.cuda.is_available(),
        mps_available=IS_APPLE_SILICON and hasattr(torch.backends, 'mps') and torch.backends.mps.is_available()
    )

@app.post("/synthesize", response_model=TTSResponse)
async def synthesize_speech(request: TTSRequest):
    return await xtts_service.synthesize(request)

@app.get("/languages")
async def get_supported_languages():
    return {
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "es", "name": "Spanish"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "it", "name": "Italian"},
            {"code": "pt", "name": "Portuguese"}
        ]
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host=Config.HOST, port=Config.PORT, reload=False)