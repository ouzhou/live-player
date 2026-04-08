# 阶段 1：HTTP-FLV 视频轨 + WebCodecs + Canvas — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@live-player/core` 中实现阶段 1 闭环：`fetch` 流式读 body → 自研 FLV 视频轨 demux（H.264/AVC）→ `VideoDecoder` → Canvas 连续出图；时间戳与 `EncodedVideoChunk.timestamp`（微秒）一致。

**Architecture:** `LivePlayer` 编排 `fetch`、可压缩增长缓冲、`FlvVideoDemuxer` 增量解析产出配置与编码帧事件；`VideoDecoderPipeline` 薄封装 `VideoDecoder` 与首帧 Canvas 尺寸；无多协议 Loader 工厂。阶段 0 的 `isConfigSupported` 规范化不在本迭代（见 spec 第 7 节）。

**Tech Stack:** TypeScript（`packages/core`）、`vite-plus`（`vp test` / `vp check` / `vp pack`）、浏览器 WebCodecs（`VideoDecoder` / `EncodedVideoChunk` / `VideoFrame`）、Canvas 2D。

**依据 spec：** [`docs/superpowers/specs/2026-04-08-phase1-webcodecs-video-design.md`](../specs/2026-04-08-phase1-webcodecs-video-design.md)

---

## 文件结构（创建 / 修改）

| 路径                                           | 职责                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/byte-buffer.ts`             | 可增长 `Uint8Array` 缓冲：追加、已用长度、丢弃前 `n` 字节并压缩。                                                                  |
| `packages/core/src/avc-codec-string.ts`        | 从 **AVCDecoderConfigurationRecord** 字节生成 `avc1.xxYYzz` codec 字符串（读 profile / compatibility / level）。                   |
| `packages/core/src/flv-video.ts`               | FLV 增量解析：头、`PreviousTagSize`、Tag 遍历；视频 Tag + CodecID 7 → AVC type 0/1；产出事件（配置或一块 NAL 聚合负载 + PTS ms）。 |
| `packages/core/src/video-decoder-pipeline.ts`  | `new VideoDecoder`、`configure`、`decode`、`close`；`output` 中调整 canvas 像素尺寸、`drawImage`、`videoFrame.close()`。           |
| `packages/core/src/live-player.ts`             | 替换占位：串联 fetch → buffer → demux → pipeline；错误与 `destroy` 清理。                                                          |
| `packages/core/src/index.ts`                   | 仅导出对外 API（保持 `LivePlayer` / `PlayerOptions`；内部模块可不导出）。                                                          |
| `packages/core/tests/byte-buffer.test.ts`      | 缓冲单元测试。                                                                                                                     |
| `packages/core/tests/avc-codec-string.test.ts` | codec 字符串单元测试。                                                                                                             |
| `packages/core/tests/flv-video.test.ts`        | FLV 合成字节 + demux 单元测试（不依赖 `VideoDecoder`）。                                                                           |
| `packages/core/tests/index.test.ts`            | 保留导出烟测；可增一条轻量断言（如 `LivePlayer` 仍存在）。                                                                         |

---

### Task 1: `GrowableBuffer`（`byte-buffer.ts`）

**Files:**

- Create: `packages/core/src/byte-buffer.ts`
- Create: `packages/core/tests/byte-buffer.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `packages/core/tests/byte-buffer.test.ts`：

```typescript
import { expect, test } from "vite-plus/test";
import { GrowableBuffer } from "../src/byte-buffer.ts";

test("GrowableBuffer append then consume compacts", () => {
  const b = new GrowableBuffer(4);
  b.append(new Uint8Array([1, 2]));
  b.append(new Uint8Array([3, 4, 5]));
  expect(b.used).toBe(5);
  b.consume(2);
  expect(b.used).toBe(3);
  expect(Array.from(b.view().subarray(0, 3))).toEqual([3, 4, 5]);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/core && vp test tests/byte-buffer.test.ts
```

预期：`GrowableBuffer` 未定义或导入失败。

- [ ] **Step 3: 最小实现**

创建 `packages/core/src/byte-buffer.ts`：

