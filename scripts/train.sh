#!/bin/bash

# scripts/train.sh - Launch Docker training container directly using docker run
# Usage: ./scripts/train.sh [command]
#
# This script launches the training container directly with docker run
# instead of using docker compose, providing a simpler management approach.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Read environment variables
export HF_TOKEN=${HF_TOKEN:-}

# Build image if needed
echo "Building training Docker image if needed..."
docker compose build train

# Launch the training container using docker run directly
echo "Starting training container..."
docker run \
  --name train \
  --hostname train \
  --init false \
  --stdin-open \
  --tty \
  --ipc host \
  --runtime=nvidia \
  --restart=no \
  --privileged \
  --user "0:0" \
  --mem-swappiness=0 \
  --ulimit memlock=-1 \
  --ulimit stack=67108864 \
  --ulimit nofile=65536:65536 \
  --env DO_NOT_TRACK=1 \
  --env NVIDIA_VISIBLE_DEVICES=all \
  --env NVIDIA_DRIVER_CAPABILITIES=compute,utility \
  --env CUDA_VISIBLE_DEVICES=0 \
  --env PYTHONUNBUFFERED=1 \
  --env HF_TOKEN="${HF_TOKEN}" \
  --volume "$(pwd):/workspace" \
  --volume "../data/models:/data/models" \
  --volume "../data/training/cache:/data/cache" \
  --volume /dev/shm:/dev/shm \
  --volume /etc/nv_tegra_release:/etc/nv_tegra_release \
  --volume /etc/localtime:/etc/localtime:ro \
  --volume /etc/machine-id:/etc/machine-id:ro \
  --network host \
  narandill/autoresearch-jetson-thor:latest \
  uv run "${TRAIN_COMMAND:-train.py}"
