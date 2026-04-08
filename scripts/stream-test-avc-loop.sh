#!/usr/bin/env bash
# 循环读取 scripts/test.avc.mp4（H.264/AAC），以 FLV 封装推到 RTMP（默认本地 nginx-rtmp / SRS 等）。
# 用法：./scripts/stream-test-avc-loop.sh
#      RTMP_URL=rtmp://127.0.0.1:1935/live/foo ./scripts/stream-test-avc-loop.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/scripts/test.avc.mp4"
RTMP_URL="${RTMP_URL:-rtmp://127.0.0.1:1935/live/test}"

if [[ ! -f "$SRC" ]]; then
  echo "missing: $SRC (generate with ffmpeg from test.hevc.mp4)" >&2
  exit 1
fi

exec ffmpeg -loglevel info -re -stream_loop -1 -i "$SRC" -c copy -f flv "$RTMP_URL"
