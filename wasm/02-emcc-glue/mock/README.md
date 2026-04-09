# Mock 数据

- **`fixtures.json`**：字段名与 [../API.md](../API.md) 中约定一致，值为 **base64**（空表示仅占位）。
- 本地联调：用真实拉流页把 `config` / `chunk` 的 `Uint8Array` 打 `btoa(String.fromCharCode(...))` 填入（注意大帧需分片或改用文件引用）。

**从本地 MP4 生成 avcC + Annex-B 样本（不入库，可放在例如 `push-command/wasm-fixtures/`）：**

```bash
python3 wasm/02-emcc-glue/mock/tools/extract-fixtures-from-mp4.py /path/to/video.mp4 /path/to/out-dir
```

产出：`avcC-from-mp4.bin`（与 `wasm_video_config` / WebCodecs `description` 同源）、`sample-annexb-short.h264`（短 Annex-B 元数据流）、`avcC-from-mp4.b64.txt`（单行 base64，便于粘进 `fixtures.json`）。

**烟测页**：`harness.html`（需先执行两步打包，使 `artifacts/emcc-glue/shell.js` 存在）。写入 WASM 堆时请用全局 **`HEAPU8`**（或 `globalThis.HEAPU8`），不要用 `Module.HEAPU8`（Emscripten 5 生成物通常未挂载到 `Module`）。
