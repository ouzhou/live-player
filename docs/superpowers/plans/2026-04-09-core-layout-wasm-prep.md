# `@live-player/core` 目录结构重构 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 **不改变行为与对外导出** 的前提下，将 `packages/core/src` 从扁平文件改为 [`2026-04-09-core-layout-wasm-prep-design.md`](../specs/2026-04-09-core-layout-wasm-prep-design.md) 中的分层目录；**不**接入 WASM、不改 demux 事件模型。

**Architecture:** 使用 **`git mv` 搬迁** 并 **一次性更新全部相对 import**，避免中间态无法通过 `vp check`。**`tests/`** 与 **`src/`** 子目录镜像；**`decoding/wasm/`** 仅 `.gitkeep`。`apps/website` 只依赖 `@live-player/core` 包入口，**无需改应用**。

**Tech Stack:** TypeScript、`vite-plus`（`vp check`、`vp test`、`vp pack`）、pnpm workspace。

**依据 spec：** [`docs/superpowers/specs/2026-04-09-core-layout-wasm-prep-design.md`](../specs/2026-04-09-core-layout-wasm-prep-design.md)

---

## 文件结构（搬迁后）

| 新路径                                                           | 原路径                                        |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `packages/core/src/util/byte-buffer.ts`                          | `packages/core/src/byte-buffer.ts`            |
| `packages/core/src/codec-params/aac-codec-string.ts`             | `packages/core/src/aac-codec-string.ts`       |
| `packages/core/src/codec-params/avc-codec-string.ts`             | `packages/core/src/avc-codec-string.ts`       |
| `packages/core/src/demux/flv-demux.ts`                           | `packages/core/src/flv-demux.ts`              |
| `packages/core/src/decoding/webcodecs/video-decoder-pipeline.ts` | `packages/core/src/video-decoder-pipeline.ts` |
| `packages/core/src/decoding/webcodecs/audio-decoder-pipeline.ts` | `packages/core/src/audio-decoder-pipeline.ts` |
| `packages/core/src/playback/audio-playback.ts`                   | `packages/core/src/audio-playback.ts`         |
| `packages/core/src/player/live-player.ts`                        | `packages/core/src/live-player.ts`            |
| `packages/core/src/decoding/wasm/.gitkeep`                       | （新建）                                      |

**测试文件镜像**

| 新路径                                                      | 原路径                                         |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `packages/core/tests/util/byte-buffer.test.ts`              | `packages/core/tests/byte-buffer.test.ts`      |
| `packages/core/tests/codec-params/aac-codec-string.test.ts` | `packages/core/tests/aac-codec-string.test.ts` |
| `packages/core/tests/codec-params/avc-codec-string.test.ts` | `packages/core/tests/avc-codec-string.test.ts` |
| `packages/core/tests/demux/flv-demux.test.ts`               | `packages/core/tests/flv-demux.test.ts`        |
| `packages/core/tests/index.test.ts`                         | （不移动）                                     |

---

### Task 1: 占位目录 `decoding/wasm/`

**Files:**

- Create: `packages/core/src/decoding/wasm/.gitkeep`

- [ ] **Step 1: 创建空占位文件**

创建 `packages/core/src/decoding/wasm/.gitkeep`（空文件）。

- [ ] **Step 2: 提交**

```bash
git add packages/core/src/decoding/wasm/.gitkeep
git commit -m "chore(core): add decoding/wasm placeholder directory"
```

---

### Task 2: 原子搬迁 `src/` 与 `tests/` 并修正全部 import

**说明：** 以下 **`git mv` 与编辑应在同一工作区提交中完成**，再运行 `vp check` / `vp test`，避免出现「`aac-codec-string` 已搬走但 `flv-demux` 仍写 `./aac-codec-string`」等中间断裂态。

- [ ] **Step 1: `git mv` 所有源文件与测试文件**

在仓库根目录执行：

```bash
git mv packages/core/src/byte-buffer.ts packages/core/src/util/byte-buffer.ts
git mv packages/core/src/aac-codec-string.ts packages/core/src/codec-params/aac-codec-string.ts
git mv packages/core/src/avc-codec-string.ts packages/core/src/codec-params/avc-codec-string.ts
git mv packages/core/src/flv-demux.ts packages/core/src/demux/flv-demux.ts
git mv packages/core/src/video-decoder-pipeline.ts packages/core/src/decoding/webcodecs/video-decoder-pipeline.ts
git mv packages/core/src/audio-decoder-pipeline.ts packages/core/src/decoding/webcodecs/audio-decoder-pipeline.ts
git mv packages/core/src/audio-playback.ts packages/core/src/playback/audio-playback.ts
git mv packages/core/src/live-player.ts packages/core/src/player/live-player.ts

git mv packages/core/tests/byte-buffer.test.ts packages/core/tests/util/byte-buffer.test.ts
git mv packages/core/tests/aac-codec-string.test.ts packages/core/tests/codec-params/aac-codec-string.test.ts
git mv packages/core/tests/avc-codec-string.test.ts packages/core/tests/codec-params/avc-codec-string.test.ts
git mv packages/core/tests/flv-demux.test.ts packages/core/tests/demux/flv-demux.test.ts
```

