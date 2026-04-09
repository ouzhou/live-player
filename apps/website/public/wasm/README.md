# WASM 胶水

`decodeMode: "wasm"` 时，`LivePlayer` 会请求 **`/wasm/shell.js`**（及同目录 **`shell.wasm`**）。

**`shell.js` / `shell.wasm` 已纳入版本控制**，保证线上构建无需本地 Docker 即可提供静态资源。

更新 WASM 时：

1. 按 [wasm/PACKAGING.md](../../../wasm/PACKAGING.md) 执行步骤一、二。
2. 将 **`wasm/artifacts/emcc-glue/shell.js`** 与 **`shell.wasm`** 复制到本目录并提交。

开发时 `vp dev` 会从 `public/` 原样提供静态文件。
