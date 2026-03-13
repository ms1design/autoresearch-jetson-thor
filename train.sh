#!/usr/bin/env bash

set -euo pipefail

sync
sudo -n sysctl -w vm.drop_caches=3

uv run train.py || sudo -n sysctl -w vm.drop_caches=3