（若 Task 1 已创建 `decoding/wasm/.gitkeep`，`decoding/` 已存在；否则先 `mkdir -p packages/core/src/decoding/webcodecs packages/core/src/decoding/wasm packages/core/src/playback packages/core/src/player packages/core/src/demux packages/core/src/util packages/core/src/codec-params` 再 `git mv`。）

- [ ] **Step 2: 编辑 `packages/core/src/demux/flv-demux.ts` 文件头**

```typescript
import { audioSpecificConfigToCodecString } from "../codec-params/aac-codec-string.ts";
import { avcDecoderConfigurationRecordToCodecString } from "../codec-params/avc-codec-string.ts";
```

- [ ] **Step 3: 编辑 `packages/core/src/decoding/webcodecs/audio-decoder-pipeline.ts` 第一行**

```typescript
import { audioSpecificConfigToDecoderParams } from "../../codec-params/aac-codec-string.ts";
```

- [ ] **Step 4: 编辑 `packages/core/src/player/live-player.ts` 文件头**

```typescript
import { AudioDecoderPipeline } from "../decoding/webcodecs/audio-decoder-pipeline.ts";
import { AudioPlayback } from "../playback/audio-playback.ts";
import { GrowableBuffer } from "../util/byte-buffer.ts";
import { FlvDemuxer } from "../demux/flv-demux.ts";
import { VideoDecoderPipeline } from "../decoding/webcodecs/video-decoder-pipeline.ts";
```

- [ ] **Step 5: 编辑 `packages/core/src/index.ts` 全文**

```typescript
export { LivePlayer, type PlayerOptions } from "./player/live-player.ts";
```

- [ ] **Step 6: 编辑测试 import**

`packages/core/tests/util/byte-buffer.test.ts`：

```typescript
import { GrowableBuffer } from "../../src/util/byte-buffer.ts";
```

`packages/core/tests/codec-params/aac-codec-string.test.ts`（保留原 `vite-plus/test` import，只改第二段）：

```typescript
import {
  audioSpecificConfigToCodecString,
  audioSpecificConfigToDecoderParams,
} from "../../src/codec-params/aac-codec-string.ts";
```

`packages/core/tests/codec-params/avc-codec-string.test.ts`：

```typescript
import { avcDecoderConfigurationRecordToCodecString } from "../../src/codec-params/avc-codec-string.ts";
```

`packages/core/tests/demux/flv-demux.test.ts`：

```typescript
import { audioSpecificConfigToCodecString } from "../../src/codec-params/aac-codec-string.ts";
import { avcDecoderConfigurationRecordToCodecString } from "../../src/codec-params/avc-codec-string.ts";
import { FlvDemuxer } from "../../src/demux/flv-demux.ts";
```

`packages/core/tests/index.test.ts`：**保持** `import { LivePlayer } from "../src/index.ts";`（路径不变）。

- [ ] **Step 7: 运行校验**

```bash
cd packages/core
vp check
vp test
vp pack
```

**预期：** 全部成功，无类型错误，测试全绿。

- [ ] **Step 8: 提交**

```bash
git add packages/core
git commit -m "refactor(core): layered src layout for demux/decoding/playback/player"
```

---

### Task 3（可选）: 文档路径

**Files:**

- Modify: `docs/architecture-demux-decoders.md`

- [ ] **Step 1:** 更新 §6 表格中指向 `packages/core/src/...` 的路径，使其与 Task 2 后一致（例如 `demux/flv-demux.ts`、`player/live-player.ts`）。

- [ ] **Step 2:**

```bash
git add docs/architecture-demux-decoders.md
git commit -m "docs: update core paths after layout refactor"
```

---

### Task 4（可选）: 根目录 website 构建

- [ ] **Step 1:**

```bash
cd /path/to/live-player
pnpm exec vp run website#build
```

**预期：** 构建成功（验证 workspace 对 `@live-player/core` 的解析正常）。

---

## Spec 对照自检

| Spec 要求                | 对应                   |
| ------------------------ | ---------------------- |
| 目录树与占位             | Task 1 + Task 2        |
| 对外仍导出 `LivePlayer`  | Task 2 `index.ts`      |
| 测试通过                 | Task 2 `vp test`       |
| 不接 WASM / 不改事件模型 | 无额外代码             |
| 中性类型不在此迭代       | 无编辑 `FlvDemuxEvent` |

---

## 计划自检

- 无 TBD；Task 2 为原子步骤，避免半搬迁导致的 import 断裂。
- `video-decoder-pipeline.ts` 无本地模块 import，搬迁后 **无需改内容**。

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-09-core-layout-wasm-prep.md`. Two execution options:**

**1. Subagent-Driven（推荐）** — 每个 Task 派生子代理，任务间审阅。

**2. Inline Execution** — 本会话或同一 worktree 内按 Task 顺序执行（Task 2 建议一次性做完再跑 `vp`）。

**你想用哪一种？** 若说「开始实现」，可在当前仓库直接执行 Task 1–2（及可选 Task 3–4）。
