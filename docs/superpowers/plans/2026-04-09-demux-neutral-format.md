# 中性 Demux 类型真源与导出 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 **`FlvDemuxEvent`**（及 `FlvDemuxer.parse` 的返回类型）抽到独立模块 **`demux-events.ts`**，作为与 [`2026-04-09-demux-neutral-format-design.md`](../specs/2026-04-09-demux-neutral-format-design.md) 对应的 **单一类型真源**；`flv-demux.ts` 实现解析并 **重导出类型**；包入口 **可选** 导出类型，便于上层与测试引用。

**Architecture:** 类型与解析逻辑分离：**零运行时开销**（仅 `import type` / 常规 import）；不改变 `parse()` 行为与事件内容。

**Tech Stack:** TypeScript、`vite-plus`（`vp check`、`vp test`、`vp pack`）。

**依据 spec：** [`docs/superpowers/specs/2026-04-09-demux-neutral-format-design.md`](../specs/2026-04-09-demux-neutral-format-design.md)

---

## 文件结构

| 路径                                      | 职责                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/core/src/demux/demux-events.ts` | 定义 `FlvDemuxEvent`、`FlvDemuxParseResult`（或等价内联类型），JSDoc 指向设计文档。        |
| `packages/core/src/demux/flv-demux.ts`    | `import` 类型；`export type { FlvDemuxEvent }`（及 parse 结果类型）；`FlvDemuxer` 类不变。 |
| `packages/core/src/index.ts`              | `export type { FlvDemuxEvent }`（及若存在的公开 parse 结果类型名）。                       |

---

### Task 1: 新增 `demux-events.ts`

**Files:**

- Create: `packages/core/src/demux/demux-events.ts`

- [ ] **Step 1: 新建文件，内容与当前 `flv-demux.ts` 中类型定义一致**

`packages/core/src/demux/demux-events.ts`：

```typescript
/**
 * HTTP-FLV 解封装中性输出（与解码后端无关）。
 * @see ../../../../docs/superpowers/specs/2026-04-09-demux-neutral-format-design.md
 */
export type FlvDemuxEvent =
  | { kind: "config"; ptsMs: number; description: Uint8Array; codec: string }
  | { kind: "chunk"; ptsMs: number; data: Uint8Array; keyFrame: boolean }
  | { kind: "audio_config"; ptsMs: number; description: Uint8Array; codec: string }
  | { kind: "audio_chunk"; ptsMs: number; data: Uint8Array }
  | { kind: "error"; message: string };

/** `FlvDemuxer.parse` 的返回值。 */
export type FlvDemuxParseResult = {
  events: FlvDemuxEvent[];
  consumed: number;
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/core/src/demux/demux-events.ts
git commit -m "feat(core): add demux event types module"
```

---

### Task 2: `flv-demux.ts` 改用类型模块并重导出

**Files:**

- Modify: `packages/core/src/demux/flv-demux.ts`

- [ ] **Step 1: 替换文件开头的 `export type FlvDemuxEvent = ...` 块为：**

```typescript
import type { FlvDemuxEvent, FlvDemuxParseResult } from "./demux-events.ts";

export type { FlvDemuxEvent, FlvDemuxParseResult } from "./demux-events.ts";
```

- [ ] **Step 2: 将 `parse` 返回类型显式标注为 `FlvDemuxParseResult`**

方法签名：

```typescript
parse(buffer: Uint8Array): FlvDemuxParseResult {
```

（函数体不变。）

- [ ] **Step 3: 运行**

```bash
cd packages/core
vp check
vp test
```

**预期：** 通过。

- [ ] **Step 4: 提交**

```bash
git add packages/core/src/demux/flv-demux.ts
git commit -m "refactor(core): wire FlvDemuxer to demux-events types"
```

---

### Task 3: 包入口导出类型

**Files:**

- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 追加导出**

```typescript
export { LivePlayer, type PlayerOptions } from "./player/live-player.ts";
export type { FlvDemuxEvent, FlvDemuxParseResult } from "./demux/demux-events.ts";
```

- [ ] **Step 2: 运行**

```bash
cd packages/core
vp check
vp test
vp pack
```

**预期：** 通过；`dist/index.d.mts` 含上述类型。

- [ ] **Step 3: 提交**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export FlvDemuxEvent types from package entry"
```

---

## Spec 对照自检

| Spec 章节      | 任务                         |
| -------------- | ---------------------------- |
| 事件种类与字段 | Task 1 类型与现有实现一致    |
| 单一真源       | `demux-events.ts` + 文档链接 |

---

**Plan complete.** 执行可选：Subagent-Driven 或 Inline；合并为单次提交亦可，以 `vp test` 绿为准。
