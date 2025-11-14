# XTTS Service

The XTTS Service is a self-hosted Docker-based XTTS-v2 text-to-speech service that provides high-quality voice synthesis with voice cloning capabilities. It automatically adapts to different platforms (Mac M1/M2/M3, Windows, Linux) and hardware configurations (GPU/CPU).

## Features

- 🍎 **Mac Apple Silicon** - MPS acceleration + ARM64 optimization
- 🪟 **Windows** - CPU inference with WSL2 support
- 🪟 **Windows + NVIDIA GPU** - CUDA acceleration
- 🐧 **Linux + NVIDIA GPU** - CUDA acceleration
- 🐧 **Linux CPU** - Optimized CPU inference
- 🎤 **Voice Cloning** - Custom voice synthesis from audio samples
- 🌍 **Multi-language** - Support for 16+ languages
- 🚀 **Auto-optimization** - Platform detection and performance tuning

## Quick Start

### Automated Setup (Recommended)

```bash
cd services/xtts-service
./setup.sh
```

This script will:

- 🔍 Detect your platform (Mac M1, Windows, Linux)
- 🚀 Find NVIDIA GPU if available
- 🏗️ Build optimized Docker container
- ⚡ Configure best performance settings
- 🧪 Test functionality automatically

### Manual Setup

```bash
cd services/xtts-service

# Mac M1/M2/M3 with MPS optimization
docker-compose --profile m1 up --build

# Windows or Linux CPU
docker-compose --profile cpu up --build

# Linux/Windows with NVIDIA GPU
docker-compose --profile gpu up --build

# Development with hot reload
docker-compose --profile dev up --build
```

### Test Your Setup

```bash
cd services/xtts-service
./test.sh

# Quick manual test
curl http://localhost:8000/health
```

## API Endpoints

### Health Check

```http
GET http://localhost:8000/health

Response:
{
  "status": "healthy",
  "device": "cuda|mps|cpu",
  "platform": "linux|darwin|win32",
  "model_loaded": true,
  "gpu_available": true,
  "mps_available": false
}
```

### Text-to-Speech Synthesis

```http
POST http://localhost:8000/synthesize
Content-Type: application/json

{
  "text": "Text to synthesize",
  "language": "en",
  "speaker_wav": "base64_encoded_audio", // Optional for voice cloning
  "speed": 1.0
}

Response:
{
  "audio_data": "base64_encoded_wav",
  "sample_rate": 24000,
  "duration": 2.5,
  "processing_time": 0.8,
  "device_used": "cuda"
}
```

### Voice Cloning

```http
POST http://localhost:8000/synthesize
Content-Type: application/json

{
  "text": "Text to synthesize with cloned voice",
  "language": "en",
  "speaker_wav": "base64_encoded_reference_audio"
}
```

### Supported Languages

```http
GET http://localhost:8000/languages

Response:
{
  "languages": [
    {"code": "en", "name": "English"},
    {"code": "es", "name": "Spanish"},
    {"code": "fr", "name": "French"},
    // ... more languages
  ]
}
```

## Supported Languages

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Polish (pl)
- Turkish (tr)
- Russian (ru)
- Dutch (nl)
- Czech (cs)
- Arabic (ar)
- Chinese Simplified (zh-cn)
- Japanese (ja)
- Hungarian (hu)
- Korean (ko)

## Performance

### 🍎 Apple Silicon (M1/M2/M3) - OPTIMIZED

- **Device**: MPS (Metal Performance Shaders) with CPU fallback
- **Performance**: ~3-8x faster than Intel Macs, ~2x faster than standard CPU
- **Memory**: Efficient unified memory usage (8-16GB recommended)
- **Optimizations**:
  - ARM64 native compilation
  - MPS acceleration for neural networks
  - Optimized BLAS/LAPACK libraries
  - Enhanced memory management

### 🚀 NVIDIA GPU (Linux/Windows)

- **Device**: CUDA
- **Performance**: ~10-20x faster than CPU
- **Memory**: Requires 4-8GB VRAM depending on model

### 💻 CPU (All platforms)

- **Device**: CPU
- **Performance**: Reliable baseline performance
- **Memory**: Uses system RAM (4-8GB recommended)

## Configuration

### Environment Variables

```bash
# XTTS Service Configuration
XTTS_SERVICE_URL=http://localhost:8000
XTTS_GPU_ENABLED=true
XTTS_MODEL_NAME=tts_models/multilingual/multi-dataset/xtts_v2
XTTS_MAX_TEXT_LENGTH=500

# Docker Configuration
PORT=8000
HOST=0.0.0.0
PYTORCH_ENABLE_MPS_FALLBACK=1  # For Apple Silicon
OMP_NUM_THREADS=8              # For CPU optimization
```

### Docker Profiles

