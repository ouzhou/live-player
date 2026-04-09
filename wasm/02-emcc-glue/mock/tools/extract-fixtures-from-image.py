#!/usr/bin/env python3
"""
将 **静态图片**（PNG / JPEG / WebP 等 ffmpeg 可读格式）编码为极短 H.264 MP4，
再调用与 `extract-fixtures-from-mp4.py` **相同** 的流程，生成 mock 数据：

  - avcC-from-mp4.bin / .b64.txt
  - sample-annexb-short.h264
  - chunk-first-idr-avcc.bin / .b64.txt

依赖：系统已安装 ffmpeg、ffprobe；本脚本同目录需有 `extract-fixtures-from-mp4.py`。

用法：
  python3 extract-fixtures-from-image.py /path/to/photo.png /path/to/out-dir
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


def image_to_mp4(image: Path, mp4: Path) -> None:
    """单帧 libx264 + yuv420p，与常见 WASM/WebCodecs 路径一致。"""
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(image),
            "-frames:v",
            "1",
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "ultrafast",
            "-movflags",
            "+faststart",
            str(mp4),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__.strip(), file=sys.stderr)
        sys.exit(2)
    image = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if not image.is_file():
        print(f"not a file: {image}", file=sys.stderr)
        sys.exit(1)

    sibling = Path(__file__).resolve().parent / "extract-fixtures-from-mp4.py"
    if not sibling.is_file():
        print(f"missing: {sibling}", file=sys.stderr)
        sys.exit(1)

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        print(f"Encoding H.264 MP4 from image -> {tmp_path}")
        image_to_mp4(image, tmp_path)
        subprocess.check_call(
            [sys.executable, str(sibling), str(tmp_path), str(out)],
        )
    finally:
        tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
