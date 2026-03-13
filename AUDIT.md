# Dependency & Runtime Audit — Jetson Thor SBSA (SM_110, JetPack 7.x)

Sources consulted:
- `pypi.jetson-ai-lab.io/sbsa/cu130` — live index, March 2026
- `pytorch.org/get-started/previous-versions` — official cu130 stable index
- `github.com/dusty-nv/jetson-containers` — config.py files, March 2026
- Upstream PyTorch release mailing list
- NVIDIA Developer Forums (Jetson Thor threads)

---

## Platform context

| Property | Value |
|---|---|
| Hardware | Jetson Thor 128 GB (T5000 module) |
| SM generation | SM_110 |
| JetPack | 7.x |
| L4T | r38.x |
| CUDA | 13.0 (cu130) |
| Python | 3.12 (system default) |
| Ubuntu | 24.04 (SBSA aarch64) |
| Unified memory | 128 GB LPDDR5X shared CPU/GPU |

---

## jetson-containers `sbsa/cu130` index — full package list (March 2026)

Live URL: `https://pypi.jetson-ai-lab.io/sbsa/cu130/`

| Package | Version | Wheel |
|---|---|
| torch | **2.10.0** | `torch-2.10.0-cp312-cp312-linux_aarch64.whl` |
| torchvision | 0.25.0 | `torchvision-0.25.0-cp312-cp312-linux_aarch64.whl` |
| torchaudio | 2.10.0 | `torchaudio-2.10.0-cp312-cp312-linux_aarch64.whl` |
| triton | **3.5.0** | `triton-3.5.0-cp312-cp312-linux_aarch64.whl` |
| torchao | 0.13.0 | abi3, linux_aarch64 |
| flash-attn | 2.8.4 | `flash_attn-2.8.4-cp312-cp312-linux_aarch64.whl` |
| flashinfer-python | 0.6.4 | pure-Python |
| flashinfer-cubin | 0.6.4 | pure-Python |
| flashinfer-jit-cache | 0.5.3 | abi3 |
| vllm | 0.16.0+cu130 | cp312 linux_aarch64 |
| xformers | 0.0.33.post1 | abi3 linux_aarch64 |
| bitsandbytes | 0.48.0 | cp312 linux_aarch64 |
| mamba-ssm | 2.2.6.post2 | cp312 linux_aarch64 |
| cupy-cuda13x | 13.6.0 | manylinux aarch64 |
| cuda-python | 13.0.1 | pure-Python |
| opencv-contrib-python-rolling | 4.13.0 | cp312 linux_aarch64 |

Everything not in the above list (numpy, pandas, pyarrow, matplotlib, requests,
tiktoken, rustbpe) inherits from `root/pypi` — a mirror of PyPI — and resolves
the standard manylinux / pure-Python wheels.

---

## Dependency audit

### torch

| | |
|---|---|
| **Pinned (this fork)** | `torch==2.10.0` |
| Source | `pypi.jetson-ai-lab.io/sbsa/cu130` |
| Build | NVPL BLAS + nvshmem, SM_110, cu130 |
| Official PyTorch stable cu130 | `torch==2.9.1` only (2.10.0 not yet released to stable) |
| Official PyTorch nightly cu130 | `torch==2.11.0.dev*+cu130` dev wheels available |

**Why `torch==2.10.0` not `2.9.1` or `2.11`:**
- `2.11` does not exist as a stable release (only nightly dev builds). Earlier in this fork it was listed as the target version — that was an error.
- `2.9.1` is the latest on the official `download.pytorch.org/whl/cu130` stable channel, but NVIDIA has already shipped `2.10.0` optimised for Jetson Thor in sbsa/cu130.
- `2.10.0` from sbsa/cu130 is Jetson-tuned and is the highest stable version available for this hardware.

### triton

| | |
|---|---|
| **Available in sbsa/cu130** | `triton==3.5.0` |
| Role | JIT kernel compiler for `torch.compile` + `flex_attention` |
| Installed by | `torch` wheel's own deps — not explicitly in pyproject.toml |
| SM_110 support | Confirmed; Triton JIT compiles ptx for SM_110 with cu130 ptxas |

Triton is pulled in as a dep of torch. The sbsa/cu130 index provides the Thor-tuned
`triton-3.5.0` wheel. No explicit pin needed in pyproject.toml.

### flash-attention

| | |
|---|---|
| **jetson-containers `config.py`** | `flash-attention:3.0.0` (Flash-Attention 4 target) |
| **Actual wheel in sbsa/cu130** | `flash-attn==2.8.4` |
| **Used by this project** | **No** |

