#!/usr/bin/env bash
# 步骤一：交叉编译 FFmpeg → Emscripten 用静态库（*.a），输出到 wasm/artifacts/ffmpeg-static/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT="$REPO_ROOT/wasm/artifacts/ffmpeg-static"

mkdir -p "$OUT"

echo "==> FFmpeg 静态库 → $OUT"
DOCKER_BUILDKIT=1 docker build \
  --target artifacts \
  -o "$OUT" \
  -f "$SCRIPT_DIR/Dockerfile" \
  "$REPO_ROOT"

echo "OK: 头文件与 *.a 在 $OUT/usr/local/{include,lib}/"
