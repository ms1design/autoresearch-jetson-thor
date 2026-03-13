#!/usr/bin/env bash

set -euo pipefail

sync
sudo sysctl -w vm.drop_caches=3

uv run train.py