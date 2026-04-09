# `@live-player/core` 目录结构重构（WASM 准备，不接 WASM）

**状态**：已定稿（brainstorming）  
**依据**：[`architecture-demux-decoders.md`](../../architecture-demux-decoders.md)（单路 demux + 双适配）；用户确认 **单包 + 子目录**、**方案 A（按流水线分层）**。  
**本里程碑**：仅 **文件夹与模块边界**；**不**接入 Worker、`shell.js`、C++ / emcc；**中性事件类型大改**、**mock 二进制与 C++ 测试** 在数据格式另行定稿后开展。

---

## 1. 目标与完成标准

**目标**：在 **不改变当前播放行为** 的前提下，将 `packages/core` 从扁平 `src/*.ts` 调整为 **清晰子目录**，为后续 **中性 demux 输出 → 适配层 → WebCodecs / WASM** 预留对称位置。

**完成标准**：

- 对外 API 以 `packages/core/src/index.ts` 为准，**仍导出 `LivePlayer`（及既有公开类型）**；行为与重构前一致。
- **`vp test` / `vp check`**（或仓库约定的等价命令）通过。
- 本文档中的目录树在仓库中落实（允许实现阶段对 **空占位目录** 采用「不建目录 / 仅 `.gitkeep`」二选一，须在实现 PR 说明中写清）。

---

## 2. 范围与非目标

**范围内**

- **移动源文件**、**更新相对 import**、**测试路径与 `src` 对齐或保持可维护的一一对应**。
- **`decoding/wasm/`** 作为 **结构占位**（可选：空目录 + `.gitkeep`，或仅占位说明、实现时再建），**不包含**任何 WASM 加载、绑定或 mock 数据。

**非目标（本里程碑不交付）**

- WASM / Worker / `wasm/02-emcc-glue` 的 JS 对接。
- **中性 `FlvDemuxEvent` 等数据模型的重新设计**（与「数据格式」专项 spec 一起做）。
- **C++ 实现**、**mock 流与 fixtures 的二进制细节**（明确推迟到格式稳定后）。

---

## 3. 架构与目录树（方案 A）

与架构文档一致：**解封装（demux）→ 解码后端（当前仅 WebCodecs）→ 呈现（playback）→ 编排（player）**；编解码辅助（codec 字符串等）独立于具体解码器实现。

建议布局：

```text
packages/core/src/
  index.ts
  player/
    live-player.ts
  demux/
    flv-demux.ts
  decoding/
    webcodecs/
      video-decoder-pipeline.ts
      audio-decoder-pipeline.ts
    wasm/                    # 占位：未来 WASM 解码 glue（本阶段无实现）
  playback/
    audio-playback.ts
  util/
    byte-buffer.ts
  codec-params/
    avc-codec-string.ts
    aac-codec-string.ts
```

**模块职责简述**

| 路径                  | 职责                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `player/`             | `LivePlayer`：`fetch`、缓冲、驱动 demux、连接双轨解码与 `AudioPlayback`、生命周期与错误。 |
| `demux/`              | FLV 增量解析与事件（当前实现为 `FlvDemuxer`）。                                           |
| `decoding/webcodecs/` | `VideoDecoder` / `AudioDecoder` 薄封装。                                                  |
| `decoding/wasm/`      | 仅占位；未来对接 FFmpeg WASM 解码时放置 glue，**本 spec 不要求任何文件内容**。            |
| `playback/`           | Web Audio 播放队列等。                                                                    |
| `util/`               | 与容器无关的通用缓冲（如 `GrowableBuffer`）。                                             |
| `codec-params/`       | 从 ASC / SPS 等推导 WebCodecs `codec` / `description` 的纯逻辑，**不**依赖 WASM。         |

---

## 4. 数据流与错误处理

重构 **不改变** 既有语义：

**HTTP body → `GrowableBuffer` → `FlvDemuxer.parse` → 视频/音频事件 → `VideoDecoderPipeline` / `AudioDecoderPipeline` → Canvas / Web Audio**；错误经 `onError` 与 `AbortController`，与 `live-player.ts` 现有行为一致。

---

## 5. 测试

- 单元测试位于 `packages/core/tests/`，建议与 `src` **按模块镜像**（例如 `tests/demux/`、`tests/decoding/webcodecs/`…），或保持 **源文件与测试文件一一对应** 的命名约定；**验收以现有用例全部通过为准**。
- 本里程碑 **不**新增 WASM 或 mock 二进制相关测试。

---

## 6. 与仓库其他部分的关系

- **`wasm/`**（Docker、静态库、emcc）：**不**因本重构而修改构建流程；仅在文档上可交叉引用「未来 `decoding/wasm/` 与此目录产物的对接属于后续 spec」。
- **`docs/architecture-demux-decoders.md`**：仍为高层架构真源；若仅目录名变更，可在后续小步 PR 中增加「代码路径」一行指向 `packages/core/src/...`。

---

## 7. 修订

| 日期       | 说明                                                    |
| ---------- | ------------------------------------------------------- |
| 2026-04-09 | 初稿：单包分层目录、WASM 仅占位；明确非目标与完成标准。 |
