#!/usr/bin/env python3
"""
从 MP4 提取 WASM / FlvDemuxer 联调用素材：
  - avcC-from-mp4.bin：ffprobe 解析的 video extradata（与 WebCodecs description 同源）
  - sample-annexb-short.h264：短片段 Annex-B 元数据流（便于肉眼看 NAL）
  - chunk-first-idr-avcc.bin：首个 IDR（NAL type 5）前加 4 字节大端长度，与 FLV `chunk.data` /
    `wasm_video_chunk` 负载（单 NAL 一帧）常见写法一致

依赖：系统已安装 ffmpeg、ffprobe。

用法：
  python3 extract-fixtures-from-mp4.py /path/to/video.mp4 /path/to/out-dir
"""

from __future__ import annotations

import base64
import re
import subprocess
import sys
from pathlib import Path


def split_annex_b_nals(data: bytes) -> list[bytes]:
    """按 00 00 01 / 00 00 00 01 切分，返回每段完整 NAL（含首字节 nal header）。"""
    nals: list[bytes] = []
    i = 0
    n = len(data)
    while i < n:
        sc = 0
        if i + 3 <= n and data[i : i + 3] == b"\x00\x00\x01":
            sc = 3
        elif i + 4 <= n and data[i : i + 4] == b"\x00\x00\x00\x01":
            sc = 4
        if sc == 0:
            i += 1
            continue
        start = i + sc
        j = start
        while j < n:
            if data[j : j + 3] == b"\x00\x00\x01" or (
                j + 4 <= n and data[j : j + 4] == b"\x00\x00\x00\x01"
            ):
                break
            j += 1
        nals.append(data[start:j])
        i = j
    return nals


def h264_nal_unit_type(nal: bytes) -> int:
    if len(nal) < 1:
        return -1
    return nal[0] & 0x1F


def first_idr_avcc_chunk(annex_b: bytes) -> bytes | None:
    """首个 IDR slice 单 NAL → 4 字节 BE 长度 + NAL（与 MP4/FLV AVCC 打包一致）。"""
    for nal in split_annex_b_nals(annex_b):
        if h264_nal_unit_type(nal) == 5:
            return len(nal).to_bytes(4, "big") + nal
    return None


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

    annex_bytes = short.read_bytes()
    chunk_avcc = first_idr_avcc_chunk(annex_bytes)
    if chunk_avcc is None:
        longer = out / "sample-annexb-2s.h264"
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
                "2",
                "-bsf:v",
                "h264_mp4toannexb",
                "-f",
                "h264",
                str(longer),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        chunk_avcc = first_idr_avcc_chunk(longer.read_bytes())
        if chunk_avcc is None:
            print(
                "warn: no IDR (NAL type 5) found in first 2s; skip chunk-first-idr-avcc.*",
                file=sys.stderr,
            )
        else:
            print(f"(used {longer} to find IDR)")
    if chunk_avcc is not None:
        (out / "chunk-first-idr-avcc.bin").write_bytes(chunk_avcc)
        print(f"Wrote {len(chunk_avcc)} bytes -> {out / 'chunk-first-idr-avcc.bin'}")
        b64_chunk = base64.b64encode(chunk_avcc).decode("ascii")
        (out / "chunk-first-idr-avcc.b64.txt").write_text(b64_chunk + "\n", encoding="ascii")
        print(f"Wrote base64 -> {out / 'chunk-first-idr-avcc.b64.txt'}")

    b64 = base64.b64encode(extradata).decode("ascii")
    (out / "avcC-from-mp4.b64.txt").write_text(b64 + "\n", encoding="ascii")
    print(f"Wrote base64 -> {out / 'avcC-from-mp4.b64.txt'}")


if __name__ == "__main__":
    main()
