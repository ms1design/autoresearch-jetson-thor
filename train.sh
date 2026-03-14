#!/usr/bin/env bash

set -euo pipefail

# Parse arguments
EXPERIMENT_NAME="test"
DESCRIPTION="test"
QUIET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --experiment-name)
            EXPERIMENT_NAME="$2"
            shift 2
            ;;
        --description)
            DESCRIPTION="$2"
            shift 2
            ;;
        --quiet)
            QUIET=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Export for use by train.py
export EXPERIMENT_NAME
export DESCRIPTION

LOG_PATH="logs/training.log"

# Ensure logs directory exists
mkdir -p logs

# Clear log file before each training
> "$LOG_PATH"
# Run training and capture output to log file (also show on stdout)
sync
sudo -n sysctl -w vm.drop_caches=3 > /dev/null 2>&1

# Run training, show output AND capture it to log file
set +e
if [ "$QUIET" = true ]; then
    # When quiet: output ONLY to log file, NOT to stdout
    uv run train.py 2>&1 | tee -a "$LOG_PATH" > /dev/null
    TRAIN_EXIT_CODE=$?
else
    # Run with output to both console and log file
    uv run train.py 2>&1 | tee -a "$LOG_PATH"
    TRAIN_EXIT_CODE=$?
fi
set -e

# Clear memory after training (success or failure)
sudo -n sysctl -w vm.drop_caches=3 > /dev/null 2>&1

exit $TRAIN_EXIT_CODE