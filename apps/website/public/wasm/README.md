# WASM 胶水（本地拷贝）

`decodeMode: "wasm"` 时，`LivePlayer` 会请求 **`/wasm/shell.js`**（及同目录 **`shell.wasm`**）。

请在本目录放入 **构建产物**（仓库默认不提交）：

1. 按 [wasm/PACKAGING.md](../../../wasm/PACKAGING.md) 执行步骤一、二。
2. 将 **`wasm/artifacts/emcc-glue/shell.js`** 与 **`shell.wasm`** 复制到此处。

开发时 `vp dev` 会从 `public/` 原样提供静态文件。
