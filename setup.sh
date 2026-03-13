#!/usr/bin/env bash
# setup.sh — one-shot install for autoresearch on Jetson AGX Thor (SM_110, cu130)
#
# Platform: Jetson AGX Thor, JetPack 7.x, L4T r38.x, CUDA 13.0, Ubuntu 24.04 SBSA.

set -euo pipefail

PYTHON=${PYTHON:-python3.12}

# Check if .venv already exists (e.g., from Docker build) and skip venv creation
if [ ! -d .venv ]; then
    echo "==> Creating uv virtual environment (.venv, ${PYTHON})..."
    uv venv --python "$PYTHON"
else
    echo "==> Virtual environment already exists, skipping creation..."
fi

echo "==> Syncing dependencies (torch==2.10.0 from NVIDIA sbsa/cu130)..."
# pyproject.toml routes torch to nvidia-sbsa-cu130 via [tool.uv.sources].
uv sync