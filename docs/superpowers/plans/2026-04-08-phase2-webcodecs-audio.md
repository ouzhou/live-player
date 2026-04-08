# 阶段 2：HTTP-FLV 音频轨 + AudioDecoder + Web Audio — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@live-player/core` 中实现阶段 2：在阶段 1 视频闭环上增加 **FLV AAC 音频轨 demux** → **`AudioDecoder`** → **Web Audio** 出声；**单一路径** `fetch` → `GrowableBuffer` → **统一增量 demux** → 视频 `VideoDecoderPipeline` + 音频 `AudioDecoderPipeline` + `AudioPlayback`；**主线程交付**，无 Worker。

**Architecture:** 将现有 `FlvVideoDemuxer` **演进为** `FlvDemuxer`（建议文件 `flv-demux.ts`），一次 Tag 扫描产出 **视频** `config`/`chunk` 与 **音频** `audio_config`/`audio_chunk`；新增 **`audioSpecificConfigToCodecString`**（`mp4a.40.x`）、**`AudioDecoderPipeline`**、**`AudioPlayback`**（`AudioContext` + `AudioBufferSourceNode` 链式调度）；`LivePlayer` 在 `play()` 内检测 `AudioDecoder`、**`audioContext.resume()`**，并在 `stop`/`destroy` 时关闭音视频解码器与音频图。

**Tech Stack:** TypeScript（`packages/core`）、`vite-plus`（`vp test` / `vp check`）、浏览器 WebCodecs（`AudioDecoder` / `EncodedAudioChunk` / `AudioData`）、Web Audio API。

**依据 spec：** [`docs/superpowers/specs/2026-04-08-phase2-webcodecs-audio-design.md`](../specs/2026-04-08-phase2-webcodecs-audio-design.md)

**工作树：** 若你使用 `using-git-worktrees` 为功能开隔离分支，可在该 worktree 内执行本计划；否则在当前克隆中按任务顺序提交即可。

---

## 文件结构（创建 / 修改）

| 路径                                           | 职责                                                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/aac-codec-string.ts`        | 从 **AudioSpecificConfig** 字节生成 WebCodecs 常用 **`mp4a.40.x`** `codec` 字符串（读取 **audioObjectType**，阶段 2 以 **AAC-LC** 为主）。                                                   |
| `packages/core/src/flv-demux.ts`               | **替换** `flv-video.ts`：同一增量解析器处理 FLV 头、Tag 遍历；**Tag 8** 且 **SoundFormat = AAC** 时解析 **AACPacketType 0/1**；**Tag 9** 保持现有 AVC 逻辑；产出 **联合事件**（见 Task 2）。 |
| `packages/core/src/flv-video.ts`               | **删除**（逻辑迁至 `flv-demux.ts`），或 **临时** `export { FlvDemuxer as FlvVideoDemuxer } from "./flv-demux.ts"` 过渡 — 本计划推荐 **直接删除** 并全仓改 import，避免双文件名混淆。         |
| `packages/core/src/audio-decoder-pipeline.ts`  | `AudioDecoder`：`configure` / `decode` / `close`；`output` 将 **`AudioData`** 交给 **`AudioPlayback.schedule`**，**`audioData.close()`** 在复制或调度后执行。                                |
| `packages/core/src/audio-playback.ts`          | **`AudioContext`**、**`GainNode`**、**`nextPlayTime`** 调度；**`close`** 断开节点并 `close()` context。                                                                                      |
| `packages/core/src/live-player.ts`             | 导入 `FlvDemuxer`；`play()` 内实例化音频管线；事件分支；**`AudioDecoder` 存在性**；**`resume()`**；清理顺序。                                                                                |
| `packages/core/tests/aac-codec-string.test.ts` | ASC → codec 字符串单元测试。                                                                                                                                                                 |
| `packages/core/tests/flv-demux.test.ts`        | **由** `flv-video.test.ts` **重命名/替换**：保留原视频用例 + 新增音频 Tag 合成字节用例。                                                                                                     |
| `packages/core/src/index.ts`                   | 仅导出对外 API（通常不变）。                                                                                                                                                                 |

---

### Task 1: `audioSpecificConfigToCodecString`（`aac-codec-string.ts`）

**Files:**

- Create: `packages/core/src/aac-codec-string.ts`
- Create: `packages/core/tests/aac-codec-string.test.ts`

**说明：** ISO 14496-3 **GASpecificConfig**：**audioObjectType** 为 **前 5 位**（`asc[0] >> 3`）。阶段 2 **不**实现 `audioObjectType === 31` 的扩展类型（若遇此情况 **`throw`** 并写明错误信息，便于后续扩展）。

- [ ] **Step 1: 编写失败测试**

`packages/core/tests/aac-codec-string.test.ts`：

```typescript
import { expect, test } from "vite-plus/test";
import { audioSpecificConfigToCodecString } from "../src/aac-codec-string.ts";

