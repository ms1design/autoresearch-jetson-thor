# autoresearch-jetson-thor

![teaser](progress.png)

---

**Jetson Thor SBSA Edition** — This fork is configured for Jetson Thor (SM_110, JetPack 7.x, SBSA aarch64).

---

*One day, frontier AI research used to be done by meat computers in between eating, sleeping, having other fun, and synchronizing once in a while using sound wave interconnect in the ritual of "group meeting". That era is long gone. Research is now entirely the domain of autonomous swarms of AI agents running across compute cluster megastructures in the skies. The agents claim that we are now in the 10,205th generation of the code base, in any case no one could tell if that's right or wrong as the "code" is now a self-modifying binary that has grown beyond human comprehension. This repo is the story of how it all began. -@karpathy, March 2026*.

The idea: give an AI agent a small but real LLM training setup and let it experiment autonomously overnight. It modifies the code, trains for 5 minutes, checks if the result improved, keeps or discards, and repeats. You wake up in the morning to a log of experiments and (hopefully) a better model. The training code here is a simplified single-GPU implementation of [nanochat](https://github.com/karpathy/nanochat). The core idea is that you're not touching any of the Python files like you normally would as a researcher. Instead, you are programming the `program.md` Markdown files that provide context to the AI agents and set up your autonomous research org. The default `program.md` in this repo is intentionally kept as a bare bones baseline, though it's obvious how one would iterate on it over time to find the "research org code" that achieves the fastest research progress, how you'd add more agents to the mix, etc. A bit more context on this project is here in this [tweet](https://x.com/karpathy/status/2029701092347630069).

## How it works

The repo is deliberately kept small and only really has three files that matter:

- **`prepare.py`** — fixed constants, one-time data prep (downloads training data, trains a BPE tokenizer), and runtime utilities (dataloader, evaluation). Not modified.
- **`train.py`** — the single file the agent edits. Contains the full GPT model, optimizer (Muon + AdamW), and training loop. Everything is fair game: architecture, hyperparameters, optimizer, batch size, etc. **This file is edited and iterated on by the agent**.
- **`program.md`** — baseline instructions for one agent. Point your agent here and let it go. **This file is edited and iterated on by the human**.

By design, training runs for a **fixed 5-minute time budget** (wall clock, excluding startup/compilation), regardless of the details of your compute. The metric is **val_bpb** (validation bits per byte) — lower is better, and vocab-size-independent so architectural changes are fairly compared.

If you are new to neural networks, this ["Dummy's Guide"](https://x.com/hooeem/status/2030720614752039185) looks pretty good for a lot more context.

## Table of Contents

- [Quick start (Jetson Thor)](#quick-start-jetson-thor)
- [Running the agent](#running-the-agent)
- [OpenCode Integration](#opencode-integration)
- [Project structure](#project-structure)
- [Design choices](#design-choices)
- [Platform support](#platform-support)

## Quick start (Jetson Thor)

**Requirements:** Jetson Thor (SM_110, JetPack 7.x, SBSA aarch64), Python 3.12, [uv](https://docs.astral.sh/uv/).

```bash
# 1. Install uv project manager (if you don't already have it)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Install project dependencies (for host-based development)
bash setup.sh

# 3. Install arxiv-mcp-server (for agent research capabilities - on host)
uv tool install arxiv-mcp-server

# 4. Download data and train tokenizer (one-time, ~2 min)
uv run prepare.py

# 5. Manually run a single training experiment (~5 min)
uv run train.py
```

If the above commands work, your setup is ready for autonomous research mode.

## Running the agent

For autonomous research experiments, simply run:

```bash
# Run a single training experiment (~5 min)
uv run train.py
```

The `program.md` file contains instructions for autonomous research agents. You can modify it to guide your agent's experiments.

## OpenCode Integration

This project is integrated with [OpenCode](https://opencode.ai/), an AI coding agent that enables autonomous LLM training research.

### Quick OpenCode Start

```bash
# 1. Install OpenCode
npm install -g opencode-ai

# 2. Navigate to project and initialize
cd /path/to/autoresearch-jetson-thor
opencode
# In the TUI:
/init

# 3. Start autonomous research
# Ask OpenCode to run experiments, find papers, or modify train.py
```

### Custom Tools (`.opencode/tools/`)

1. **autoresearch_train**: Run training experiments (5-minute time budget)
2. **autoresearch_analyse**: Analyze results from run.log and results.tsv

### Available Subagents (`.opencode/agents/`)

1. **python-coder.json**: Modify train.py for autonomous research experiments
2. **arxiv-researcher.json**: Find and analyze academic papers from arXiv.org

### arxiv-mcp-server

The project includes **arxiv-mcp-server** as a tool for autonomous research:
- Provides access to arXiv papers via Model Context Protocol (MCP)
- Enables agents to discover and analyze academic papers
- Installed via `uv tool install arxiv-mcp-server`

The MCP server powers the `arxiv-researcher.json` agent, allowing it to:
- Search papers by title, author, abstract, or category
- Download and read full paper content
- Filter by date range and relevance

**Installation:** Run `uv tool install arxiv-mcp-server` on your host system. This tool is required for the arxiv-researcher agent to function.

## Project structure

```
prepare.py      — constants, data prep + runtime utilities (do not modify)
train.py        — model, optimizer, training loop (agent modifies this)
program.md      — agent instructions
pyproject.toml  — dependencies
setup.sh        — installation script (installs project dependencies on host)
AGENTS.md       — project documentation for agents (auto-generated)
.opencode/      — OpenCode configuration (tools, agents)
```
prepare.py      — constants, data prep + runtime utilities (do not modify)
train.py        — model, optimizer, training loop (agent modifies this)
program.md      — agent instructions
pyproject.toml  — dependencies
setup.sh        — installation script (installs project dependencies on host)
AGENTS.md       — project documentation for agents (auto-generated)
.opencode/      — OpenCode configuration (tools, agents)
```

## Design choices

- **Single file to modify.** The agent only touches `train.py`. This keeps the scope manageable and diffs reviewable.
- **Fixed time budget.** Training always runs for exactly 5 minutes, regardless of your specific platform. This means you can expect approx 12 experiments/hour and approx 100 experiments while you sleep. There are two upsides of this design decision. First, this makes experiments directly comparable regardless of what the agent changes (model size, batch size, architecture, etc). Second, this means that autoresearch will find the most optimal model for your platform in that time budget. The downside is that your runs (and results) become not comparable to other people running on other compute platforms.
- **Self-contained.** No external dependencies beyond PyTorch and a few small packages. No distributed training, no complex configs. One GPU, one file, one metric.

## Platform support

This code currently requires that you have a single NVIDIA GPU. In principle it is quite possible to support CPU, MPS and other platforms but this would also bloat the code. I'm not 100% sure that I want to take this on personally right now. People can reference (or have their agents reference) the full/parent nanochat repository that has wider platform support and shows the various solutions (e.g. a Flash Attention 3 kernels fallback implementation, generic device support, autodetection, etc.), feel free to create forks or discussions for other platforms and I'm happy to link to them here in the README in some new notable forks section or etc.

### Jetson Thor (SBSA aarch64)

This fork is optimized for Jetson Thor (SM_110, JetPack 7.x, SBSA aarch64):
- Uses `sbsa/cu130` PyTorch wheels from NVIDIA Jetson AI Lab
- Configured for SM_110 GPU architecture with 128 GB unified memory
- Uses `torch.compile` with Inductor + Triton (Triton 3.5.0)
- Python 3.12, CUDA 13.0, L4T r38.x
- Note: Do not use `sbsa/cu129` - that's for GH200/GB200, not Jetson Thor

Seeing as there seems to be a lot of interest in tinkering with autoresearch on much smaller compute platforms than an H100, a few extra words. If you're going to try running autoresearch on smaller computers (Macbooks etc.), I'd recommend one of the forks below. On top of this, here are some recommendations for how to tune the defaults for much smaller models for aspiring forks:

1. To get half-decent results I'd use a dataset with a lot less entropy, e.g. this [TinyStories dataset](https://huggingface.co/datasets/karpathy/tinystories-gpt4-clean). These are GPT-4 generated short stories. Because the data is a lot narrower in scope, you will see reasonable results with a lot smaller models (if you try to sample from them after training).
2. You might experiment with decreasing `vocab_size`, e.g. from 8192 down to 4096, 2048, 1024, or even - simply byte-level tokenizer with 256 possibly bytes after utf-8 encoding.
3. In `prepare.py`, you'll want to lower `MAX_SEQ_LEN` a lot, depending on the computer even down to 256 etc. As you lower `MAX_SEQ_LEN`, you may want to experiment with increasing `DEVICE_BATCH_SIZE` in `train.py` slightly to compensate. The number of tokens per fwd/bwd pass is the product of these two.
4. Also in `prepare.py`, you'll want to decrease `EVAL_TOKENS` so that your validation loss is evaluated on a lot less data.
5. In `train.py`, the primary single knob that controls model complexity is the `DEPTH` (default 8, here). A lot of variables are just functions of this, so e.g. lower it down to e.g. 4.
6. You'll want to most likely use `WINDOW_PATTERN` of just "L", because "SSSL" uses alternating banded attention pattern that may be very inefficient for you. Try it.
7. You'll want to lower `TOTAL_BATCH_SIZE` a lot, but keep it powers of 2, e.g. down to `2**14` (~16K) or so even, hard to tell.

I think these would be the reasonable hyperparameters to play with. Ask your favorite coding agent for help and copy paste them this guide, as well as the full source code.

## Notable forks

- [miolini/autoresearch-macos](https://github.com/miolini/autoresearch-macos) (MacOS)
- [trevin-creator/autoresearch-mlx](https://github.com/trevin-creator/autoresearch-mlx) (MacOS)
- [jsegov/autoresearch-win-rtx](https://github.com/jsegov/autoresearch-win-rtx) (Windows)

### Jetson Thor Edition

- **This repository** — Jetson Thor SBSA (SM_110, JetPack 7.x)

## License

MIT
