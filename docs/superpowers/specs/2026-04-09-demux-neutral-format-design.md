# 中性 Demux 输出格式（HTTP-FLV → 解码后端）

**状态**：已定稿  
**前置**：[`architecture-demux-decoders.md`](../../architecture-demux-decoders.md)、[`packages/core/src/demux/flv-demux.ts`](../../../packages/core/src/demux/flv-demux.ts)  
**WASM C 边界对照**：[`wasm/02-emcc-glue/API.md`](../../../wasm/02-emcc-glue/API.md)

---

## 1. 目标与范围

**目标**：把 **单路 FLV 解封装** 产出的 **语义** 写清楚，使 **WebCodecs 适配** 与 **WASM/FFmpeg 适配**（及后续 mock 测试）对齐 **同一时间轴与帧边界**，而不强制各后端 **字节级相同**。

**范围内**

- 事件种类、字段含义、**时间单位**、**负载字节语义**（与当前 `FlvDemuxer` 行为一致）。
- 各后端 **最小适配责任**（谁做微秒换算、谁持有 `Uint8Array` 拷贝等）。

**范围外（本文件不定义）**

- FLV Tag 二进制布局（实现细节见 `flv-demux.ts`）。
- Worker 消息协议细节（可在专门文档扩展）。
- 音画同步策略、缓冲策略。

---

## 2. 核心类型：`FlvDemuxEvent`

中性输出为 **判别联合**（discriminated union），字段名与 `packages/core` 中 TypeScript 定义一致，便于单一真源。

| `kind`         | 含义                                                                                      | 额外字段                        |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| `config`       | 视频：**AVCDecoderConfigurationRecord**（avcC），可用于 WebCodecs `description`           | `ptsMs`, `description`, `codec` |
| `chunk`        | 视频：一帧 **AVC NAL 负载**（FLV 视频 Tag body 去掉 5 字节头之后；**非** Annex-B 起始码） | `ptsMs`, `data`, `keyFrame`     |
| `audio_config` | 音频：**AudioSpecificConfig（ASC）**                                                      | `ptsMs`, `description`, `codec` |
| `audio_chunk`  | 音频：**raw AAC access unit**（无 ADTS 头，与当前解析假设一致）                           | `ptsMs`, `data`                 |
| `error`        | 不可恢复或当前实现选择中止解析的错误                                                      | `message`                       |

---

## 3. 字段语义

### 3.1 时间戳 `ptsMs`

- **单位**：毫秒（**float 语义上的整数**：实现中使用 `number`，值为整毫秒）。
- **视频**：FLV Tag 时间戳 + **AVC CompositionTime**（SI24，毫秒）。与常见 HTTP-FLV 实现对齐。
- **音频**：FLV Tag 时间戳（无 CompositionTime）。
- **解码器侧**：WebCodecs 的 `EncodedVideoChunk` / `EncodedAudioChunk` 使用 **微秒** → **`timestamp = round(ptsMs * 1000)`**（与当前 `LivePlayer` 一致）。

### 3.2 `codec`（视频 / 音频 config）

- **视频**：**`avc1.xxYYzz`** 形态，由 **avcC** 推导（见 `codec-params/avc-codec-string.ts`）。
- **音频**：**`mp4a.40.x`**（如 AAC-LC），由 **ASC** 推导（见 `codec-params/aac-codec-string.ts`）。
- **用途**：主线程 WebCodecs `configure({ codec, description })`；WASM 首版可 **不传字符串**，仅传 `description` 字节（见 API.md）。

### 3.3 `description`

- **视频 `config`**：`Uint8Array` 为 **完整 avcC**（含 `configurationVersion`、长度前缀 SPS/PPS 等），**与** WebCodecs `VideoDecoder.configure({ description })` **同源**。
- **音频 `audio_config`**：`Uint8Array` 为 **ASC 原始字节**（与 `AudioDecoder.configure({ description })` 一致）。

### 3.4 视频 `chunk.data`

- **内容**：当前实现为 **单 Tag 内 AVC 视频 payload**（`AVCPacketType === 1`）去掉 **5 字节** FLV/AVC 头之后剩余字节，即 **长度前缀 NAL 单元拼接**（与喂给 `EncodedVideoChunk` 的 buffer 一致）。
- **关键帧**：`keyFrame === true` 表示 **关键帧**（FLV 语义：frame type 高位为 1）；非关键为 `delta`。

### 3.5 音频 `audio_chunk.data`

- **内容**：**AACPacketType === 1** 时 `body.subarray(2)`，视为 **raw AAC 帧**。

### 3.6 `error`

- 出现 `error` 事件时，解析器可能 **已消费部分输入**；调用方以 `parse()` 返回的 **`consumed`** 为准推进缓冲，**不要**假定整流可继续。

---

## 4. 后端适配责任

### 4.1 WebCodecs（当前默认路径）

| 阶段                 | 责任                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Demux                | 产出上表事件；**不负责** 微秒换算。                                                                            |
| 编排（`LivePlayer`） | `ptsMs` → 微秒；构造 `EncodedVideoChunk` / `EncodedAudioChunk`；`description` / `codec` 原样传入 `configure`。 |

### 4.2 WASM（未来）

| 阶段    | 责任                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Demux   | **同一套** `FlvDemuxEvent` 语义（见上）。                                                                                              |
| JS glue | 将 `Uint8Array` 拷入 WASM 线性内存；C 侧 **`pts_ms` 用 `double`**（与 `ptsMs` 一致）；见 [API.md](../../../wasm/02-emcc-glue/API.md)。 |
| WASM 内 | 可按 FFmpeg 需要再做 **Annex-B / bitstream filter**；**不**要求与 WebCodecs 字节路径相同。                                             |

---

## 5. 稳定性与演进

- **破坏性变更**（事件增删、字段重命名、`ptsMs` 定义变更）应 **版本化**（例如文档修订表 + changelog），并同步 **单测与 WASM API**。
- **增量兼容**：新增可选字段时，优先 **新增 `kind`** 或 **可选属性**，避免静默改变 `data` 语义。

---

## 6. 修订

| 日期       | 说明                                                     |
| ---------- | -------------------------------------------------------- |
| 2026-04-09 | 初稿：与当前 `FlvDemuxer` / `LivePlayer` / API.md 对齐。 |