```typescript
/** 可增长字节缓冲：追加后顺序消费，消费后前移剩余数据。 */
export class GrowableBuffer {
  private buf: Uint8Array;
  private len = 0;

  constructor(initialCapacity = 64 * 1024) {
    this.buf = new Uint8Array(initialCapacity);
  }

  get used(): number {
    return this.len;
  }

  /** 当前有效数据的只读视图（长度 `used`）。 */
  view(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }

  append(chunk: Uint8Array): void {
    const need = this.len + chunk.length;
    if (need > this.buf.length) {
      let next = this.buf.length;
      while (next < need) next *= 2;
      const nextBuf = new Uint8Array(next);
      nextBuf.set(this.buf.subarray(0, this.len));
      this.buf = nextBuf;
    }
    this.buf.set(chunk, this.len);
    this.len += chunk.length;
  }

  /** 丢弃前 `n` 字节；将剩余数据移到偏移 0。 */
  consume(n: number): void {
    if (n < 0 || n > this.len) {
      throw new RangeError("consume out of range");
    }
    if (n === 0) return;
    if (n === this.len) {
      this.len = 0;
      return;
    }
    this.buf.copyWithin(0, n, this.len);
    this.len -= n;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd packages/core && vp test tests/byte-buffer.test.ts
```

预期：全部通过。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/byte-buffer.ts packages/core/tests/byte-buffer.test.ts
git commit -m "feat(core): add GrowableBuffer for streaming FLV bytes"
```

---

### Task 2: AVCDecoderConfigurationRecord → `avc1` codec 字符串

**Files:**

- Create: `packages/core/src/avc-codec-string.ts`
- Create: `packages/core/tests/avc-codec-string.test.ts`

- [ ] **Step 1: 编写失败测试**

`packages/core/tests/avc-codec-string.test.ts`：

```typescript
import { expect, test } from "vite-plus/test";
import { avcDecoderConfigurationRecordToCodecString } from "../src/avc-codec-string.ts";

/** 最小合法 avcC：version + profile + compat + level + 长度前缀与占位 NAL（长度可为 0 仅用于 codec 前三字节；若实现要求更严，可换用真实 SPS 样本）。 */
test("maps fixed avcC bytes to avc1 codec string", () => {
  const avcC = new Uint8Array([
    0x01, 0x42, 0xe0, 0x1e, 0xff, 0xe1, 0x00, 0x08, 0x67, 0x42, 0xe0, 0x1e, 0xab, 0xcd, 0xef, 0x01,
    0x01, 0x68, 0xef, 0xbe,
  ]);
  expect(avcDecoderConfigurationRecordToCodecString(avcC)).toBe("avc1.42E01E");
});
```

若第一步因 NAL 长度校验失败，在 Step 3 实现中按 **ISO 14496-15 avcC** 解析：至少读出 `configurationVersion`、profile、compat、level；**codec 字符串**为 `avc1.` + 三字节十六进制大写（与 Chromium 常见格式一致：`profile.toString(16).padStart(2,"0").toUpperCase()` 等）。

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/core && vp test tests/avc-codec-string.test.ts
```

- [ ] **Step 3: 实现**

`packages/core/src/avc-codec-string.ts`：

```typescript
/** 从 AVCDecoderConfigurationRecord（avcC）生成 WebCodecs 常用 `avc1.xxYYzz` 字符串。 */
export function avcDecoderConfigurationRecordToCodecString(avcC: Uint8Array): string {
  if (avcC.length < 4) {
    throw new Error("avcC too short");
  }
  const profile = avcC[1]!;
  const compat = avcC[2]!;
  const level = avcC[3]!;
  const h = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  return `avc1.${h(profile)}${h(compat)}${h(level)}`;
}
```

若测试数据含非法 NAL 长度，将 Step 1 中 `avcC` 改为从真实流录制的 **完整** AVCDecoderConfigurationRecord（十六进制数组），并固定期望 `avc1.42E01E`（或对应真实 profile）。

- [ ] **Step 4: 运行测试通过**

```bash
cd packages/core && vp test tests/avc-codec-string.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/avc-codec-string.ts packages/core/tests/avc-codec-string.test.ts
git commit -m "feat(core): derive avc1 codec string from avcC"
```

---

### Task 3: `FlvVideoDemuxer`（增量 FLV 视频轨）

**Files:**

- Create: `packages/core/src/flv-video.ts`
- Create: `packages/core/tests/flv-video.test.ts`

