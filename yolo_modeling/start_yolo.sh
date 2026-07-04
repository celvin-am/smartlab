#!/usr/bin/env bash
set -euo pipefail

YOLO_DIR="/home/nabila/Downloads/Deteksi Objek Laboratorium"
cd "$YOLO_DIR"

if [ -f "$YOLO_DIR/.venv/bin/activate" ]; then
  source "$YOLO_DIR/.venv/bin/activate"
fi

exec python3 "$YOLO_DIR/Webcam_test.py"
