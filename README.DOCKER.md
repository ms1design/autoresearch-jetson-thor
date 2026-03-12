# Docker Setup for autoresearch-jetson-thor

This directory contains the Docker configuration for running both vLLM inference and training workloads.

## Prerequisites

- Docker and Docker Compose installed
- NVIDIA Container Toolkit configured
- `HF_TOKEN` environment variable set (optional, for HuggingFace access)

## Quick Start

### Build the Training Image

```bash
./run.sh build
```

This builds the training Docker image with all dependencies synced.

### Start Services

**Start only vLLM inference:**
```bash
./run.sh vllm
```

**Start only training:**
```bash
./run.sh train                # Runs train.py
./run.sh train prepare.py     # Runs prepare.py
```

**Start both services:**
```bash
./run.sh both
```

### Stop Services

```bash
./run.sh stop
```

### Check Status

```bash
./run.sh ps
./run.sh logs
```

## Docker Compose Services

### vLLM Service
- Image: `nvcr.io/nvidia/vllm:26.02-py3`
- Runs on port `${VLLM_MAIN_SERVER_PORT:-8000}`
- Models: `Qwen/Qwen3-Coder-Next` (default)
- Quantized model: `RedHatAI/Qwen3-Coder-Next-NVFP4` (default)
- GPU: All available with CUDA 13.0

### Training Service
- Built from `Dockerfile` in this directory
- Mounts project directory to `/workspace`
- Environment is pre-synced at build time
- Runs with `uv run <command>` via entrypoint

## Environment Variables

### vLLM
- `VLLM_MAIN_SERVER_PORT` - Port for vLLM API (default: 8000)
- `HF_TOKEN` - HuggingFace access token
- `MAIN_LLM_MODEL` - Model to serve (default: Qwen/Qwen3-Coder-Next)
- `MAIN_LLM_MODEL_QUANT` - Quantized model path (default: RedHatAI/Qwen3-Coder-Next-NVFP4)

### Training
- `TRAIN_COMMAND` - Command to run in container (default: train.py)
- `HF_TOKEN` - HuggingFace access token

## Directory Structure

```
data/
├── models/         # Model storage
├── vllm/           # vLLM specific caches
│   ├── cache/      # vLLM cache
│   ├── tiktoken/   # Tokenizer cache
│   ├── kernels-cache/  # Tuned kernels cache
│   ├── flashinfer-cache/  # FlashInfer cache
│   └── triton-cache/     # Triton cache
└── training/       # Training specific
    └── cache/      # Training cache
```

## Running Commands Manually

### Build
```bash
docker compose -f docker-compose.yaml build train
```

### Start vLLM
```bash
docker compose -f docker-compose.yaml up -d vllm
```

### Start Training
```bash
docker compose -f docker-compose.yaml up -d train
```

### View Logs
```bash
docker compose -f docker-compose.yaml logs -f
```

## Notes

- The training container uses `uv sync --frozen` at build time to ensure reproducible environments
- Cache directories are mounted for persistent storage across container restarts
- The entrypoint drops caches on each start for optimal performance
- GPU access is enabled via `runtime: nvidia` and `deploy.resources.reservations.devices`
