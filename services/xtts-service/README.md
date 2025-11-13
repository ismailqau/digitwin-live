# XTTS-v2 Service

A Docker-based XTTS-v2 text-to-speech service that supports multiple platforms:

- 🍎 **Mac M1/M2/M3** - MPS acceleration + ARM64 optimization
- 🪟 **Windows** - CPU inference with WSL2 support
- 🪟 **Windows + NVIDIA GPU** - CUDA acceleration
- 🐧 **Linux + NVIDIA GPU** - CUDA acceleration
- 🐧 **Linux CPU** - Optimized CPU inference

## 🚀 Quick Start

### Setup

```bash
# Universal setup - automatically detects and optimizes for your platform
./setup.sh
```

**What it does:**

- 🔍 Detects your platform (Mac M1, Windows, Linux)
- 🚀 Finds NVIDIA GPU if available
- 🏗️ Builds optimized Docker container
- ⚡ Configures best performance settings
- 🧪 Tests functionality automatically

### Manual Setup Options

```bash
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
# Test the service
./test.sh

# Quick manual test
curl http://localhost:8000/health
```

## API Endpoints

### Health Check

```
GET /health
```

### Text-to-Speech Synthesis

```
POST /synthesize
{
  "text": "Text to synthesize",
  "language": "en",
  "speaker_wav": "base64_encoded_audio", // Optional for voice cloning
  "speed": 1.0
}
```

### Voice Cloning

```
POST /synthesize
{
  "text": "Text to synthesize with cloned voice",
  "language": "en",
  "speaker_wav": "base64_encoded_reference_audio"
}
```

### Supported Languages

```
GET /languages
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

## Configuration

Environment variables:

```bash
# Model configuration
XTTS_MODEL_NAME=tts_models/multilingual/multi-dataset/xtts_v2
XTTS_MAX_TEXT_LENGTH=500

# Server configuration
PORT=8000
HOST=0.0.0.0

# GPU configuration (Linux only)
XTTS_GPU_ENABLED=true
```

## Integration with TTS Service

This XTTS service integrates with your existing TTS service. Update your TTS service configuration:

```typescript
// In your .env file
XTTS_SERVICE_URL=http://localhost:8000
XTTS_GPU_ENABLED=true
```

The existing `XTTSProvider.ts` will automatically connect to this service.

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
- **Docker**: Uses `--platform=linux/arm64` for native performance

### 🚀 NVIDIA GPU (Linux)

- **Device**: CUDA
- **Performance**: ~10-20x faster than CPU
- **Memory**: Requires 4-8GB VRAM depending on model

### 💻 CPU (All platforms)

- **Device**: CPU
- **Performance**: Reliable baseline performance
- **Memory**: Uses system RAM (4-8GB recommended)

## Troubleshooting

### Apple Silicon Issues

```bash
# If you get MPS errors, disable MPS and use CPU
docker run -e PYTORCH_ENABLE_MPS_FALLBACK=1 ...
```

### Windows Issues

```bash
# Make sure Docker Desktop is running with WSL2 backend
# Enable virtualization in BIOS if needed
```

### GPU Issues (Linux)

```bash
# Check NVIDIA drivers
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:11.8-base-ubuntu22.04 nvidia-smi
```

### Memory Issues

```bash
# Reduce model size or use CPU if running out of memory
# Monitor with:
docker stats xtts-cpu
```

## Development

### Local Development

```bash
# Install dependencies locally
pip install -r requirements.cpu.txt

# Run directly
python main.py

# Or with hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Testing

```bash
# Test different platforms
python test_xtts.py
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
gcloud run deploy xtts-service --source .
```

## Monitoring

The service provides metrics at:

- `/health` - Health status and device info
- `/metrics` - Prometheus metrics (if enabled)

## Voice Cloning

To use voice cloning:

1. Record a 10-30 second audio sample of the target voice
2. Convert to base64
3. Send in the `speaker_wav` field

```python
import base64

# Read audio file
with open("voice_sample.wav", "rb") as f:
    audio_b64 = base64.b64encode(f.read()).decode()

# Use in API call
response = requests.post("http://localhost:8000/synthesize", json={
    "text": "Hello, this is my cloned voice!",
    "language": "en",
    "speaker_wav": audio_b64
})
```

## License

This service uses XTTS-v2 which is licensed under Mozilla Public License 2.0.
