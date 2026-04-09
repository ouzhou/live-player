# Mock 数据

- **`fixtures.json`**：字段名与 [../API.md](../API.md) 中约定一致，值为 **base64**（空表示仅占位）。
- 本地联调：用真实拉流页把 `config` / `chunk` 的 `Uint8Array` 打 `btoa(String.fromCharCode(...))` 填入（注意大帧需分片或改用文件引用）。

**从本地 MP4 生成 avcC + Annex-B 样本（不入库，可放在例如 `push-command/wasm-fixtures/`）：**

```bash
python3 wasm/02-emcc-glue/mock/tools/extract-fixtures-from-mp4.py /path/to/video.mp4 /path/to/out-dir
```

产出：

- `avcC-from-mp4.bin` / `avcC-from-mp4.b64.txt`：与 `wasm_video_config` / WebCodecs `description` 同源。
- `sample-annexb-short.h264`：短 Annex-B 元数据流。
- `chunk-first-idr-avcc.bin` / `chunk-first-idr-avcc.b64.txt`：**首个 IDR** 的 **4 字节长度大端 + NAL**，对应 `FlvDemuxEvent` 的 `chunk.data` / `wasm_video_chunk`（若前 0.2s 内无 IDR，会自动再扫 **前 2s** 并生成 `sample-annexb-2s.h264`）。

**烟测页**（需先执行两步打包，使 `artifacts/emcc-glue/shell.js` 存在）：

- **`harness.html`**：空指针 / 零长度 API 调用。
- **`fixture-harness.html`**：读 **`fixtures.json`** → **`wasm_video_config` / `wasm_video_chunk`**（真实 H.264 会解码，但本页不显示画面）。
- **`decode-yuv-webgl.html`**：**同一 fixtures** → 解码 **I420**，**WebGL2** 三纹理（Y/U/V）+ **片元 shader YUV→BT.601 系 RGB**，在 `<canvas>` 上显示 **真实画面**（需 WebGL2 与已构建的解码 WASM）。

写入 WASM 堆时请用全局 **`HEAPU8`**（或 `globalThis.HEAPU8`），不要用 `Module.HEAPU8`（Emscripten 5 生成物通常未挂载到 `Module`）。