**约定（与实现一致，便于测）：**

- Tag 时间戳（毫秒）：`ts = tag[4] | (tag[5] << 8) | (tag[6] << 16) | (tag[7] << 24)`（Tag Header 11 字节内偏移相对 tag 起始为 4..7；StreamID 三字节在 8..10）。
- AVC 视频数据区：`FrameType+CodecID`（1 字节，CodecID 低 4 位为 7）、`AVCPacketType`（0/1）、`CompositionTime` 三字节 **有符号** 大端风格：`ct = (d0 << 16) | (d1 << 8) | d2`，若 `ct & 0x800000` 则 `ct |= ~0xffffff`。**PTS(ms) = ts + ct`**。
- type 0：`description` 为 **AVCDecoderConfigurationRecord** 原样 `Uint8Array`；事件携带 `ptsMs`。
- type 1：将一个 Tag 内所有 **length-prefixed NAL** 拼成一段 **AVCC** 连续字节（无 Annex-B start code），作为一帧 `data`；`keyFrame` 由 FrameType 高 4 位是否为 1 判断。

导出类型与解析器（**跨多次 `parse` 保留状态**：是否已消费 FLV 头、`PreviousTagSize0` 等）：

```typescript
export type FlvVideoEvent =
  | { kind: "config"; ptsMs: number; description: Uint8Array; codec: string }
  | { kind: "chunk"; ptsMs: number; data: Uint8Array; keyFrame: boolean }
  | { kind: "error"; message: string };

