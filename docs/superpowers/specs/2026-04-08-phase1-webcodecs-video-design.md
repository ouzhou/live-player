# 阶段 1：HTTP-FLV 视频轨 + WebCodecs + Canvas — 设计说明

**状态**：已评审（brainstorming）  
**依据**：[`roadmap-webcodecs-sdk.md`](../../roadmap-webcodecs-sdk.md) 阶段 1  
**参考思路**：[langhuihui/jessibuca](https://github.com/langhuihui/jessibuca) 的「流 → 解封装 → 解码 → 呈现」分层（本仓库阶段 1 **不**引入多协议 Loader 工厂）。

---

## 1. 目标与完成标准

**目标**：在浏览器内实现 **HTTP-FLV 仅视频轨** 的最小闭环：**`fetch` 流式读 body** → **FLV demux（H.264/AVC）** → **`VideoDecoder`** → **Canvas 绘制**，时间戳与 `EncodedVideoChunk` 一致。

**完成标准**（与路线图一致）：在稳定测试流上 **连续出图**；**不要求** 音频、不要求音画同步。

---

## 2. 范围与非目标

**范围内**

- 自实现 **仅视频轨** 所需 FLV 解析（无新增 npm 依赖）。
- 最小模块拆分（见第 3 节），**不**为 WebSocket/WebRTC 等预留 Loader 抽象工厂。
- `VideoFrame` 绘制后 **立即 `close()`**。

**非目标（本迭代不交付）**

- 音频轨、AAC、`AudioDecoder`、Web Audio。
- 音画同步、jitter buffer、主时钟。
- 阶段 0 的完整能力矩阵：`VideoDecoder.isConfigSupported` 的规范化探测与「不支持 / 配置非法」细分错误码（见第 7 节）。
- 花屏/IDR 恢复等进阶策略（路线图阶段 4）。

---

## 3. 架构与模块

采用 **「编排 + 叶子模块」**：`LivePlayer` 负责 `fetch`、缓冲、驱动解析与解码；FLV 与 WebCodecs 细节落在独立文件中，便于用合成字节测试 demux。

| 模块                                | 职责                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `live-player.ts`                    | `play(url)` / `stop` / `destroy`；`AbortController`；维护字节缓冲；循环：追加 body → 调用 FLV 增量解析 → 根据事件配置/喂帧 → 解码输出画 Canvas；统一 `onError`。                                                          |
| `flv-video.ts`（名称可微调）        | 增量解析 FLV：头、Tag 遍历；跳过非视频 Tag；**CodecID = 7（H.264）** 时解析 AVC 包：**AVCPacketType 0** → `description` 与 codec 信息；**type 1** → 按 AVCC 长度前缀拆 NAL，组装送入 `EncodedVideoChunk` 的负载与时间戳。 |
| `video-decoder-pipeline.ts`（可选） | 薄封装：`configure` / `decode` / `flush` / `close`，减少 `live-player` 内 WebCodecs 样板代码。                                                                                                                            |

**与 jessibuca 的对应关系**：概念上对齐 **IO（fetch）→ demux（flv-video）→ decode（VideoDecoder）→ 渲染（Canvas）**；阶段 1 **不**实现其「协议 Loader 工厂」形态。

---

## 4. 字节缓冲

- 使用 **单一可增长** `Uint8Array`（或等价）+ 逻辑已用长度 `used`；流式 chunk **追加**到尾部。
- 解析器顺序消费已对齐数据；剩余半包 **前移压缩**（`copyWithin` 或拷贝），避免无限增长。
- 阶段 1 **不**实现环形缓冲或多段链表，除非后续实测拷贝成为瓶颈。

---

## 5. 时间戳与编码负载

**FLV**

- 从 Tag Header 计算 **毫秒级** 时间戳（24 位 + Extended 共 32 位）。
- AVC 包内 **CompositionTime**（24 位有符号，ms）：**PTS（ms）≈ Tag 时间戳 + CompositionTime**。

**WebCodecs**

- `EncodedVideoChunk.timestamp` 使用 **微秒**：`round(pts_ms * 1000)`。
- `duration`：阶段 1 **省略**（`undefined`），除非零成本且利于调试。

**H.264**

- **type 0**：`AVCDecoderConfigurationRecord` → `VideoDecoderConfig` 的 `codec`、`description`。
- **type 1**：NAL 为 **4 字节大端长度 + NAL 数据**；拼接为 **AVCC 连续字节**作为 `EncodedVideoChunk` 的 `data`（与 `avc1` 常见用法一致）。

---

## 6. Canvas、错误与生命周期

**Canvas**

- 首帧到达时按 `VideoFrame` 的显示尺寸设置 **canvas 像素宽高**，再 `drawImage`；样式可与现有站点一致（如宽 100%、maxWidth）。
- 每帧 **`drawImage` 后 `VideoFrame.close()`**。

**错误**

- 网络与中止：保持现有 `fetch` / `AbortError` 行为。
- FLV 损坏或长期无法闭合：`onError`，停止读流与解码。
- `VideoDecoder` 错误：回调 `onError`，`close` 解码器并中止拉流；阶段 1 **不**做自动恢复。

**`destroy()`**

- 中止请求、关闭解码器、释放缓冲；若内部创建的 canvas 则从 DOM 移除。

---

## 7. 阶段 0 边界（本迭代）

按产品决策，**阶段 0 正规探测不并入本次交付**：仅保留 **环境中是否存在 `VideoDecoder`** 的检测（与当前占位行为一致）。**不**要求在本迭代实现 `VideoDecoder.isConfigSupported` 的完整路径或对失败原因的细分枚举；该部分在后续迭代补齐。

---

## 8. 测试策略

- **单元测试**：针对 `flv-video` 增量解析，使用 **最小手工构造字节**（含 FLV 头 + 少量 Tag，或从 Tag 边界切入的用例），验证跳过非视频、type 0 产出配置、type 1 产出负载与时间戳。
- **集成**：完整「fetch + 解码 + canvas」依赖浏览器与测试流；**不强制**在无 WebCodecs 的 CI 中跑通，可对 `LivePlayer` mock 或以本地 demo 人工验证。
- **验收**：仍以真实稳定测试流上 **连续出图** 为准。

---

## 9. 已确认的决策摘要

| 议题     | 选择                                                       |
| -------- | ---------------------------------------------------------- |
| 抽象层级 | **最小化**（不预留多协议 Loader 工厂）                     |
| FLV 实现 | **自研、零新依赖**（仅视频轨）                             |
| 阶段 0   | **延后**（本迭代不交付 `isConfigSupported` 规范化）        |
| 实现形态 | **推荐方案 2**：`LivePlayer` + `flv-video`（+ 可选薄封装） |

---

## 10. 自检记录

- **占位符**：无 TBD；不确定处已写明「可选」「阶段 1 省略」。
- **一致性**：与 `roadmap-webcodecs-sdk.md` 阶段 1 一致；阶段 0 边界与第 7 节显式声明。
- **范围**：单迭代可实施；未混入阶段 2/3/4/5 需求。
