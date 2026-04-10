# WASM glue

When `decodeMode: "wasm"`, `LivePlayer` loads **`/wasm/shell.js`** (and **`shell.wasm`** in the same directory).

**`shell.js` / `shell.wasm` are checked in** so production builds can serve static assets without local Docker.

To refresh WASM:

1. Follow steps 1–2 in [wasm/PACKAGING.md](../../../wasm/PACKAGING.md).
2. Copy **`wasm/artifacts/emcc-glue/shell.js`** and **`shell.wasm`** into this directory and commit.

During development, `vp dev` serves files from `public/` as static assets.
