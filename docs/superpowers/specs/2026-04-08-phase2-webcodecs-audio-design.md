# 阶段 2：HTTP-FLV 音频轨 + AudioDecoder + Web Audio — 设计说明

**状态**：待评审（brainstorming）  
**依据**：[`roadmap-webcodecs-sdk.md`](../../roadmap-webcodecs-sdk.md) 阶段 2  
**前置**：[`2026-04-08-phase1-webcodecs-video-design.md`](./2026-04-08-phase1-webcodecs-video-design.md) 已交付的最小视频闭环。

---

## 1. 目标与完成标准

**目标**：在阶段 1 基础上增加 **FLV 音频轨（AAC）** 解封装 → **`AudioDecoder`** → **Web Audio** 出声；拉流与字节缓冲模型不变。

**完成标准**（与路线图一致）：

- **可单独听音**（稳定测试流上能连续听到声音）。
- **与视频同开时允许暂时不同步**（精确对齐留给阶段 3）。
- **阶段 2 全部在主线程**；**demux/解码进 Worker 不在本阶段交付**（后续迭代再考虑）。

---

## 2. 范围与非目标

**范围内**

- **单一增量 demux**（由 `flv-video.ts` 演进或合并为「同时处理音视频 Tag」的解析器）：对 **Tag 8（audio）** 在 **SoundFormat = AAC（10）** 时解析 **AACPacketType 0/1**；对 **Tag 9（video）** 保持现有 H.264/AVC 行为。
- **从 AudioSpecificConfig（ASC）推导** `AudioDecoder` 的 `codec` 字符串（如 **`mp4a.40.2`** 对应 AAC-LC）与 **`description`（ASC 字节）** 的小模块（命名可与 `avc-codec-string.ts` 对称）。
- **`AudioDecoderPipeline`**：薄封装 `configure` / `decode` / `close`；`output` 收到 **`AudioData`** 后交给播放层，**用毕 `close()`**。
- **`AudioPlayback`（或等价薄层）**：**`AudioContext`** + **简单队列**（例如 `AudioBufferSourceNode` 链式调度），阶段 3 可替换调度策略。
- **`LivePlayer`**：`play()` 中在 **`VideoDecoder`** 之外探测 **`AudioDecoder`**；统一 **`onError`**；`stop` / `destroy` 时释放音频图与解码器。

**非目标（本迭代不交付）**

- **音画同步**、主时钟、jitter buffer（阶段 3）。
- **Worker** 内 demux/解码（本阶段明确推迟）。
- **非 AAC** 音频轨（可 **显式报错**）。
- **花屏/IDR 恢复** 等视频进阶策略（阶段 4）。
- **SDK 化对外 API**（阶段 5）。

---

## 3. 架构与模块

采用与阶段 1 相同的 **「编排 + 叶子模块」**：`LivePlayer` 负责 `fetch`、缓冲、驱动解析与双轨解码；FLV 与 WebCodecs 细节落在独立文件中。

| 模块                                | 职责                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `live-player.ts`                    | `play` / `stopFetchOnly` / `destroy`；`AbortController`；`GrowableBuffer`；循环：追加 body → **统一 demux** → 视频事件喂 `VideoDecoderPipeline`、音频事件喂 `AudioDecoderPipeline` → 音频解码输出经 **`AudioPlayback`** 出声；统一 `onError`；启动时处理 **`AudioContext.resume()`** 与 suspended 诊断。 |
| `flv-video.ts`（或重命名）          | **增量解析 FLV**：头与 Tag 遍历；**Tag 8 + AAC**：**AACPacketType 0** → ASC（config 事件）；**1** → raw AAC 帧（chunk 事件）；**Tag 9**：保持现有 AVC 逻辑；其它 Tag 跳过但 **消费字节**。                                                                                                               |
| `aac-codec-string.ts`（或等价）     | 由 ASC 生成 **`codec`** 与校验用信息；供 `AudioDecoder.configure` 使用。                                                                                                                                                                                                                                 |
| `audio-decoder-pipeline.ts`         | 薄封装：`AudioDecoder` 的 `configure` / `decode` / `close`；错误回调到 `LivePlayer`。                                                                                                                                                                                                                    |
| `audio-playback.ts`（可选独立文件） | **`AudioContext`**、**GainNode**、**简单播放队列**（见第 6 节）；`close` 时断开/释放资源。                                                                                                                                                                                                               |

**与阶段 1 的关系**：概念上仍为 **IO（fetch）→ demux → decode → 呈现**；阶段 2 **不**引入多协议 Loader 工厂。

---

## 4. 字节缓冲

与阶段 1 **相同**：单一可增长缓冲 + `parse` 返回 **`consumed`** → **`buffer.consume(consumed)`**；**不**为音频单独第二条解析路径。

---

## 5. 时间戳与 AAC 负载

**FLV（音频 Tag）**

