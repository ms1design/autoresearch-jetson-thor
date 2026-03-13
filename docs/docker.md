# Docker Setup for autoresearch-jetson-thor

This directory contains the Docker configuration for running both vLLM inference and training workloads.

## Prerequisites

- Docker and Docker Compose installed
- NVIDIA Container Toolkit configured
- `HF_TOKEN` environment variable set (optional, for HuggingFace access)

## Quick Start

### Build the Training Image

```bash
docker compose build train
```

This builds the training Docker image with all dependencies synced.

### Start Services

**Start only vLLM inference:**
```bash
docker compose up -d vllm
```

**Start only training (using direct docker run):**
```bash
./scripts/train.sh                # Runs train.py
./scripts/train.sh prepare.py     # Runs prepare.py
```

**Start both services:**
```bash
docker compose up -d
```

### Stop Services

```bash
docker compose down
```

### View Logs

```bash
docker compose logs -f
docker compose logs -f train    # View only training logs
docker compose logs -f vllm     # View only vLLM logs
```

**Note**: The `scripts/train.sh` script uses `docker run` directly for simpler management and faster iteration.

## Docker Compose Commands

### Build
```bash
docker compose build train
docker compose build --no-cache train  # Force rebuild
```

### Start vLLM
```bash
docker compose up -d vllm
```

### Start Training
```bash
docker compose up -d train
docker compose up train           # Run in foreground
```

### View Logs
```bash
docker compose logs -f
docker compose logs -f train      # Train container only
docker compose logs -f vllm       # vLLM container only
```

### Stop Services
```bash
docker compose down               # Stop all services
docker compose down vllm          # Stop only vLLM
docker compose down train         # Stop only training
```

### Rebuild and Start
```bash
docker compose up -d --build      # Rebuild and start all
docker compose up -d --build vllm # Rebuild and start vLLM only
```

## Environment Variables

### vLLM
- `VLLM_PORT` - Port for vLLM API (default: 8000)
- `HF_TOKEN` - HuggingFace access token
- `LLM_MODEL` - Model to serve (default: Qwen/Qwen3-Coder-Next)

### Training
- `TRAIN_COMMAND` - Command to run in container (default: train.py)
- `HF_TOKEN` - HuggingFace access token

## Directory Structure

```
scripts/
├── train.sh      — Launch training container directly with docker run
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

## Notes

- The training container uses `uv sync --frozen` at build time to ensure reproducible environments
- Cache directories are mounted for persistent storage across container restarts
- The entrypoint drops caches on each start for optimal performance
- GPU access is enabled via `runtime: nvidia` and `deploy.resources.reservations.devices`