/** 常见 2 字节 ASC 样本：AAC-LC（object type 2）。 */
test("maps 2-byte ASC to mp4a.40.2", () => {
  const asc = new Uint8Array([0x12, 0x10]);
  expect(audioSpecificConfigToCodecString(asc)).toBe("mp4a.40.2");
});

test("throws on short ASC", () => {
  expect(() => audioSpecificConfigToCodecString(new Uint8Array([0x12]))).toThrow(/too short/);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/zhouou/Desktop/live-player/packages/core && vp test tests/aac-codec-string.test.ts
```

预期：函数未定义或导入失败。

- [ ] **Step 3: 最小实现**

`packages/core/src/aac-codec-string.ts`：

```typescript
/** 从 AudioSpecificConfig（ASC）生成 WebCodecs 常用 `mp4a.40.x` codec 字符串。 */
export function audioSpecificConfigToCodecString(asc: Uint8Array): string {
  if (asc.length < 2) {
    throw new Error("ASC too short");
  }
  const audioObjectType = (asc[0]! >> 3) & 0x1f;
  if (audioObjectType === 31) {
    throw new Error("Extended audio object type (31) is not supported in phase 2");
  }
  return `mp4a.40.${audioObjectType}`;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/zhouou/Desktop/live-player/packages/core && vp test tests/aac-codec-string.test.ts
```

- [ ] **Step 5: 提交**

```bash
cd /Users/zhouou/Desktop/live-player
git add packages/core/src/aac-codec-string.ts packages/core/tests/aac-codec-string.test.ts
git commit -m "feat(core): derive mp4a codec string from AAC AudioSpecificConfig"
```

---

### Task 2: `FlvDemuxer`（合并音视频 Tag，`flv-demux.ts`）

**Files:**

- Create: `packages/core/src/flv-demux.ts`
- Delete: `packages/core/src/flv-video.ts`（在 Step 3 末尾删除并改 import）
- Rename / replace: `packages/core/tests/flv-video.test.ts` → `packages/core/tests/flv-demux.test.ts`

**FLV 音频 Tag 数据区（AAC）实现约定（与 FFmpeg / 常见实现一致）：**

- **`SoundFormat`** 在 **`body[0]` 的高 4 位**：`(body[0]! >> 4) & 0x0f === 10` 表示 **AAC**。
- **`body[1]`** = **`AACPacketType`**（**0** = ASC；**1** = raw 帧）。
- **`body.subarray(2)`** = **payload**（ASC 或 raw AAC）。
- **时间戳**：仅 Tag Header 的 **毫秒**时间戳（与视频共用 `readTagTimestampMs`）；**无** CompositionTime。

**联合事件类型（导出）：**

```typescript
export type FlvDemuxEvent =
  | { kind: "config"; ptsMs: number; description: Uint8Array; codec: string }
  | { kind: "chunk"; ptsMs: number; data: Uint8Array; keyFrame: boolean }
  | { kind: "audio_config"; ptsMs: number; description: Uint8Array; codec: string }
  | { kind: "audio_chunk"; ptsMs: number; data: Uint8Array }
  | { kind: "error"; message: string };

export class FlvDemuxer {
  parse(buffer: Uint8Array): { events: FlvDemuxEvent[]; consumed: number };
}
```

将 **`flv-video.ts`** 中 **`FlvVideoDemuxer`** 的 FLV 头、Tag 循环、`PreviousTagSize`、**Tag 9** AVC 分支 **原样迁入** `FlvDemuxer`，在 **`tagType === 8`** 时解析音频；其它 **非 8/9** Tag **continue**（仍 **推进 `o`**）。

**Tag 8 逻辑概要：**

1. `dataSize < 2` → `error`。
2. `soundFormat = (body[0]! >> 4) & 0x0f`；若 **`soundFormat !== 10`** → `events.push({ kind: "error", message: "Unsupported audio format (need AAC)" })`，**`return { events, consumed: o }`**（与视频非 H.264 行为一致：停止解析）。
3. `packetType = body[1]!`；`ptsMs = readTagTimestampMs(buffer, tagStart)`。
4. **`packetType === 0`**：`description = new Uint8Array(body.subarray(2))`；`codec = audioSpecificConfigToCodecString(description)`（`try/catch` 转 `error` 事件）；`events.push({ kind: "audio_config", ptsMs, description, codec })`。
5. **`packetType === 1`**：`events.push({ kind: "audio_chunk", ptsMs, data: new Uint8Array(body.subarray(2)) })`。
6. 其它 `packetType` → `error` 并 return。

- [ ] **Step 1: 将视频测试迁到 `flv-demux.test.ts` 并改类名**

1. 复制 `flv-video.test.ts` 为 `flv-demux.test.ts`。
2. 将 `FlvVideoDemuxer` 改为 **`FlvDemuxer`**，import 路径改为 **`../src/flv-demux.ts`**。
3. 新增 **`buildMinimalFlvWithOneAudioAsc(asc: Uint8Array): Uint8Array`**：在 13 字节 FLV 头与 `PreviousTagSize0` 之后，写 **一个音频 Tag**（`tagType = 8`），`dataSize = 2 + asc.length`，时间戳 0，数据区：**`0xAF`**（AAC + 常见 rate/size/type）、**`0x00`**（ASC）、**`asc`**；**PreviousTagSize** = `11 + dataSize`（大端）。调用 **`new FlvDemuxer().parse(whole)`**，断言：一条 **`kind === "audio_config"`**，**`codec === audioSpecificConfigToCodecString(asc)`**，**`description`** 字节与 **`asc`** 一致。

**`buildMinimalFlvWithOneAudioAsc` 参考骨架（按你缓冲区实际长度补齐 `p` 与 `writeU24BE`）：**

```typescript
function buildMinimalFlvWithOneAudioAsc(asc: Uint8Array): Uint8Array {
  const dataSize = 2 + asc.length;
  const tagTotal = 11 + dataSize + 4;
  const total = 13 + tagTotal;
  const out = new Uint8Array(total);
  let p = 0;
  out[p++] = 0x46;
  out[p++] = 0x4c;
  out[p++] = 0x56;
  out[p++] = 1;
  out[p++] = 5;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 9;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  const tagStart = p;
  out[p++] = 8;
  writeU24BE(out, p, dataSize);
  p += 3;
  for (let i = 0; i < 7; i++) out[p++] = 0;
  out[p++] = 0xaf;
  out[p++] = 0x00;
  out.set(asc, p);
  p += asc.length;
  const prev = 11 + dataSize;
  out[p++] = (prev >> 24) & 0xff;
  out[p++] = (prev >> 16) & 0xff;
  out[p++] = (prev >> 8) & 0xff;
  out[p++] = prev & 0xff;
  expect(p).toBe(out.length);
  return out;
}
```

再增加一条测试：**在仅有 **`audio_chunk`**（无 **`audio_config`**）的 FLV 片段上** 解析应产生 **`error`** 或至少 **`audio_chunk`** 前无 config — spec 要求「缺 ASC 报错」可在 **Task 6** `LivePlayer` 层做「首包 raw 则 error」；**demux 层**可只透传 chunk，**本 Task** 至少保证 **非法 SoundFormat** 产生 **`error`**。

- [ ] **Step 2: 运行测试失败**

```bash
cd /Users/zhouou/Desktop/live-player/packages/core && vp test tests/flv-demux.test.ts
```

- [ ] **Step 3: 实现 `flv-demux.ts` 并删除 `flv-video.ts`**

从 `flv-video.ts` 复制实现，按上文扩展 **Tag 8**；**类名** **`FlvDemuxer`**；**导出类型** **`FlvDemuxEvent`**。

- [ ] **Step 4: 测试通过**

```bash
cd /Users/zhouou/Desktop/live-player/packages/core && vp test tests/flv-demux.test.ts
```

- [ ] **Step 5: 提交**

```bash
cd /Users/zhouou/Desktop/live-player
git add packages/core/src/flv-demux.ts packages/core/tests/flv-demux.test.ts
git rm packages/core/src/flv-video.ts packages/core/tests/flv-video.test.ts
git commit -m "feat(core): unify FLV demuxer for AVC video and AAC audio tags"
```

---

### Task 3: `AudioDecoderPipeline`

**Files:**

- Create: `packages/core/src/audio-decoder-pipeline.ts`

**要点：**

- `constructor(onError: (e: Error) => void, onAudioData: (data: AudioData) => void)`
- `configureFromAsc(description: Uint8Array, codec: string): void` — `new AudioDecoder({ output: (data) => { onAudioData(data); }, error: ... })`，**`decoder.configure({ codec, description })`**。
- `decodeChunk(data: Uint8Array, timestampMicros: number): void` — `new EncodedAudioChunk({ type: "key", timestamp: timestampMicros, data })`（Chromium 对 AAC 常用 **`type: "key"`**）。
- `close(): void` — `decoder` 非 closed 则 **`decoder.close()`**。
- **`AudioData` 所有权：** **`output` 回调内不调用 `audioData.close()`**；由 **`AudioPlayback.schedule`**（Task 4）在复制/调度结束后 **`close`**，避免 **双 close**（与 Task 6 一致）。

- [ ] **Step 1: 添加上述类（无 Node 环境 WebCodecs 单测）**

- [ ] **Step 2: 提交**

```bash
cd /Users/zhouou/Desktop/live-player
git add packages/core/src/audio-decoder-pipeline.ts
git commit -m "feat(core): add AudioDecoderPipeline wrapper"
```

---

### Task 4: `AudioPlayback`

**Files:**

- Create: `packages/core/src/audio-playback.ts`

**调度逻辑（与 spec 第 6 节一致）：**

- 字段：`private ctx: AudioContext`、`private gain: GainNode`、`private nextTime = 0`。
- **`async ensureRunning(): Promise<void>`**：**`await this.ctx.resume()`**；若 **`this.ctx.state !== "running"`**，**`throw new Error("AudioContext could not start (state: " + this.ctx.state + ")")`**。
- **`schedule(audioData: AudioData): void`**：
  1. `const t = Math.max(this.nextTime, this.ctx.currentTime)`（若积压过大可把 **`t`** 钳到 **`currentTime`**，例如当 **`nextTime - currentTime > 2`** 时令 **`nextTime = currentTime`** — 任选一种简单策略并写进注释）。
  2. 将 **`AudioData`** 转为 **`AudioBuffer`**：`createBuffer(channels, frames, sampleRate)`，对每声道 **`copyTo`** **`Float32Array`**（**`format: "f32-planar"`**，**`planeIndex: ch`**），再 **`copyToChannel`**。
  3. **`const src = this.ctx.createBufferSource()`**；**`src.buffer = buf`**；**`src.connect(this.gain)`**；**`src.start(t)`**；**`this.nextTime = t + buf.duration`**。
  4. **`audioData.close()`** 放在 **成功构建 buffer 之后**（若中间抛错，仍应 **`close`** — 用 **`try/finally`**）。

- **`close(): void`**：**`src` 无法遍历停止**时可依赖 **`close` context**；**`this.ctx.close()`**，捕获已关闭异常。

- [ ] **Step 1: 实现类**

- [ ] **Step 2: 提交**

```bash
cd /Users/zhouou/Desktop/live-player
git add packages/core/src/audio-playback.ts
git commit -m "feat(core): add AudioPlayback scheduling for AudioData"
```

---

### Task 5: 串联 `LivePlayer.play`

**Files:**

- Modify: `packages/core/src/live-player.ts`

- [ ] **Step 1: 替换 import**

- `FlvVideoDemuxer` → **`FlvDemuxer`** from **`./flv-demux.ts`**。

- [ ] **Step 2: `play()` 开头能力检测**

在 **`VideoDecoder`** 检测之后增加：

```typescript
if (typeof globalThis.AudioDecoder === "undefined") {
  const err = new Error("AudioDecoder (WebCodecs) is not available in this environment");
  this.options.onError?.(err);
  throw err;
}
```

（若产品希望 **仅视频**环境仍可播放，可改为 **警告并跳过音频** — **本 spec 要求 AAC 通路**，故 **硬失败**。）

- [ ] **Step 3: 实例化管线**

每次 **`play`**：`const demux = new FlvDemuxer()`；**`const audioPlayback = new AudioPlayback()`**；**`await audioPlayback.ensureRunning()`**（**`try/catch`** → **`onError`**、abort）。

**`const audioPipeline = new AudioDecoderPipeline((e) => { ... }, (data) => audioPlayback.schedule(data))`**（第一个参数与 **`VideoDecoderPipeline`** 一样转发 **`onError`**）。

- [ ] **Step 4: 事件循环**

对 **`ev.kind`**：

- **`config`**： **`pipeline!.configureFromAvc(...)`**（与现有一致）。
- **`chunk`**：**`decodeChunk`**（与现有一致）。
- **`audio_config`**：**`audioPipeline.configureFromAsc(ev.description, ev.codec)`**。
- **`audio_chunk`**：若 **尚未 configure**（可用 **`audioPipeline` 私有标志或首次 decode 前检查**）→ **`onError(new Error("AAC chunk before AudioSpecificConfig"))`**，abort。
- **`audio_chunk`**：**`audioPipeline.decodeChunk(ev.data, Math.round(ev.ptsMs * 1000))`**。
- **`error`**：与现有一致。

- [ ] **Step 5: `finally` / `stopFetchOnly`**

**`pipeline?.close()`** 后增加 **`audioPipeline?.close()`**、**`audioPlayback?.close()`**（顺序：**先解码器，再 playback**，避免回调在关闭后触达）。

- [ ] **Step 6: 运行检查与测试**

```bash
cd /Users/zhouou/Desktop/live-player/packages/core && vp check && vp test
```

- [ ] **Step 7: 提交**

```bash
cd /Users/zhouou/Desktop/live-player
git add packages/core/src/live-player.ts packages/core/src/audio-decoder-pipeline.ts
git commit -m "feat(core): wire AAC demux and Web Audio in LivePlayer"
```

（若 Task 3 的 **`close`** 语义在 Task 5 有修改，一并包含在同一提交或前一提交中。）

---

### Task 6: 修正 `AudioDecoderPipeline` 与 `AudioPlayback` 的 `AudioData` 所有权（若 Task 5 发现重复 close）

**Files:**

- Modify: `packages/core/src/audio-decoder-pipeline.ts`
- Modify: `packages/core/src/audio-playback.ts`

- [ ] **Step 1:** 确保 **`AudioData` 恰好 `close` 一次**（推荐：**仅 `AudioPlayback.schedule` 在 `finally` 中 `close`**）。

- [ ] **Step 2:** `vp check && vp test`，提交 `fix(core): single AudioData close path`。

---

### Task 7: 站点与人工验收

**Files:**

- 可选：`apps/website/src/main.ts`（若需默认带音频的测试 URL）

- [ ] **Step 1:** 本地 **`vp dev`**，使用 **含 H.264 + AAC 的 HTTP-FLV** 流，确认 **有画面 + 有声音**；**音画不同步可接受**。

- [ ] **Step 2:** 无强制文档修改（与用户「未要求不改 md」一致）。

---

## 计划自检（对照 spec）

| Spec 章节                                         | 对应任务                 |
| ------------------------------------------------- | ------------------------ |
| 单一 demux、`consumed` 单路径                     | Task 2                   |
| ASC → codec + `description`                       | Task 1 + Task 5          |
| `EncodedAudioChunk` 微秒时间戳                    | Task 5                   |
| `AudioDecoder` + `AudioData` + Web Audio 简单队列 | Task 3–5                 |
| 非 AAC / FLV 错误 / 解码错误 → `onError`          | Task 2 + 5               |
| `AudioContext.resume` / suspended                 | Task 4–5                 |
| 主线程、无 Worker                                 | 全任务（无 Worker 文件） |
| 单元测试（音频 Tag 合成）                         | Task 1–2                 |

**占位符扫描：** 本计划不含 TBD；**SoundFormat** 取 **`(body[0] >> 4) & 0x0f`**，与 spec 文字「首字节含 SoundFormat」在实现上不等价处已在本计划 **Task 2** 写明。

**类型一致性：** **`FlvDemuxEvent`** 的 **`audio_config`/`audio_chunk`** 与 **`LivePlayer`** 分支一致；**`audioPipeline`** 与 **`audioPlayback`** 生命周期在 **Task 5** 成对出现。

---

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-04-08-phase2-webcodecs-audio.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