- 时间戳来源：**Tag Header** 与阶段 1 相同的 **毫秒**时间戳（无 AVC **CompositionTime** 三字节）。
- **首字节 `body[0]`**：含 **SoundFormat** 等；要求 **SoundFormat = 10（AAC）**，否则 **报错**。
- **`body[1]`**：**`AACPacketType`** — **0** = **AudioSpecificConfig**；**1** = **AAC 帧负载**。
- **负载起点**：**`body.subarray(2)`**。

**WebCodecs**

- **`EncodedAudioChunk.timestamp`**：**微秒**，`round(ts_ms * 1000)`，与视频轨一致，便于阶段 3 合并时间轴。
- **`duration`**：阶段 2 **可省略**（`undefined`），除非零成本且利于调试。

**AAC 负载语义**

- **`AACPacketType === 0`**：整段 payload 为 **ASC**，用于 `description` 与 codec 推导。
- **`AACPacketType === 1`**：假设为 **raw AAC access unit（无 ADTS）**，与常见 FFmpeg / HTTP-FLV 一致。若实机流为 **ADTS 封装**，列为 **后续兼容项**，**不**作为阶段 2 必达验收条件。
- **必须先收到 config 再解码 raw 帧**；否则 **报错**并停止。

---

## 6. Web Audio（简单队列）

**目标**：稳定出声；**不保证**与视频 PTS 对齐。

**建议实现**

- 每实例 **`AudioContext`**（或文档约定生命周期）；`play()` 内调用 **`audioContext.resume()`**，尽量与 **用户手势** 同栈；若仍为 **suspended**，通过 **`onError`** 或现有回调给出 **可诊断提示**（具体文案在实现计划中定）。
- 维护调度时间 **`nextPlayTime`**，且 **`nextPlayTime >= audioContext.currentTime`**。
- 每个 **`AudioData`**：拷贝为 **`AudioBuffer`**（按解码器输出格式与声道），**`AudioBufferSourceNode`** → **`GainNode`** → **`destination`**，**`start(nextPlayTime)`**，**`nextPlayTime += buffer.duration`**。
- 若积压过大，可采用 **简单丢尾或快进**（策略在实现计划中定，本设计只要求「可听、不崩溃」）。

**阶段 3 扩展点**：播放层保留 **可替换调度策略** 的注释或薄接口即可，避免过度抽象。

---

## 7. 错误与生命周期

**错误**

- 网络与中止：与阶段 1 一致（`fetch` / `AbortError`）。
- FLV 损坏、非 AAC 音频、**缺 ASC 即收到 raw 帧**、**AudioDecoder** `error`： **`onError`**，停止读流并 **关闭音视频解码器**；阶段 2 **不**做自动恢复。
- **`AudioContext` 无法恢复播放**：**`onError`** 或等价可观测行为。

**`stopFetchOnly` / `destroy`**

- **abort 拉流** → **关闭 `VideoDecoder` / `AudioDecoder`** → **停止向音频图推送** → **断开节点并 `close` AudioContext（若适用）**；若内部创建 canvas 则从 DOM 移除（阶段 1 行为保持）。

---

## 8. 阶段 0 边界（本迭代）

与阶段 1 一致：**不强制**在本迭代交付完整的 **`AudioDecoder.isConfigSupported` 规范化矩阵**；可在 `play` 前做 **存在性检测** 与 **尽力探测**，失败时 **`onError`** 即可。细分错误码可在后续迭代与路线图阶段 0 对齐。

---

## 9. 测试策略

- **单元测试**：针对 **音频 Tag** 的增量解析，使用 **最小手工构造字节**（仿 `flv-video.test.ts`），覆盖 **仅 ASC**、**ASC + 若干 raw 帧**、**非 AAC**、**缺 ASC** 等。
- **集成**：完整「fetch + 双轨解码 + 出声」依赖浏览器与测试流；**不强制**在无 WebCodecs 的 CI 中跑通。
- **验收**：真实稳定测试流上 **可听**；与视频同开时 **允许不同步**。

---

## 10. 已确认的决策摘要

| 议题        | 选择                                                                                |
| ----------- | ----------------------------------------------------------------------------------- |
| Demux 形态  | **单一增量解析器**，一条 `consumed`，同时产出音视频事件（brainstorming **方案 1**） |
| Worker      | **阶段 2 不做**（用户选择 **A：主线程**）                                           |
| 非 AAC      | **报错**，不兼容                                                                    |
| ADTS vs raw | **默认 raw**；ADTS 为后续兼容项                                                     |
| 同步        | **本阶段不要求**；阶段 3 建统一时间轴                                               |

---

## 11. 自检记录

- **占位符**：无 TBD；不确定处已标明「后续兼容」「实现计划」。
- **一致性**：与 `roadmap-webcodecs-sdk.md` 阶段 2 及阶段 1 设计文档一致；Worker 与非目标已显式排除。
- **范围**：单迭代可实施；未混入阶段 3/4/5 的主交付项。
