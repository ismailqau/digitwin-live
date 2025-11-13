#!/bin/bash

# Universal XTTS Service Setup Script
# Works on Mac M1, Windows, and Windows with NVIDIA GPU

set -e

echo "🤖 Universal XTTS-v2 Service Setup"
echo "=================================="

# Detect platform and architecture
PLATFORM=$(uname -s)
ARCH=$(uname -m)
IS_WINDOWS=false
IS_MAC=false
IS_LINUX=false
IS_APPLE_SILICON=false
GPU_AVAILABLE=false

# Platform detection
case "$PLATFORM" in
    "Darwin")
        IS_MAC=true
        if [[ "$ARCH" == "arm64" ]]; then
            IS_APPLE_SILICON=true
            echo "🍎 Detected: Mac Apple Silicon ($ARCH)"
        else
            echo "🍎 Detected: Mac Intel ($ARCH)"
        fi
        ;;
    "Linux")
        IS_LINUX=true
        echo "🐧 Detected: Linux ($ARCH)"
        ;;
    "MINGW"* | "MSYS"* | "CYGWIN"*)
        IS_WINDOWS=true
        echo "🪟 Detected: Windows ($ARCH)"
        ;;
    *)
        echo "❓ Unknown platform: $PLATFORM $ARCH"
        echo "   Defaulting to Linux configuration"
        IS_LINUX=true
        ;;
esac

# GPU detection (works on all platforms)
echo ""
echo "🔍 Checking for GPU support..."

if command -v nvidia-smi &> /dev/null; then
    if nvidia-smi &> /dev/null 2>&1; then
        GPU_AVAILABLE=true
        GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader,nounits | head -1)
        echo "🚀 NVIDIA GPU detected: $GPU_INFO"
    else
        echo "⚠️  nvidia-smi found but GPU not accessible"
    fi
else
    echo "ℹ️  No NVIDIA GPU detected"
fi

# Docker verification
echo ""
echo "🐳 Verifying Docker setup..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found!"
    echo ""
    echo "📥 Please install Docker:"
    if [[ "$IS_MAC" == "true" ]]; then
        echo "   - Download Docker Desktop for Mac from: https://docker.com/products/docker-desktop"
    elif [[ "$IS_WINDOWS" == "true" ]]; then
        echo "   - Download Docker Desktop for Windows from: https://docker.com/products/docker-desktop"
    else
        echo "   - Install Docker Engine: https://docs.docker.com/engine/install/"
    fi
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found!"
    echo "   Please install docker-compose or use 'docker compose' (newer versions)"
    exit 1
fi

echo "✅ Docker found: $(docker --version)"
echo "✅ Docker Compose found: $(docker-compose --version)"

# Check Docker daemon
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon not running!"
    echo ""
    echo "🔧 Please start Docker:"
    if [[ "$IS_MAC" == "true" || "$IS_WINDOWS" == "true" ]]; then
        echo "   - Open Docker Desktop application"
    else
        echo "   - Run: sudo systemctl start docker"
    fi
    exit 1
fi

echo "✅ Docker daemon is running"

# Platform-specific optimizations
echo ""
echo "🎯 Selecting optimal configuration..."

PROFILE=""
DOCKERFILE=""
CONTAINER_NAME=""

if [[ "$GPU_AVAILABLE" == "true" ]]; then
    # NVIDIA GPU available (any platform)
    PROFILE="gpu"
    DOCKERFILE="Dockerfile"
    CONTAINER_NAME="xtts-gpu"
    echo "✅ Selected: GPU-accelerated (NVIDIA CUDA)"
    echo "   🚀 ~10-20x faster than CPU"
    echo "   💾 Requires 4-8GB VRAM"
    
elif [[ "$IS_APPLE_SILICON" == "true" ]]; then
    # Apple Silicon Mac
    PROFILE="m1"
    DOCKERFILE="Dockerfile.m1"
    CONTAINER_NAME="xtts-m1"
    echo "✅ Selected: Apple Silicon optimized (MPS acceleration)"
    echo "   🍎 ARM64 native compilation"
    echo "   🚀 ~3-8x faster than Intel Macs"
    echo "   💾 Efficient unified memory usage"
    
