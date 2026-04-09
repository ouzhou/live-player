# Mock 数据

- **`fixtures.json`**：字段名与 [../API.md](../API.md) 中约定一致，值为 **base64**（空表示仅占位）。
- 本地联调：用真实拉流页把 `config` / `chunk` 的 `Uint8Array` 打 `btoa(String.fromCharCode(...))` 填入（注意大帧需分片或改用文件引用）。

**烟测页**：`harness.html`（需先执行两步打包，使 `artifacts/emcc-glue/shell.js` 存在）。
