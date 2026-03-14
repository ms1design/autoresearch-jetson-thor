# autoresearch-jetson-thor

> A swarm of AI agents that runs LLM pretraining experiments autonomously — overnight, while you sleep.

Forked from [karpathy/autoresearch](https://github.com/karpathy/autoresearch). This edition is tuned for **Jetson AGX Thor** (SM_110 · JetPack 7.x · SBSA aarch64 · 128 GB unified memory).

![Training progress](https://github.com/ms1design/autoresearch-jetson-thor/raw/main/progress.png)

---

## What it does

You open [OpenCode](https://opencode.ai), point it at this repo, and go to sleep. A swarm of four coordinated agents loops forever:

1. **Auto Researcher** (orchestrator) — breaks work into subtasks and delegates
2. **`@arxiv-researcher`** — searches arXiv (via MCP) for ideas to try
3. **`@web-researcher`** — finds documentation, blog posts, and code examples
4. **`@python-coder`** — edits `train.py` with the next experiment

Each cycle: modify → train 5 min → measure `val_bpb` → commit if better, `git reset` if not. You wake up to a log of ~100 experiments and a better model.

**You never touch the Python.** You program `program.md` — a Markdown file that instructs the agent swarm what to pursue.

---

## Architecture

### The one file the agent edits — `train.py`

The model is a GPT decoder with several modern improvements baked in:

- **Sliding window attention** — pattern `SSSL`: three layers use a half-context window, every fourth layer attends to the full sequence. Implemented with [`flex_attention`](https://pytorch.org/docs/stable/nn.attention.flex_attention.html) block masks.
- **Value embeddings (ResFormer)** — alternating layers carry an extra `nn.Embedding` whose output is mixed into the value vectors via a learned per-head gate. Cheap residual memory.
- **RoPE** — rotary positional embeddings pre-computed for up to 10× the sequence length.
- **RMSNorm everywhere** — applied to Q, K before attention and on residuals.
- **Squared ReLU MLP** — `relu(x)²` in the feed-forward block.
- **Gradient checkpointing** — enabled by default to fit larger models in the 50 GB cap.
- **Logit softcapping** — `15 × tanh(logits / 15)` on the final logits.

### Optimizer — `MuonAdamW`

A single custom optimizer with two modes, dispatched per parameter group:

| Parameters | Optimizer | Notes |
|---|---|---|
| 2D matrix weights (attn, mlp) | **Muon** | Nesterov momentum + *Polar Express* orthogonalization (5 Newton–Schulz steps) + NorMuon variance reduction |
| Token embeddings, value embeddings | AdamW | LR scaled ∝ 1/√d_model |
| LM head | AdamW | |
| Per-layer scalars (`resid_lambdas`, `x0_lambdas`) | AdamW | |

All step functions are `torch.compile`'d with `fullgraph=True`. Scalar hyperparameters are passed as 0-D CPU tensors to avoid recompilation on every step.

### Default hyperparameters

```python
DEPTH              = 8          # transformer layers; model_dim = depth × 64
ASPECT_RATIO       = 64         # model_dim multiplier
HEAD_DIM           = 128        # target attention head dimension
WINDOW_PATTERN     = "SSSL"     # attention pattern per layer
TOTAL_BATCH_SIZE   = 2**19      # ~524 K tokens per optimizer step
DEVICE_BATCH_SIZE  = 64         # sequences per forward pass (gradient accumulation fills the rest)
MATRIX_LR          = 0.04       # Muon LR
EMBEDDING_LR       = 0.6        # AdamW LR for embeddings
WARMDOWN_RATIO     = 0.5        # half the budget spent cooling the LR to 0
WEIGHT_DECAY       = 0.2        # cautious weight decay on Muon
```

### Data pipeline — `prepare.py` (do not modify)

- **Dataset**: [`karpathy/climbmix-400b-shuffle`](https://huggingface.co/datasets/karpathy/climbmix-400b-shuffle) — downloaded as parquet shards to `~/.cache/autoresearch/`.
- **Tokenizer**: 8 192-vocab BPE trained from scratch with [`rustbpe`](https://github.com/karpathy/rustbpe) using a GPT-4-style split pattern.
- **Dataloader**: BOS-aligned, best-fit packing with zero padding waste. Pre-allocates pinned-memory buffers for async GPU transfers.
- **Eval metric**: `val_bpb` — validation bits per byte on a pinned shard (`shard_06542.parquet`), vocab-size independent, so architectural changes are fairly compared.

### Jetson Thor specifics

- PyTorch `≥ 2.10.0` pulled from `pytorch-test-cu130` (CUDA 13.0 SBSA wheels)
- `torch.compile` with Inductor + Triton 3.5.0, `TORCH_CUDA_ARCH_LIST=11.0a`
- `torch.cuda.set_per_process_memory_fraction` caps the CUDA allocator to **50 GB** of the 128 GB unified pool (leaves headroom for OS + CPU allocations)
- MFU display calibrated to **125 TFLOPS** BF16 (T5000 module, confirmed with `nvidia-smi`)
- `train.sh` runs `sudo sysctl -w vm.drop_caches=3` before and after each run to flush page cache

> ⚠️ Use `pytorch-test-cu130` wheels only. `sbsa/cu129` targets GH200/GB200, not Jetson Thor.

---

## Setup

**Requirements:** Jetson AGX Thor · JetPack 7.x · Python 3.12 · [`uv`](https://docs.astral.sh/uv/) · Node.js (for OpenCode)

```bash
# 1. Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Create venv, sync deps, configure sudoers (for cache-drop between runs)
bash setup.sh

# 3. Install the arXiv MCP server (used by @arxiv-researcher agent)
uv tool install arxiv-mcp-server

# 4. Download training shards + train the BPE tokenizer (~2 min, one-time)
uv run prepare.py

# 5. Smoke-test: run one experiment manually
./train.sh --experiment-name baseline --description "baseline run"
```

After step 5 prints `val_bpb: x.xxxxxx` you're ready.

---

## Running autonomous research

```bash
# Install OpenCode
npm install -g opencode-ai

# Start it in the project directory
cd autoresearch-jetson-thor
opencode
```

Inside the TUI, type `/init` then confirm setup. The **Auto Researcher** agent starts the loop automatically. It will:

1. Create a branch `autoresearch/<tag>`
2. Initialise `results.tsv`
3. Run the baseline
4. Loop experiments indefinitely — delegating research, code changes, and analysis to subagents in parallel

**You don't need to stay at your keyboard.**

### OpenCode tools

Three custom tools live in `.opencode/tools/` and are used exclusively by the agents (not called directly):

| Tool | What it does |
|---|---|
| `autoresearch_train` | Calls `train.sh`, streams output, saves log to `logs/training.log` |
| `autoresearch_analyse` | Parses `logs/training.log`, shows last 5 `results.tsv` entries for comparison |
| `autoresearch_triage` | Appends a row to `results.tsv` with commit hash, `val_bpb`, memory, and `keep`/`discard`/`crash` |

---

## Experiment results format

`results.tsv` (tab-separated, git-untracked):

```
commit    val_bpb     memory_gb   status    description
a1b2c3d   0.997900    44.0        keep      baseline
b2c3d4e   0.993200    44.2        keep      increase matrix LR to 0.04
c3d4e5f   1.005000    44.0        discard   switch to GeLU
d4e5f6g   0.000000    0.0         crash     double model width (OOM)
```

Good experiments are committed; bad ones are `git reset`. The branch tip always reflects the current best model.

---

## Tuning for smaller hardware

The original [karpathy/autoresearch](https://github.com/karpathy/autoresearch) README has detailed guidance. Short version:

- Lower-entropy dataset: [TinyStories](https://huggingface.co/datasets/karpathy/tinystories-gpt4-clean)
- Reduce `MAX_SEQ_LEN` in `prepare.py` (e.g. 256–512)
- Lower `DEPTH` from 8 → 4
- Set `WINDOW_PATTERN = "L"` (no banded attention overhead)
- Lower `TOTAL_BATCH_SIZE` to `2**14` or so
- Reduce `vocab_size` (4096, 2048, or even byte-level 256)

---

## Notable forks

| Platform | Repo |
|---|---|
| macOS (Metal) | [miolini/autoresearch-macos](https://github.com/miolini/autoresearch-macos) |
| macOS (MLX) | [trevin-creator/autoresearch-mlx](https://github.com/trevin-creator/autoresearch-mlx) |
| Windows (RTX) | [jsegov/autoresearch-win-rtx](https://github.com/jsegov/autoresearch-win-rtx) |
| **Jetson Thor** | **this repo** |

---

## Attribution

This is a fork of [karpathy/autoresearch](https://github.com/karpathy/autoresearch) by [@karpathy](https://github.com/karpathy). The training code derives from [nanochat](https://github.com/karpathy/nanochat). Original announcement: [tweet, March 2026](https://x.com/karpathy/status/2029701092347630069).

---

MIT License