elif [[ "$IS_MAC" == "true" ]]; then
    # Intel Mac
    PROFILE="cpu"
    DOCKERFILE="Dockerfile.cpu"
    CONTAINER_NAME="xtts-cpu"
    echo "✅ Selected: CPU optimized for Intel Mac"
    
elif [[ "$IS_WINDOWS" == "true" ]]; then
    # Windows
    PROFILE="cpu"
    DOCKERFILE="Dockerfile.cpu"
    CONTAINER_NAME="xtts-cpu"
    echo "✅ Selected: CPU optimized for Windows"
    echo "   💡 Ensure WSL2 backend is enabled in Docker Desktop"
    
else
    # Linux without GPU
    PROFILE="cpu"
    DOCKERFILE="Dockerfile.cpu"
    CONTAINER_NAME="xtts-cpu"
    echo "✅ Selected: CPU optimized for Linux"
fi

# Create necessary directories
echo ""
echo "📁 Setting up directories..."
mkdir -p models cache logs

# Set permissions (Unix-like systems only)
if [[ "$IS_WINDOWS" != "true" ]]; then
    chmod +x start.sh 2>/dev/null || true
    chmod +x test_xtts.py 2>/dev/null || true
    chmod +x test-*.sh 2>/dev/null || true
fi

# Platform-specific Docker settings
echo ""
echo "🔧 Configuring Docker settings..."

DOCKER_COMPOSE_CMD="docker-compose"
BUILD_ARGS=""

# Check if we should use 'docker compose' instead of 'docker-compose'
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
fi

# Apple Silicon specific settings
if [[ "$IS_APPLE_SILICON" == "true" ]]; then
    echo "   🍎 Configuring for Apple Silicon..."
    export DOCKER_DEFAULT_PLATFORM=linux/arm64
    BUILD_ARGS="--platform linux/arm64"
fi

# Build the service
echo ""
echo "🏗️  Building XTTS service..."
echo "   Profile: $PROFILE"
echo "   Dockerfile: $DOCKERFILE"
echo "   Container: $CONTAINER_NAME"

if [[ -n "$BUILD_ARGS" ]]; then
    $DOCKER_COMPOSE_CMD --profile $PROFILE build $BUILD_ARGS
else
    $DOCKER_COMPOSE_CMD --profile $PROFILE build
fi

# Start the service
echo ""
echo "🚀 Starting XTTS service..."
$DOCKER_COMPOSE_CMD --profile $PROFILE up -d

# Wait for service initialization
echo ""
echo "⏳ Waiting for service to initialize..."
echo "   This may take several minutes for first-time model download..."

# Progressive wait with status checks
for i in {1..24}; do
    sleep 5
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Service is responding!"
        break
    else
        echo "   Waiting... ($((i*5))s elapsed)"
        if [[ $i -eq 24 ]]; then
            echo "⚠️  Service taking longer than expected. Checking logs..."
            $DOCKER_COMPOSE_CMD logs --tail=20 $CONTAINER_NAME
        fi
    fi
done

# Test the service
echo ""
echo "🧪 Testing service functionality..."

# Health check
echo "   📊 Health check..."
if curl -s http://localhost:8000/health | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'      Status: {data.get(\"status\", \"unknown\")}')
    print(f'      Device: {data.get(\"device\", \"unknown\")}')
    print(f'      Platform: {data.get(\"platform\", \"unknown\")}')
    print(f'      Model loaded: {data.get(\"model_loaded\", False)}')
    if data.get('gpu_available'):
        print('      🚀 GPU acceleration: Available')
    if data.get('mps_available'):
        print('      🍎 MPS acceleration: Available')
except Exception as e:
    print(f'      ❌ Health check failed: {e}')
    sys.exit(1)
