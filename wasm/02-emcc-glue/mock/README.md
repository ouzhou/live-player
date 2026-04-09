# Mock 数据

- **`fixtures.json`**：字段名与 [../API.md](../API.md) 中约定一致，值为 **base64**（空表示仅占位）。用 **`extract-fixtures-from-image.py`** 从高清截图生成时，`video_chunk.data_b64` 可能达到数百 KB；需要小体积烟测数据时请先用较小分辨率/裁剪图再跑脚本。
- 本地联调：用真实拉流页把 `config` / `chunk` 的 `Uint8Array` 打 `btoa(String.fromCharCode(...))` 填入（注意大帧需分片或改用文件引用）。

**从本地 MP4 生成 avcC + Annex-B 样本：** 输出目录自定；推荐 **`wasm/02-emcc-glue/mock/generated/`**（已在仓库根 `.gitignore` 中忽略，不会进 Git）。也可写到任意路径（例如本机被 ignore 的目录）。

```bash
python3 wasm/02-emcc-glue/mock/tools/extract-fixtures-from-mp4.py /path/to/video.mp4 wasm/02-emcc-glue/mock/generated
```

**从一张图片生成同一套 mock（先编码成单帧 H.264 MP4 再提取）：**

```bash
python3 wasm/02-emcc-glue/mock/tools/extract-fixtures-from-image.py /path/to/photo.png wasm/02-emcc-glue/mock/generated
```

产出：

- `avcC-from-mp4.bin` / `avcC-from-mp4.b64.txt`：与 `wasm_video_config` / WebCodecs `description` 同源。
- `sample-annexb-short.h264`：短 Annex-B 元数据流。
- `chunk-first-idr-avcc.bin` / `chunk-first-idr-avcc.b64.txt`：**首个 IDR** 的 **4 字节长度大端 + NAL**，对应 `FlvDemuxEvent` 的 `chunk.data` / `wasm_video_chunk`（若前 0.2s 内无 IDR，会自动再扫 **前 2s** 并生成 `sample-annexb-2s.h264`）。

**浏览器烟测页**（与 HTML 分目录，本目录只放数据与脚本）：见 **[../browser/README.md](../browser/README.md)**（`load.html`、`api-smoke.html`、`fixtures-decode.html`、`fixtures-i420-webgl.html`）。

写入 WASM 堆时请用全局 **`HEAPU8`**（或 `globalThis.HEAPU8`），不要用 `Module.HEAPU8`（Emscripten 5 生成物通常未挂载到 `Module`）。
