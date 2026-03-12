#!/usr/bin/env bash
# setup.sh — one-shot install for autoresearch on Jetson AGX Thor (SM_110, cu130)
#
# Platform: Jetson AGX Thor, JetPack 7.x, L4T r38.x, CUDA 13.0, Ubuntu 24.04 SBSA.
#
# Usage:
#   bash setup.sh
#   source .venv/bin/activate
#   python prepare.py    # one-time: download data + train tokenizer (~2 min)
#   python train.py      # 5-minute pretraining experiment
set -euo pipefail

PYTHON=${PYTHON:-python3.12}

# ---------------------------------------------------------------------------
# Wheel index for Jetson AGX Thor
# ---------------------------------------------------------------------------
# Primary: NVIDIA Jetson AI Lab sbsa/cu130 index (NVPL BLAS, nvshmem-tuned).
#   torch==2.10.0  — latest available as of March 2026
#   triton==3.5.0  — used by torch.compile / flex_attention
#   NOTE: The sbsa/cu129 index in the jetson-containers README is for
#         GH200/GB200 (CUDA 12.9). Thor uses CUDA 13.0 → sbsa/cu130.
NVIDIA_INDEX="https://pypi.jetson-ai-lab.io/sbsa/cu130/+simple/"

# Fallback: Official PyTorch cu130 stable index.
#   torch==2.9.1  — latest stable as of March 2026
#   (torch-2.10.0 not yet in the official stable cu130 channel)
# TORCH_OFFICIAL_INDEX="https://download.pytorch.org/whl/cu130"

echo "==> Creating uv virtual environment (.venv, ${PYTHON})..."
uv venv --python "$PYTHON"

echo "==> Syncing dependencies (torch==2.10.0 from NVIDIA sbsa/cu130)..."
# pyproject.toml routes torch to nvidia-sbsa-cu130 via [tool.uv.sources].
uv sync

echo ""
echo "==> Setup complete."
echo ""
echo "    Activate the environment:"
echo "        source .venv/bin/activate"
echo ""
echo "    Then run:"
echo "        python prepare.py     # one-time: download data + train BPE tokenizer"
echo "        python train.py       # 5-minute pretraining experiment"
echo ""
echo "    Optional — install flash-attn (not used by this project):"
echo "        # Available in sbsa/cu130: flash-attn==2.8.4"
echo "        pip install flash-attn \\"
echo "            --index-url https://pypi.jetson-ai-lab.io/sbsa/cu130/+simple/"
echo ""
echo "    Optional — install flashinfer (not used by this project):"
echo "        # sbsa/cu130: flashinfer-python==0.6.4, flashinfer-cubin==0.6.4"
echo "        pip install flashinfer-python flashinfer-cubin \\"
echo "            --index-url https://pypi.jetson-ai-lab.io/sbsa/cu130/+simple/"
echo "        pip install flashinfer-jit-cache \\"
echo "            --index-url https://flashinfer.ai/whl/cu130"
