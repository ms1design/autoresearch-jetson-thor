#!/bin/bash

# scripts/build.sh - Build Docker training image
# Usage: ./scripts/build.sh
#
# This script builds the training Docker image using docker compose.
# The uv.lock file is regenerated during the Docker build (in Dockerfile)
# to ensure correct Linux aarch64 platform markers for Jetson AGX Thor.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Read environment variables
export HF_TOKEN=${HF_TOKEN:-}

docker stop train || true
docker rm train || true

# Build image if needed
echo "Building training Docker image..."
docker compose build train 2>&1 | tee ./logs/build.log