export class FlvVideoDemuxer {
  /** 从 `buffer` 偏移 0 起尽量解析；返回事件与从缓冲区头部消费的字节数。半包则 `consumed === 0`。 */
  parse(buffer: Uint8Array): { events: FlvVideoEvent[]; consumed: number };
}
```

`LivePlayer`：`append` 后 `while (true) { const { events, consumed } = demux.parse(buf.view()); buffer.consume(consumed); ... if (consumed === 0) break; }`，直至无进展再 `read()` 拉新字节。

- [ ] **Step 1: 编写失败测试**

在 `flv-video.test.ts` 中内联 **`buildMinimalFlvWithOneVideoConfig(avcC: Uint8Array): Uint8Array`**：写入 9 字节 FLV 头（`'FLV'`、版本 `0x01`、flags `0x05`、头长 `0x00000009`）、`PreviousTagSize0 = 0`（4 字节大端）；再写 11 字节 Tag 头（`type=9`、`dataSize` 为 `5 + avcC.length` 的 BE24、时间戳 0、StreamID 0）；Tag 数据区：`0x17`（关键帧+AVC）、`0x00`（sequence header）、CompositionTime `0x000000`；紧跟 `avcC`；最后写 **PreviousTagSize** = `11 + dataSize`（4 字节大端）。调用 `new FlvVideoDemuxer().parse(whole)`，断言：一条 `kind === "config"`，`codec === avcDecoderConfigurationRecordToCodecString(avcC)`，`description` 字节与 `avcC` 逐项相等。

- [ ] **Step 2: 运行测试失败**

```bash
cd packages/core && vp test tests/flv-video.test.ts
```

- [ ] **Step 3: 实现 `flv-video.ts`**

实现 FLV 头校验（`FLV`、版本 1）、跳过非 9 视频 Tag、解析 PreviousTagSize；视频非 H.264 可 `error` 或跳过（阶段 1 文档化：**非 7 则 `error` 并停止**）。

从 type 0 调用 `avcDecoderConfigurationRecordToCodecString`。

- [ ] **Step 4: 测试通过**

```bash
cd packages/core && vp test tests/flv-video.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/flv-video.ts packages/core/tests/flv-video.test.ts
git commit -m "feat(core): add FLV video AVC demuxer (incremental)"
```

---

### Task 4: `VideoDecoderPipeline`

**Files:**

- Create: `packages/core/src/video-decoder-pipeline.ts`

- [ ] **Step 1: 实现类（无 Node 单测；依赖浏览器 API）**

要点：

- `constructor(canvas: HTMLCanvasElement, onError: (e: Error) => void)`
- `configureFromAvc(description: Uint8Array, codec: string): void` → `VideoDecoder.isConfigSupported` **本迭代不要求**；直接 `decoder.configure({ codec, description })`（若硬解不支持，运行时 `error` 回调）。
- `decodeChunk(data: Uint8Array, timestampMicros: number, keyChunk: boolean): void` → `new EncodedVideoChunk({ type: keyChunk ? "key" : "delta", timestamp: timestampMicros, data })`，`decoder.decode(chunk)`。
- `output`：`ctx.drawImage(frame, 0, 0)`；首帧设置 `canvas.width` / `canvas.height` 为 `frame.displayWidth` / `frame.displayHeight`（或 `codedWidth`/`codedHeight`，以实际可用属性为准）；**随后** `frame.close()`。
- `close(): void`：`decoder.state !== "closed"` 时 `decoder.close()`。

- [ ] **Step 2: 提交**

```bash
git add packages/core/src/video-decoder-pipeline.ts
git commit -m "feat(core): add VideoDecoderPipeline for canvas output"
```

---

### Task 5: 串联 `LivePlayer.play`

**Files:**

- Modify: `packages/core/src/live-player.ts`
- Modify: `packages/core/tests/index.test.ts`（可选一行）

- [ ] **Step 1: 在 `play` 中**

1. 保留 `VideoDecoder` 存在性检查。
2. `fetch(url, { signal, mode: "cors" })`，`res.ok` 校验。
3. **不要**再 `res.body?.cancel()` 立即返回；改为 `const reader = res.body!.getReader()`。
4. `GrowableBuffer` + `FlvVideoDemuxer` + `VideoDecoderPipeline` 实例化（每次 `play` 新建 demux/pipeline，避免旧状态）。
5. 循环 `reader.read()`：将 `value` append 到 buffer；`while` 内 `demux.parse(buffer.view())` 直至 `consumed === 0`，每次 `buffer.consume(consumed)` 并处理 `events`；`config` → `pipeline.configureFromAvc`；`chunk` → `ptsMs * 1000` 微秒 → `decodeChunk`；`error` → `onError`、abort、break。
6. `catch`：`AbortError` 静默返回；其余 `onError`。
7. `stopFetchOnly` / `destroy`：abort、`pipeline.close()`、清空 buffer 引用。

- [ ] **Step 2: 运行检查与测试**

```bash
cd packages/core && vp check && vp test
```

预期：既有单测通过；无类型错误。

- [ ] **Step 3: 提交**

```bash
git add packages/core/src/live-player.ts packages/core/tests/index.test.ts
git commit -m "feat(core): wire HTTP-FLV video to WebCodecs in LivePlayer"
```

---

### Task 6: 站点与人工验收

**Files:**

- Modify: `apps/website/src/main.ts`（若需填入默认测试 URL 或说明）

- [ ] **Step 1:** 本地 `vp dev`（仓库根或 `apps/website` 按现有脚本）打开页面，填入 **稳定 HTTP-FLV（H.264）** URL，确认 Canvas **连续画面**。

- [ ] **Step 2:** 在 `scripts/run.md` 或 README 中已有命令处补充一行「验收：使用某公开测试流」**仅当** 仓库惯例允许外链；否则在 PR 描述中写明测试 URL（本计划不强制改文档，与用户规则「未要求不改 md」一致——**跳过文件修改**亦可）。

- [ ] **Step 3: 提交**（若有文档/演示改动）

```bash
git add -A
git commit -m "chore(website): verify LivePlayer FLV playback"
```

---

## 计划自检（对照 spec）

| Spec 章节                       | 对应任务                          |
| ------------------------------- | --------------------------------- |
| 字节缓冲                        | Task 1 + Task 5                   |
| FLV 视频轨 demux / AVC          | Task 3                            |
| 时间戳 μs                       | Task 3（PTS ms）+ Task 5（×1000） |
| Canvas / `close()`              | Task 4                            |
| 阶段 0 不交付 isConfigSupported | Task 4（仅 `configure`）、Task 5  |
| 单元测试 flv                    | Task 1–3                          |
| 无新 npm 依赖                   | 全任务                            |

**占位符扫描：** 计划中任务均给出可运行命令与代码骨架；Task 3 的「最小 FLV」十六进制由实现者在测试内用 `buildMinimalFlvVideoConfigTag` 填实，**不得**留 TBD。

---

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-04-08-phase1-webcodecs-video.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
