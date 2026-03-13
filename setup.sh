#!/usr/bin/env bash
# setup.sh — one-shot install for autoresearch on Jetson AGX Thor (SM_110, cu130)
#
# Platform: Jetson AGX Thor, JetPack 7.x, L4T r38.x, CUDA 13.0, Ubuntu 24.04 SBSA.

set -euo pipefail

PYTHON=${PYTHON:-python3.12}

if [ ! -d .venv ]; then
    echo "==> Creating uv virtual environment (.venv, ${PYTHON})..."
    uv venv --python "$PYTHON"
else
    echo "==> Virtual environment already exists, skipping creation..."
fi

echo "==> Adding sudoers permissions for train-commands..."
echo "${USER} ALL=(ALL) NOPASSWD: /usr/bin/sysctl, /bin/sync" | sudo tee /etc/sudoers.d/train-commands

echo "==> Syncing dependencies..."
uv sync

echo "==> Sudoers updated. Please reload sudo with 'sudo systemctl reload sudo' or logout/login for changes to take effect."