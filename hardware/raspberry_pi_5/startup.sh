#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/nabila/Downloads/raspberry_pi_5"
cd "$PROJECT_DIR"

if [ -f "$PROJECT_DIR/.venv/bin/activate" ]; then
  source "$PROJECT_DIR/.venv/bin/activate"
fi

exec python3 "$PROJECT_DIR/main.py" --mode server --port 5002 --service-account "$PROJECT_DIR/serviceAccountKey.json"
