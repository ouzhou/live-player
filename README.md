# live-player

在浏览器中播放 **HTTP-FLV（H.264 + AAC）** 的实验性 SDK：**自研 FLV demux** → **WebCodecs**（`VideoDecoder` / `AudioDecoder`）→ **Canvas** 与 **Web Audio**。工具链为 **Vite+**（`vp`），仓库为 pnpm monorepo。

## 仓库结构

| 路径            | 说明                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| `packages/core` | `@live-player/core`：`LivePlayer`、FLV 解析、解码与播放逻辑                             |
| `apps/website`  | 本地演示页，依赖 workspace 内的 `@live-player/core`                                     |
| `docs/`         | 路线图与设计文档（如 [`docs/roadmap-webcodecs-sdk.md`](docs/roadmap-webcodecs-sdk.md)） |
| `push-command/` | 用 ffmpeg 向 RTMP 循环推测试流（需自备 `2.mp4` 与 RTMP 服务）                           |

## 环境要求

- **Node.js** ≥ 22.12（见根目录 `package.json` 的 `engines`）
- 播放与开发需 **支持 WebCodecs** 的浏览器（如 Chromium 系）

## 开发命令

依赖安装与检查请使用 **Vite+**（勿直接用 pnpm/npm 装包，见 [`AGENTS.md`](AGENTS.md)）：

```bash
vp install
```

根目录常用脚本：

```bash
vp run dev          # 启动 website 开发服务
vp run ready        # 格式化、lint、递归 test + build（全绿再提交）
```

仅针对 core 包时，可在 `packages/core` 下执行：

```bash
vp test
vp check
```

## 本地联调推流（可选）

1. 在本机运行可收 **RTMP** 并出 **HTTP-FLV** 的媒体服务（如 Monibuca / SRS），使 HTTP 地址与演示页一致（默认示例为 `http://localhost:8080/flv/live/test`）。
2. 将测试文件放在 `push-command/2.mp4`，执行：

```bash
./push-command/stream-test-avc-loop.sh
```

默认推到 `rtmp://127.0.0.1:1935/live/test`，可通过环境变量 `RTMP_URL`、`SRC` 修改。

## 许可

以各子包 `package.json` 中的 `license` 字段为准（`@live-player/core` 当前为 MIT）。