- **`gpu`** - NVIDIA GPU acceleration (Linux/Windows)
- **`cpu`** - CPU-only inference (Windows/Linux)
- **`m1`** - Apple Silicon optimization (Mac M1/M2/M3)
- **`dev`** - Development with hot reload

## Integration with TTS Service

The XTTS service integrates seamlessly with the main TTS service:

### Configuration

Update your `.env` file:

```bash
XTTS_SERVICE_URL=http://localhost:8000
XTTS_GPU_ENABLED=true
```

### Usage in TTS Service

The TTS service automatically uses the XTTS service when:

- XTTS-v2 provider is selected
- Voice cloning is requested
- Custom voice models are used

```typescript
// The TTS service will automatically route to XTTS service
const response = await ttsService.synthesize({
  text: 'Hello, this is my cloned voice!',
  provider: TTSProvider.XTTS_V2,
  voiceModelId: 'user-voice-123',
});
```

## Voice Cloning

To use voice cloning:

1. **Record a voice sample** (10-30 seconds of clear speech)
2. **Convert to base64**
3. **Send in the `speaker_wav` field**

```javascript
// Example: Voice cloning with reference audio
const fs = require('fs');

// Read audio file
const audioBuffer = fs.readFileSync('voice_sample.wav');
const audioBase64 = audioBuffer.toString('base64');

// Use in API call
const response = await fetch('http://localhost:8000/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello, this is my cloned voice!',
    language: 'en',
    speaker_wav: audioBase64,
  }),
});
```

## Troubleshooting

### Apple Silicon Issues

```bash
# If you get MPS errors, disable MPS and use CPU
docker run -e PYTORCH_ENABLE_MPS_FALLBACK=1 ...

# Check Docker platform
docker info | grep Architecture
```

### Windows Issues

```bash
# Make sure Docker Desktop is running with WSL2 backend
# Enable virtualization in BIOS if needed
# Check WSL2 integration in Docker Desktop settings
```

### GPU Issues (Linux/Windows)

```bash
# Check NVIDIA drivers
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:11.8-base-ubuntu22.04 nvidia-smi

# Check container GPU access
docker exec -it xtts-gpu nvidia-smi
```

### Memory Issues

```bash
# Monitor container memory usage
docker stats xtts-cpu

# Reduce model size or use CPU if running out of memory
# Allocate more memory to Docker Desktop (Mac/Windows)
```

### Service Not Starting

```bash
# Check container logs
docker logs xtts-cpu

# Check if port is available
lsof -i :8000

# Restart the service
docker-compose --profile cpu restart
```

### Poor Audio Quality

```bash
# Check model loading
curl http://localhost:8000/health

# Try different voice samples
# Ensure reference audio is high quality (16kHz+, clear speech)
# Use longer reference samples (20-30 seconds)
```

## Development

### Local Development

```bash
# Install dependencies locally (optional)
cd services/xtts-service
pip install -r requirements.txt

# Run directly (without Docker)
python main.py

# Or with hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Testing

```bash
# Run comprehensive tests
./test.sh

# Test specific functionality
python test_xtts.py
```

### File Structure

```
services/xtts-service/
├── main.py                 # FastAPI application
├── requirements.txt        # Base requirements
├── requirements.cpu.txt    # CPU-specific requirements
├── requirements.gpu.txt    # GPU-specific requirements
├── Dockerfile             # GPU Docker image
├── Dockerfile.cpu         # CPU Docker image
├── Dockerfile.m1          # Apple Silicon Docker image
├── docker-compose.yml     # Multi-profile Docker Compose
├── setup.sh              # Universal setup script
├── test.sh               # Test script
├── README.md             # Service documentation
├── models/               # Model cache directory
├── cache/                # Audio cache directory
└── logs/                 # Service logs
```

## Monitoring

### Health Monitoring

```bash
# Check service health
curl http://localhost:8000/health

# Monitor container stats
docker stats xtts-cpu

# View service logs
docker logs -f xtts-cpu
```

### Performance Monitoring

```bash
# Monitor GPU usage (if available)
nvidia-smi -l 1

# Monitor CPU usage
htop

# Monitor memory usage
free -h
```

## Production Deployment

### Docker Swarm

```bash
docker stack deploy -c docker-compose.yml xtts
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

### Cloud Run (GCP)

```bash
gcloud run deploy xtts-service --source . --platform managed
```

## Related Documentation

- **[Multi-Provider TTS](./TTS-MULTI-PROVIDER.md)** - TTS service integration
- **[Voice Model Training](./VOICE-MODEL-TRAINING.md)** - Voice model creation
- **[TTS Optimization & Caching](./TTS-OPTIMIZATION-CACHING.md)** - Performance optimization
- **[Audio Processing](./AUDIO-PROCESSING.md)** - Audio handling
- **[Docker Documentation](https://docs.docker.com/)** - Docker reference

## License

This service uses XTTS-v2 which is licensed under Mozilla Public License 2.0.
