sync && echo 3 | tee /proc/sys/vm/drop_caches && \
  vllm serve \
    --model Qwen/Qwen3-Coder-Next \
    --model RedHatAI/Qwen3-Coder-Next-NVFP4 \
    --kv-cache-dtype fp8_e4m3 \
    --max-model-len 185000 \
    --gpu-memory-utilization 0.7 \
    --enable-auto-tool-choice \
    --tool-call-parser qwen3_coder \
    --mamba-cache-mode align \
    --enable-prefix-caching \
    --enable-chunked-prefill \
    --max-num-seqs 4 \
    --cpu-offload-gb 0 \
    --swap-space 0 \
    --host 0.0.0.0 \
    --disable-fastapi-docs \
    --enable-force-include-usage \
    --download-dir /data/models/huggingface
