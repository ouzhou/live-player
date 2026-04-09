#!/usr/bin/env bash
# 步骤二：Docker 内 emcc 链接 minimal-shell 与步骤一产出的 *.a → shell.js + shell.wasm
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DIST="$REPO_ROOT/wasm/artifacts/emcc-glue"

if [[ ! -f "$REPO_ROOT/wasm/artifacts/ffmpeg-static/usr/local/lib/libavutil.a" ]]; then
  echo "缺少静态库：请先执行 wasm/01-ffmpeg-static/build.sh" >&2
  exit 1
fi

mkdir -p "$DIST"

EMSDK_IMAGE="${EMSDK_IMAGE:-emscripten/emsdk:5.0.5}"

docker run --rm \
  -v "$REPO_ROOT":/work \
  -w /work \
  "${EMSDK_IMAGE}" \
  emcc -O3 \
    "/work/wasm/02-emcc-glue/minimal-shell/main.cpp" \
    "-I/work/wasm/artifacts/ffmpeg-static/usr/local/include" \
    "-L/work/wasm/artifacts/ffmpeg-static/usr/local/lib" \
    -lavdevice \
    -lavfilter \
    -lavformat \
    -lavcodec \
    -lswresample \
    -lswscale \
    -lavutil \
    -sENVIRONMENT=web \
    -sALLOW_MEMORY_GROWTH=1 \
    -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString \
    "-sEXPORTED_FUNCTIONS=_malloc,_free,_wasm_get_version,_wasm_init,_wasm_close,_wasm_video_config,_wasm_video_chunk,_wasm_audio_config,_wasm_audio_chunk" \
    -o "/work/wasm/artifacts/emcc-glue/shell.js"

echo "OK: $DIST/shell.js + shell.wasm"
