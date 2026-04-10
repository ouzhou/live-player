# live-player

**语言：** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

实验性 **HTTP-FLV** 播放器 SDK：**视频 H.264 与 H.265（HEVC）**，音频 **AAC**。自研 FLV demux（含传统 H.265、Enhanced RTMP 等），**WebCodecs** 输出到 Canvas / Web Audio；可选**自行构建**的 FFmpeg **WASM + WebGL**，且**仅用于 H.264 软解**（见 [`wasm/PACKAGING.md`](wasm/PACKAGING.md)）。**本仓库不提供预构建的 `shell.js` / `shell.wasm`**（演示中 H.265 经 **WebCodecs** 播放，以降低专利/许可方面的分发风险）。**`@live-player/core` 不会发布到 npm registry。** 仓库为 **pnpm workspace**，工具链为 **Vite+**（`vp`）。

## 在线演示

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)**（对应 `apps/website`）

## 功能概览

- HTTP-FLV 拉流、自研 demux、**H.264 / H.265** 共用一条管线
- 视频 **`decodeMode`**：`auto`（存在 WASM 时首帧后在 WebCodecs ↔ WASM 间切换）| `webcodecs` | `wasm`（需本地构建产物，放在宿主 `public/wasm/` 或配置 `wasmScriptUrl`；本仓库不附带二进制）
- 音频：WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`**（`auto` / `avc` / `hevc`）、**`probeHttpFlv`**（只读流头、不解码）
- **`apps/website`**：React + Tailwind v4 + shadcn/ui 演示，直连 `@live-player/core` 源码

## 在项目中使用

**不提供 npm 包**：**`@live-player/core` 不会发布。** 请在本 monorepo 中以 workspace 使用、`pnpm link`、通过 Git 引用，或自行将 `packages/core` 拷入你的仓库。

### 最小示例

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

完整示例（探测、回调、停播等）见 **[`docs/using-live-player.md`](docs/using-live-player.md)**。

## 架构

**分层**：`apps/website` → 依赖 **`@live-player/core`**；若自行构建 WASM，将 [`wasm/`](wasm/) 产出拷贝到宿主 **`public/wasm/`**（或设置 `wasmScriptUrl`）。`public/wasm/` 下的可分发二进制**不作为本仓库提交内容**。

**管线**：HTTP 流式拉取 → **`FlvDemuxer`** → 视频 **WebCodecs 或 WASM**，音频 **WebCodecs** → Canvas / Web Audio。原则与 H.265 FLV 细节见 [`docs/architecture-demux-decoders.md`](docs/architecture-demux-decoders.md)、[`docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md`](docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md)。

```
HTTP → FLV demux（H.264 / H.265 + AAC）
         ↓
   视频：WebCodecs 或 WASM     音频：AudioDecoder
         ↓                           ↓
        Canvas / WebGL            Web Audio
```

## 本地联调推流（可选）

本机起 RTMP → HTTP-FLV（如 Monibuca、SRS），流地址可与演示默认 `http://localhost:8080/flv/live/test` 对齐。若有本地 **`push-command/`**（可能被 gitignore），按目录说明用 ffmpeg 推至 `rtmp://127.0.0.1:1935/live/test`。

## 许可

以各包 `package.json` 的 `license` 为准（`@live-player/core` 为 **MIT**）。
