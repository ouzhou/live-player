# live-player

在浏览器里播放 **HTTP-FLV（H.264 + AAC）** 的实验性播放器 SDK：自研 **FLV demux**，经 **WebCodecs**（`VideoDecoder` / `AudioDecoder`）输出到 **Canvas** 与 **Web Audio**；也可选用 **WASM + WebGL** 视频路径。本仓库为 **pnpm workspace**，工具链统一使用 **Vite+**（`vp` 命令）。

## 在线演示

部署在 Vercel 上的演示页（与 `apps/website` 对应）：**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)**

## 功能概览

- HTTP-FLV 拉流与解析（自研 demux）
- 视频：WebCodecs 硬解 + Canvas 2D，或 WASM 解码 + WebGL（需部署 `public/wasm` 相关资源）
- 音频：WebCodecs `AudioDecoder` + Web Audio
- `apps/website`：基于 **React**、**Tailwind CSS v4** 与 **shadcn/ui** 的本地演示页，开发时直连 `@live-player/core` 源码便于调试

## 仓库结构

| 路径                             | 说明                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`packages/core`](packages/core) | npm 包 `@live-player/core`：`LivePlayer`、FLV 解析、解码与播放                                  |
| [`apps/website`](apps/website)   | 演示站点（Vite + React），依赖 workspace 内的 `@live-player/core`                               |
| [`docs/`](docs/)                 | 路线图、架构与实现笔记（例如 [`docs/roadmap-webcodecs-sdk.md`](docs/roadmap-webcodecs-sdk.md)） |

## 架构

### Monorepo 分层

- **应用层**：[`apps/website`](apps/website) 仅负责 UI 与演示流程，通过 npm 依赖引用 **`@live-player/core`**（workspace 下为本地包）。
- **SDK 层**：[`packages/core`](packages/core) 导出 `LivePlayer` 与类型，封装 **HTTP 拉流 → FLV 解封装 → 解码 → 渲染/出声**；可被任意 bundler 宿主（Vite、Next 等）引用。

### 播放管线（`@live-player/core`）

整体是一条 **HTTP-FLV** 直播管线：**流式拉取** → **`FlvDemuxer`** 解析 tag → **视频**与**音频**分流处理。

- **视频**（由 `decodeMode` 二选一，在 `LivePlayer` 构造时确定）
  - **`webcodecs`**：`VideoDecoderPipeline` → 浏览器 **WebCodecs**（`VideoDecoder`）→ **Canvas 2D** 绘制。
  - **`wasm`**：加载 Emscripten 胶水（默认 `public/wasm/shell.js`）→ **`WasmVideoPipeline`**（FFmpeg WASM + **WebGL2**，I420 等）→ canvas。
- **音频**：**`AudioDecoderPipeline`**（WebCodecs `AudioDecoder`）→ **`AudioPlayback`**（`AudioContext` 调度播放）。

解封装与双解码路径的设计原则（单路 demux、靠近解码器再做格式适配）见 **[`docs/architecture-demux-decoders.md`](docs/architecture-demux-decoders.md)**。

```
HTTP 拉流（流式读取 body）
        ↓
FLV 解封装（分离视频轨 / 音频轨 + 时间戳）
        ↓
┌───────────────────────┬────────────────────────┐
│ 视频：H.264 NAL       │ 音频：常见为 AAC       │
│ + AVC 序列头(SPS/PPS) │ （FLV 内封装）         │
└───────────────────────┴────────────────────────┘
        ↓                         ↓
  WebCodecs 或 WASM 解码      WebCodecs AudioDecoder
        ↓                         ↓
  Canvas 2D / WebGL2          AudioPlayback（Web Audio）
        ↓                         ↓
        └──────────┬──────────────┘
                   ↓
           画面显示 + Web Audio 出声
```

### `packages/core` 源码大致分层

| 目录 / 文件                                                                  | 职责                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`player/live-player.ts`](packages/core/src/player/live-player.ts)           | 对外 API：拉流、`FlvDemuxer` 驱动、视频管线与音频管线生命周期 |
| [`demux/`](packages/core/src/demux/)                                         | FLV 解封装与事件（如 `demux-events.ts`）                      |
| [`decoding/webcodecs/`](packages/core/src/decoding/webcodecs/)               | 视频 / 音频 WebCodecs 解码管线                                |
| [`decoding/wasm/`](packages/core/src/decoding/wasm/)                         | WASM 胶水加载与视频 WASM 管线                                 |
| [`playback/audio-playback.ts`](packages/core/src/playback/audio-playback.ts) | 解码后音频送入 Web Audio                                      |
| [`codec-params/`](packages/core/src/codec-params/)                           | AVC / AAC 等与解码器配置相关的辅助                            |

## 环境要求

- **Node.js** ≥ 22.12（见根目录 [`package.json`](package.json) 中的 `engines`）
- 播放与开发建议使用支持 **WebCodecs** 的浏览器（如 Chromium 系）

## 快速开始

依赖安装与日常命令请通过 **Vite+** 完成（不要绕过 `vp` 直接用 pnpm/npm 装包，详见 [`AGENTS.md`](AGENTS.md)）：

```bash
vp install
vp run dev          # 启动 website 开发服务
```

根目录一键检查（格式化、lint、全仓库 test + build）：

```bash
vp run ready
```

仅在 **core** 包内开发时，可进入 `packages/core` 执行：

```bash
vp test
vp check
```

生产构建演示站：在 `apps/website` 下执行 `vp run build`（脚本内含 `tsc` 与 `vp build`；因内置已有 `vp build`，需用 `vp run build` 跑完整脚本，见 [`AGENTS.md`](AGENTS.md)）。

## 本地联调推流（可选）

1. 在本机运行能收 **RTMP** 并输出 **HTTP-FLV** 的媒体服务（如 Monibuca、SRS），使流地址与演示页一致（默认示例为 `http://localhost:8080/flv/live/test`）。
2. 若你本地有 **`push-command/`** 目录（该路径可能在 [`.gitignore`](.gitignore) 中忽略），可将测试片源放入其中并按该目录说明用 ffmpeg 循环推流到 `rtmp://127.0.0.1:1935/live/test`（或通过环境变量自定义 RTMP 地址与片源路径）。

## 许可

以各子包 `package.json` 中的 `license` 字段为准（`@live-player/core` 当前为 **MIT**）。
