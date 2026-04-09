#!/usr/bin/env python3
"""
从 MP4 提取 WASM / FlvDemuxer 联调用素材：
  - avcC-from-mp4.bin：ffprobe 解析的 video extradata（与 WebCodecs description 同源）
  - sample-annexb-short.h264：短片段 Annex-B 元数据流（便于肉眼看 NAL）

依赖：系统已安装 ffmpeg、ffprobe。

用法：
  python3 extract-fixtures-from-mp4.py /path/to/video.mp4 /path/to/out-dir
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def ffprobe_extradata_hex(mp4: Path) -> bytes:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_streams",
            "-show_data",
            "-select_streams",
            "v:0",
            str(mp4),
        ],
        text=True,
        stderr=subprocess.STDOUT,
    )
    m = re.search(r"extradata_size=(\d+)", raw)
    if not m:
        raise RuntimeError("no extradata_size in ffprobe output")
    want = int(m.group(1))
    hex_lines: list[str] = []
    in_block = False
    for line in raw.splitlines():
        s = line.strip()
        if s == "extradata=":
            in_block = True
            continue
        if s.startswith("extradata_size="):
            break
        if not in_block:
            continue
        # 行样例: "00000000: 014d 402a ...  .ascii" —— 取冒号后、ASCII 列（两空格+点）之前的十六进制
        stripped = line.strip()
        if ":" not in stripped:
            continue
        after = stripped.split(":", 1)[1]
        ascii_mo = re.search(r"\s{2,}\.", after)
        if ascii_mo:
            after = after[: ascii_mo.start()]
        parts = re.findall(r"[0-9a-f]{2}", after, flags=re.I)
        hex_lines.extend(parts)
    h = "".join(hex_lines)
    data = bytes.fromhex(h)
    if len(data) != want:
        raise RuntimeError(f"extradata length {len(data)} != extradata_size {want}")
    return data


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__.strip(), file=sys.stderr)
        sys.exit(2)
    mp4 = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if not mp4.is_file():
        print(f"not a file: {mp4}", file=sys.stderr)
        sys.exit(1)

    extradata = ffprobe_extradata_hex(mp4)
    (out / "avcC-from-mp4.bin").write_bytes(extradata)
    print(f"Wrote {len(extradata)} bytes -> {out / 'avcC-from-mp4.bin'}")

    short = out / "sample-annexb-short.h264"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp4),
            "-map",
            "0:v:0",
            "-c:v",
            "copy",
            "-t",
            "0.2",
            "-bsf:v",
            "h264_mp4toannexb",
            "-f",
            "h264",
            str(short),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    n = short.stat().st_size
    print(f"Wrote Annex-B ({n} bytes) -> {short}")

    # base64 单行，便于粘进 fixtures.json
    import base64

    b64 = base64.b64encode(extradata).decode("ascii")
    (out / "avcC-from-mp4.b64.txt").write_text(b64 + "\n", encoding="ascii")
    print(f"Wrote base64 -> {out / 'avcC-from-mp4.b64.txt'}")


if __name__ == "__main__":
    main()
