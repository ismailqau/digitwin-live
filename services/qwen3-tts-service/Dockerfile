# Qwen3-TTS GPU Production Dockerfile
FROM nvidia/cuda:12.1.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=0

# Install system dependencies + Python 3.12
RUN apt-get update && apt-get install -y \
    software-properties-common \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y \
    python3.12 \
    python3.12-dev \
    python3.12-venv \
    git \
    wget \
    curl \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.12 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1

# Install pip for Python 3.12
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.12

WORKDIR /app

# Install base requirements first
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install PyTorch with CUDA first (flash-attn needs torch at build time)
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cu121 \
    torch==2.5.1+cu121 torchaudio==2.5.1+cu121

# Install build deps for flash-attn (ninja speeds up compilation significantly)
RUN pip install --no-cache-dir ninja packaging setuptools wheel

# Install GPU-specific packages that depend on torch
# flash-attn needs --no-build-isolation to see the installed torch during build
# MAX_JOBS=4 limits parallel compilation to avoid OOM on Cloud Build
ENV MAX_JOBS=4
RUN pip install --no-cache-dir --no-build-isolation flash-attn==2.7.3
RUN pip install --no-cache-dir vllm==0.6.6 nvidia-ml-py3==7.352.0

# Copy application code
COPY config.py models.py service.py main.py gcs_loader.py ./

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

# Create directories for models and logs
RUN mkdir -p /app/models /app/logs

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["./start.sh"]
