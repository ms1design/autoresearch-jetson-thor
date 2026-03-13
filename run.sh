#!/bin/bash

# Single command launcher for autoresearch-jetson-thor services
# Usage: ./run.sh [vllm|train|both|build] [options]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

show_help() {
    echo "Usage: ./run.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  vllm      Start vLLM inference server"
    echo "  train     Start training container"
    echo "  both      Start both vLLM and training containers"
    echo "  build     Build training Docker image"
    echo "  stop      Stop all containers"
    echo "  ps        Show running containers"
    echo "  logs      Show logs from all containers"
    echo ""
    echo "Examples:"
    echo "  ./run.sh vllm                    # Start vLLM server"
    echo "  ./run.sh build                   # Build training image"
    echo "  ./run.sh train                   # Start training"
    echo "  ./run.sh train 'prepare.py'      # Run prepare.py in training container"
    echo "  ./run.sh train 'train.py --epochs 10'  # Run train.py with custom args"
    echo "  ./run.sh both                    # Start both services"
    echo "  ./run.sh stop                    # Stop all containers"
}

case "$1" in
    build)
        echo "Building training Docker image..."
        docker compose -f docker-compose.yaml build train
        echo "Training image built successfully"
        ;;
    vllm)
        echo "Starting vLLM inference server..."
        export VLLM_MAIN_SERVER_PORT=${VLLM_MAIN_SERVER_PORT:-8000}
        export MAIN_LLM_MODEL=${MAIN_LLM_MODEL:-Qwen/Qwen3-Coder-Next}
        export MAIN_LLM_MODEL_QUANT=${MAIN_LLM_MODEL_QUANT:-RedHatAI/Qwen3-Coder-Next-NVFP4}
        docker compose -f docker-compose.yaml up -d vllm
        echo "vLLM server started. Access at http://localhost:${VLLM_MAIN_SERVER_PORT:-8000}"
        ;;
    train)
        shift
        TRAIN_ARGS="$*"
        if [ -z "$TRAIN_ARGS" ]; then
            TRAIN_ARGS="train.py"
        fi
        export TRAIN_COMMAND="$TRAIN_ARGS"
        echo "Starting training container with command: uv run $TRAIN_ARGS"
        echo "Container will use pre-built image with dependencies already synced"
        docker compose -f docker-compose.yaml up -d train
        echo "Training container started. Follow logs with: docker compose -f docker-compose.yaml logs -f train"
        ;;
    both)
        echo "Starting both vLLM and training services..."
        export VLLM_MAIN_SERVER_PORT=${VLLM_MAIN_SERVER_PORT:-8000}
        export MAIN_LLM_MODEL=${MAIN_LLM_MODEL:-Qwen/Qwen3-Coder-Next}
        export MAIN_LLM_MODEL_QUANT=${MAIN_LLM_MODEL_QUANT:-RedHatAI/Qwen3-Coder-Next-NVFP4}
        docker compose -f docker-compose.yaml up -d
        echo "All services started."
        echo "  - vLLM: http://localhost:${VLLM_MAIN_SERVER_PORT:-8000}"
        echo "  - Training: docker compose -f docker-compose.yaml logs -f train"
        ;;
    stop)
        echo "Stopping all containers..."
        docker compose -f docker-compose.yaml down
        ;;
    ps)
        docker compose -f docker-compose.yaml ps
        ;;
    logs)
        docker compose -f docker-compose.yaml logs -f
        ;;
    *)
        show_help
        exit 1
        ;;
esac
