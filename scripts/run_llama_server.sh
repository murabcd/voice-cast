#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${MODEL:-$ROOT/models/llm/smollm3-3b/HuggingFaceTB_SmolLM3-3B-Q4_K_M.gguf}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-18081}"

exec llama-server \
  --model "$MODEL" \
  --host "$HOST" \
  --port "$PORT" \
  --ctx-size 2048 \
  --threads 4 \
  --n-gpu-layers 99 \
  --jinja \
  --reasoning off \
  --reasoning-format none \
  --reasoning-budget 0
