# WebCodecs 播放器 SDK — 路线图

面向：在浏览器内实现 **HTTP-FLV（H.264 + AAC）** 等场景的播放器 SDK，解码走 **WebCodecs**（`VideoDecoder` / `AudioDecoder`），画面 **Canvas**，声音 **Web Audio**。

更细的方案对比与数据形态见同目录：

- [`web-playback-mse-wasm-webcodecs.md`](./web-playback-mse-wasm-webcodecs.md)
- [`http-flv-ffmpeg-wasm-pipeline.md`](./http-flv-ffmpeg-wasm-pipeline.md)

---

## 架构选项（主线与备选）

| 方案            | demux               | 解码             | 说明                                                                  |
| --------------- | ------------------- | ---------------- | --------------------------------------------------------------------- |
| **A（主线）**   | JS 或轻量库解析 FLV | WebCodecs        | 体积小、硬解为主；需正确处理时间戳与 NAL 边界。                       |
| **B（备选）**   | WASM 内 libavformat | WebCodecs        | demux 省事，WASM 体积与集成成本更高；适合多容器或复用 FFmpeg 生态。   |
| **C（非主线）** | 可同 B              | FFmpeg WASM 软解 | 与「WebCodecs SDK」目标不一致；可作对照或极老环境兜底（若产品需要）。 |

首发建议：**A**。

---

## 阶段 0：约束与能力探测

- 明确首发：**HTTP-FLV + H.264 + AAC**。
- 使用 `VideoDecoder.isConfigSupported` / `AudioDecoder.isConfigSupported` 探测 `codec` 与 `description`（含 SPS/PPS / ASC）。
- **完成标准**：目标浏览器上配置探测通过；失败时返回明确错误（不支持 / 配置非法）。

---

## 阶段 1：最小视频闭环

**目标**：解封装（视频轨）→ WebCodecs 解码 → 能看到连续画面。

- **拉流**：`fetch` 流式读取 body，缓冲增量字节。
- **FLV demux（视频）**：解析 Tag；**AVCPacketType 0** 得 **AVCDecoderConfigurationRecord**，配置 `VideoDecoder`；**AVCPacketType 1** 取 NAL，组 `EncodedVideoChunk`。
- **时间戳**：Tag 时间戳 + **CompositionTime** → 统一时间基（如微秒），与 `EncodedVideoChunk.timestamp` 一致。
- **渲染**：`VideoFrame` → `canvas.drawImage`，**及时 `close()`**。

**完成标准**：稳定测试流上连续出图；不要求音频、不要求音画同步。

---

## 阶段 2：音频通路

- **FLV demux（音频）**：**AACPacketType 0** → AudioSpecificConfig；**1** → raw AAC 帧。
- `AudioDecoder` → `AudioData` → **Web Audio** 播放（可先简单队列，阶段 3 再收紧）。
- 视情况将 demux/解码放入 **Worker**，减轻主线程压力。

**完成标准**：可单独听音；与视频同开时允许暂时不同步。

---

## 阶段 3：合并与音画同步

- 建立统一 **媒体时间轴**（相对 PTS，音视频同一 timebase）。
- 直播常见：**以音频为主时钟**，视频按 PTS 调度，必要时丢帧/重复帧追赶。
- 小 **jitter buffer** 吸收网络抖动。

**完成标准**：主观对齐；可再加量化指标（如唇音差阈值）做回归。

---

## 阶段 4：花屏、绿屏、撕裂等问题

| 现象          | 常见原因                   | 处理方向                                             |
| ------------- | -------------------------- | ---------------------------------------------------- |
| 绿屏 / 无画面 | 缺 SPS/PPS、未等关键帧     | 收齐 sequence header；IDR 前可黑屏或不解码显示       |
| 花屏 / 马赛克 | 丢包、NAL 截断、参考帧错误 | 长度校验；解码错误时等下一 IDR；协议支持时请求关键帧 |
| 撕裂 / 错位   | PTS/DTS 混用、乱序、B 帧   | 按 PTS 呈现；必要时小范围重排序缓冲                  |

---

## 阶段 5：SDK 化

- 对外 API：`play` / `destroy` / 事件或回调（错误、统计等）。
- 内部模块划分：**IO → demux → decode → clock → 渲染/出声**。
- 可选：不支持 WebCodecs 时 **MSE（FLV→fMP4）** 降级（见对比文档）。

---

## 建议迭代顺序（一句话）

**视频 demux + SPS/PPS + VideoDecoder + Canvas → AAC + AudioDecoder → 统一 PTS 与 Web Audio 同步 → 错误恢复与画质问题 → SDK 接口与可选降级。**