The jetson-containers `config.py` references version `3.0.0` ("Flash-Attention 4 for
Jetson Thor") as a build target, but the wheel published in the sbsa/cu130 index is
`flash-attn==2.8.4`. The config.py version and the published wheel version diverge
because NVIDIA hasn't completed the FA4 build for Thor yet.

This project uses `torch.nn.attention.flex_attention` (Triton-based, always
available), not flash-attention. No action needed.

If you want to install flash-attn for other purposes:

```bash
pip install flash-attn \
    --index-url https://pypi.jetson-ai-lab.io/sbsa/cu130/+simple/
# Installs: flash-attn==2.8.4 (cp312, linux_aarch64)
```

### flashinfer

| | |
|---|---|
| **Available in sbsa/cu130** | `flashinfer-python==0.6.4`, `flashinfer-cubin==0.6.4` |
| `flashinfer-jit-cache` | `0.5.3` (abi3, from sbsa/cu130 or flashinfer.ai/whl/cu130) |
| **Used by this project** | **No** |

To install flashinfer for inference workloads (e.g. vLLM, SGLang):

```bash
# Pre-built cubin + Python wrapper from NVIDIA sbsa/cu130:
pip install flashinfer-python flashinfer-cubin \
    --index-url https://pypi.jetson-ai-lab.io/sbsa/cu130/+simple/

# JIT cache from flashinfer.ai (cu130-specific):
pip install flashinfer-jit-cache \
    --index-url https://flashinfer.ai/whl/cu130
```

### numpy

| | |
|---|---|
| **Pinned** | `>=2.2.6,<3` |
| Source | PyPI (manylinux aarch64) |
| ABI note | torch-2.10.0 (sbsa/cu130) uses the stable numpy C ABI, compatible with numpy 2.x. If you encounter "NumPy 1.x compiled module" warnings after installing, downgrade: `pip install 'numpy~=1.26.4'` |

### pandas, pyarrow, matplotlib, requests

All have manylinux aarch64 wheels on PyPI. No special handling needed.

| Package | Pinned | Wheel |
|---|---|---|
| pandas | `>=2.3.0` | manylinux aarch64 |
| pyarrow | `>=21.0.0` | manylinux aarch64 |
| matplotlib | `>=3.10.3` | manylinux aarch64 |
| requests | `>=2.32.0` | pure-Python |

### tiktoken

| | |
|---|---|
| **Pinned** | `>=0.9.0` |
| Source | PyPI |
| Wheel | manylinux aarch64 (Rust-compiled) — pre-built wheel available |

### rustbpe

| | |
|---|---|
| **Pinned** | `>=0.1.0` |
| Source | PyPI |
| Wheel | Rust extension — built from source if no pre-built wheel for Python 3.12 |
| Requirement | Rust toolchain (`rustup install stable`) |

If `uv sync` fails on rustbpe, install Rust first:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
uv sync
```

---

## Runtime code audit (train.py + prepare.py)

### train.py — result: PASSES on Jetson Thor

| Feature / call | Status | Notes |
|---|---|---|
| `PYTORCH_CUDA_ALLOC_CONF=backend:cudaMallocAsync,expandable_segments:False` | ✅ | `cudaMallocAsync` is correct for `cudaMallocManaged`-based unified memory. `expandable_segments:True` crashes on Jetson |
| `TRITON_PTXAS_PATH=/usr/local/cuda/bin/ptxas` | ✅ | Correct path for JetPack 7.x / CUDA 13.0 |
| `torch.cuda.set_per_process_memory_fraction(126/128)` | ✅ | Caps caching allocator to 126 GB, leaves ~2 GB for OS |
| `torch.amp.autocast(dtype=torch.bfloat16)` | ✅ | BF16 native on SM_110 Tensor Cores |
| `torch.set_float32_matmul_precision("high")` | ✅ | Enables TF32 on SM_110 |
| `torch.nn.attention.flex_attention` | ✅ | Triton-based, architecture-agnostic; ships in torch 2.5+ |
| `create_block_mask(B=None, H=None)` | ✅ | Arch-independent; available since torch 2.5 |
| `F.rms_norm` | ✅ | Available since torch 2.4 |
| `torch.compile(dynamic=False)` | ✅ | Inductor + Triton compile path works on SM_110 + cu130 |
| `@torch.compile(dynamic=False, fullgraph=True)` on `adamw_step_fused` | ✅ | Fused on SM_110 |
| `@torch.compile(dynamic=False, fullgraph=True)` on `muon_step_fused` | ✅ | Fused on SM_110 |
| `model.to_empty(device=device)` | ✅ | Meta device init pattern works |
| `torch._foreach_copy_` | ✅ | Private but present in torch 2.10.x |
| `torch.cuda.get_device_properties(0).total_memory` | ✅ | Reports full 128 GB unified pool |
| `gc.freeze()` + `gc.disable()` | ✅ | Eliminates GC stalls in training loop |

### prepare.py — result: PASSES on Jetson Thor

| Feature | Status | Notes |
|---|---|
| `multiprocessing.Pool` | ✅ | `fork` start method is default on Linux; works on SBSA aarch64 |
| `pyarrow.parquet` | ✅ | manylinux aarch64 wheel |
| `rustbpe.Tokenizer` | ✅ | Built from source; needs Rust toolchain |
| `tiktoken.Encoding` | ✅ | manylinux aarch64 wheel |
| `torch.save` / `torch.load` | ✅ | Standard; no CUDA involved |
| Pin-memory dataloader (`cpu_buffer = torch.empty(..., pin_memory=True)`) | ✅ | Works on unified-memory Jetson; pinned memory enables `non_blocking=True` async H2D copies even when memory is shared |

### Caveats (not bugs, just things to know)

**torch.compile first-step latency**
Triton JIT compiles SM_110 kernels on first use. Step 0 will stall for 60–120 s.
The loop already accounts for this by skipping step-time tracking for `step <= 10`.

**THOR_BF16_PEAK_FLOPS**
Set to `125e12` (125 TFLOPS). This is the T5000 module figure for dense BF16 matmuls
on SM_110. Used only for the MFU% display — not for training. Verify your module:

```bash
nvidia-smi --query-gpu=name,clocks.max.sm --format=csv,noheader
```

**DEVICE_BATCH_SIZE**
Default is `128`. With a 126 GB capped pool this is conservative. At DEPTH=8 and
MAX_SEQ_LEN=2048, peak model memory is ~3–4 GB for BF16 weights + activations + grads,
leaving the remainder for the data pipeline. Safe to raise to `256` for sweep experiments.

**flex_attention kernel_options**
`ROWS_GUARANTEED_SAFE=True` and `BLOCKS_ARE_CONTIGUOUS=True` were found to cause
silent gradient errors on SM_121a (GB10). They are equally unsafe on SM_110 and are
not used here. ✅

---

## jetson-containers container reference (Thor-specific)

| Use case | Command |
|---|---|
| Build PyTorch 2.10 from source | `LSB_RELEASE=24.04 CUDA_VERSION=13.0 jetson-containers build pytorch:2.10` |
| NGC PyTorch container | `nvcr.io/nvidia/pytorch:25.09-py3` |
| Run autoresearch in container | `jetson-containers run -v $(pwd):/workspace $(autotag pytorch) bash -c "cd /workspace && bash setup.sh && source .venv/bin/activate && python train.py"` |

---

## Version delta: this fork vs previous session

| File | Change | Reason |
|---|---|---|
| `pyproject.toml` | `torch==2.9.1` → `torch==2.10.0` | 2.10.0 is the latest in sbsa/cu130; 2.9.1 was the official stable at time of previous edit |
| `pyproject.toml` | index URL `download.pytorch.org/whl/cu130` → `pypi.jetson-ai-lab.io/sbsa/cu130/+simple/` | NVIDIA index has the Jetson-optimised torch-2.10.0; official index only has 2.9.1 |
| `pyproject.toml` | `requires-python = ">=3.12"` → `">=3.12,<3.13"` | JetPack 7.x ships exactly Python 3.12; 3.13 not available on-device |
| `pyproject.toml` | `pandas>=2.3.3` → `>=2.3.0` | Loosened minor — 2.3.0 is first 2.x minor with full manylinux aarch64 |
| `pyproject.toml` | `tiktoken>=0.11.0` → `>=0.9.0` | 0.9.0 introduced the manylinux aarch64 wheel; loosened to allow any compatible version |
| `setup.sh` | Document sbsa/cu129 = GH200, sbsa/cu130 = Thor | Common source of confusion |
| `setup.sh` | flash-attn install uses sbsa/cu130 (2.8.4), not config.py version 3.0.0 | Config target ≠ built wheel |
| `train.py` | Comment improvements only; no logic changes | Clarified allocation rationale |
| `.python-version` | `3.13` → `3.12` | JetPack 7.x ships Python 3.12 |
