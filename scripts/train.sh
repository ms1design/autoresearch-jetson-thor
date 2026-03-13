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
# Run training and capture output to logs/run.log inside the container
# The output will be visible in .logs/run.log in the project directory
docker run \
  --name train \
  --hostname train \
  --init \
  --interactive \
  --runtime nvidia \
  --ipc host \
  --gpus all \
  --restart=no \
  --privileged \
  --user "0:0" \
  --env DO_NOT_TRACK=1 \
  --env NVIDIA_VISIBLE_DEVICES=all \
  --env NVIDIA_DRIVER_CAPABILITIES=compute,utility \
  --env CUDA_VISIBLE_DEVICES=0 \
  --env PYTHONUNBUFFERED=1 \
  --env HF_TOKEN="${HF_TOKEN}" \
  --volume "$(pwd):/workspace" \
  --volume /dev/shm:/dev/shm \
  --network host \
  narandill/autoresearch-jetson-thor:latest \
  sh -c 'uv run "${TRAIN_COMMAND:-train.py}" 2>&1 | tee /workspace/logs/run.log'