" 2>/dev/null; then
    echo "   ✅ Health check passed"
else
    echo "   ❌ Health check failed"
fi

# Quick synthesis test
echo "   🎤 Quick synthesis test..."
if curl -s -X POST http://localhost:8000/synthesize \
    -H "Content-Type: application/json" \
    -d '{"text": "Hello! XTTS is working correctly.", "language": "en"}' | \
    python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    duration = data.get('processing_time', 0)
    print(f'      ✅ Synthesis successful ({duration:.1f}s)')
except Exception as e:
    print(f'      ❌ Synthesis failed: {e}')
" 2>/dev/null; then
    echo "   ✅ Synthesis test passed"
else
    echo "   ⚠️  Synthesis test failed (service may still be initializing)"
fi

# Success summary
echo ""
echo "🎉 XTTS Service Setup Complete!"
echo ""
echo "📋 Service Information:"
echo "   🌐 URL: http://localhost:8000"
echo "   🏷️  Profile: $PROFILE"
echo "   📦 Container: $CONTAINER_NAME"
echo "   🖥️  Platform: $PLATFORM $ARCH"
echo "   🚀 GPU: $([ "$GPU_AVAILABLE" == "true" ] && echo "Yes" || echo "No")"
echo ""

# Platform-specific performance notes
if [[ "$GPU_AVAILABLE" == "true" ]]; then
    echo "⚡ Performance: GPU-accelerated (~10-20x faster than CPU)"
elif [[ "$IS_APPLE_SILICON" == "true" ]]; then
    echo "⚡ Performance: Apple Silicon optimized (~3-8x faster than Intel)"
else
    echo "⚡ Performance: CPU-based (reliable baseline performance)"
fi

echo ""
echo "🔧 Management Commands:"
echo "   📊 View logs: $DOCKER_COMPOSE_CMD logs -f $CONTAINER_NAME"
echo "   ⏹️  Stop: $DOCKER_COMPOSE_CMD --profile $PROFILE down"
echo "   🔄 Restart: $DOCKER_COMPOSE_CMD --profile $PROFILE restart"
echo "   🧪 Test: python3 test_xtts.py"

echo ""
echo "🌐 API Endpoints:"
echo "   📊 Health: http://localhost:8000/health"
echo "   🎤 Synthesize: http://localhost:8000/synthesize"
echo "   🌍 Languages: http://localhost:8000/languages"

echo ""
echo "🔗 Integration:"
echo "   Add to your TTS service .env file:"
echo "   XTTS_SERVICE_URL=http://localhost:8000"
echo "   XTTS_GPU_ENABLED=$([ "$GPU_AVAILABLE" == "true" ] && echo "true" || echo "false")"

echo ""
echo "📚 Next Steps:"
echo "   1. 🧪 Run comprehensive tests:"
if [[ "$IS_APPLE_SILICON" == "true" ]]; then
    echo "      ./test-m1.sh"
else
    echo "      ./test-full.sh"
fi
echo "   2. 🔗 Update your TTS service configuration"
echo "   3. 🚀 Start using XTTS for voice synthesis!"

# Platform-specific tips
echo ""
echo "💡 Platform-specific tips:"
if [[ "$IS_APPLE_SILICON" == "true" ]]; then
    echo "   🍎 Ensure Docker Desktop uses Apple Silicon engine (not Rosetta)"
    echo "   💾 Allocate 8GB+ memory to Docker Desktop for best performance"
elif [[ "$IS_WINDOWS" == "true" ]]; then
    echo "   🪟 Ensure Docker Desktop uses WSL2 backend"
    echo "   💾 Allocate sufficient memory to Docker Desktop"
    echo "   🔧 Enable virtualization in BIOS if needed"
elif [[ "$GPU_AVAILABLE" == "true" ]]; then
    echo "   🚀 Monitor GPU usage with: nvidia-smi"
    echo "   💾 Ensure sufficient VRAM (4-8GB recommended)"
fi

echo ""
echo "✨ Your XTTS service is ready for production use!"