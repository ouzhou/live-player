# 浏览器手动烟测（emcc glue）

需先完成 [../PACKAGING.md](../../PACKAGING.md) 步骤一、二，使 **`wasm/artifacts/emcc-glue/shell.js`** 存在；在仓库根目录起 HTTP 后打开下表 URL。

| 文件                           | 作用                                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| **`load.html`**                | 仅验证 `Module` / WASM 能加载                                         |
| **`api-smoke.html`**           | `wasm_get_version`、`wasm_init`、空包 `wasm_video_*` / `wasm_audio_*` |
| **`fixtures-decode.html`**     | 读 **`../mock/fixtures.json`** → 真实 H.264 解码路径（日志无画面）    |
| **`fixtures-i420-webgl.html`** | 同上 + **`wasm_copy_i420`** → WebGL2 显示                             |

fixtures 生成与字段说明见 **[../mock/README.md](../mock/README.md)**。
