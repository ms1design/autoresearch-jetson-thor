# Use the same vLLM image as base
FROM nvcr.io/nvidia/vllm:26.02-py3

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV DO_NOT_TRACK=1
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility
ENV CUDA_VISIBLE_DEVICES=0

# Create working directory
WORKDIR /workspace

# Copy source files
COPY . ./

# Sync dependencies at build time (one-time setup)
# Delete the existing uv.lock to regenerate it with correct Linux aarch64 markers
# This ensures the lock file is created on the target platform (Jetson AGX Thor)
RUN rm -f uv.lock || true && uv sync && uv lock --upgrade

# Create cache directories
RUN mkdir -p /data/cache /data/models/huggingface

RUN chmod +x setup.sh && ./setup.sh

# Download data and train tokenizer (one-time, ~2 min)
RUN uv run prepare.py

# Drop caches for fresh start (runtime optimization)
RUN echo "Cache setup complete"

# Set entrypoint to sync and run commands
ENTRYPOINT ["/bin/sh", "-c", "sync && echo 3 | tee /proc/sys/vm/drop_caches && exec \"$@\"", "--"]

# Default command runs train.py
CMD ["uv", "run", "train.py"]
