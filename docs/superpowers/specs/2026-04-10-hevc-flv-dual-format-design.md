# HEVC（HTTP-FLV）双封装 + WebCodecs / WASM + 网站手动选档

**状态**：已定稿（与对话 2026-04-10 结论一致）  
**前置**：[architecture-demux-decoders.md](../../architecture-demux-decoders.md)、[2026-04-09-demux-neutral-format-design.md](./2026-04-09-demux-neutral-format-design.md)

---

## 1. 目标与范围

**目标**

- 在 **不拆双路 demux** 的前提下，扩展 **`FlvDemuxer`**，使同一直播流可在下列 **视频封装** 下工作：
  - **H.264（AVC）**：现有路径（codec id **7**）。
  - **HEVC 传统 FLV**：首字节为 `FrameType | CodecID`，**CodecID = 12**（国内 CDN / SRS `mux_hevc2flv` 一类），后续 **AVCPacketType + CompositionTime + 负载**（与 AVC 布局类比）。
  - **HEVC Enhanced RTMP**：首字节 **`IsExHeader`（bit7 = 0x80）** + 帧类型 / **PacketType**（低 4 位），后跟 **FourCC `hvc1`**（及规范定义的 CTS、负载），与 Monibuca / SRS `mux_hevc2flv_enhanced` 一类对齐。
- **解码**：**WebCodecs** 与 **WASM（libavcodec）** 均能解 **HEVC**（在浏览器/硬件允许范围内）。
- **网站（第一版）**：用户 **先「检测流」**，再 **手动选择 264 或 265**，再 **播放**；后续迭代为 **自动识别** 编码，去掉或弱化手动选择。

**范围外（本版不做）**

- 自动在 264/265 间切换（**后续**）。
- AV1、VP9 等非 HEVC 扩展。
- 非 AAC 音频（仍仅 AAC）。

---

## 2. FLV 视频 Tag：自动分流策略

对 **每个** 视频 Tag 的 `body`，按下述 **顺序** 判定（与手动「264/265」正交：手动项用于 **校验/覆盖** 见 §6）：

1. **`(body[0] & 0x80) !== 0`** → **Enhanced** 分支：解析 **FourCC**（`hvc1` / `hev1` 等）、**PacketType**、可选 **CompositionTime**、负载；产出与现有中性事件 **同形** 的 `config` / `chunk`（见 §3）。
2. **`(body[0] & 0x0f) === 7`** → 现有 **AVC** 分支（不变）。
3. **`(body[0] & 0x0f) === 12`** → **传统 HEVC** 分支：与 AVC **相同偏移** 的 **packetType（1 字节）+ composition time（3 字节）+ 负载**；序列头与 NAL 语义按 HEVC（HVCC / NALU）解释。
4. 其它 → **`error`**（与当前行为一致，消息区分「未知 codec」）。

**说明**：用户此前观测的 **`data[0]=0x90`**（低 4 位为 0）来自 **Enhanced** 首字节模式（如 `0b1001_0000 | PacketType`），**不得**再用「低 4 位 = codec id」单独判断 HEVC。

---

## 3. 中性事件与 WebCodecs 字符串

保持 **`FlvDemuxEvent`** 判别式 **不变**；扩展 **语义**：

| 场景 | `config.description`                       | `config.codec`                                                   |
| ---- | ------------------------------------------ | ---------------------------------------------------------------- |
| AVC  | **avcC**                                   | `avc1....`（现有）                                               |
| HEVC | **HVCC**（HEVCDecoderConfigurationRecord） | `hev1....` / `hvc1....`（由 HVCC 生成，与 WebCodecs 注册表一致） |

**`chunk.data`**：仍为 **单 Tag 内、去掉 FLV 视频头之后的压缩负载**（长度前缀 NAL，**非** Annex-B）；若某一路径需 Annex-B，仅在 **靠近解码器** 的适配层转换（与现有 AVC 策略一致）。

**时间戳**：Enhanced 分支若 **无 CTS** 的 packet 类型，**ptsMs** 仅使用 FLV Tag 时间戳（与 Monibuca `PacketTypeCodedFramesX` 等行为对齐，实现时对照参考实现）。

---

## 4. WebCodecs（优先实现）

- 新增 **HVCC → codec 字符串** 工具（及单测），与 **avcC → avc1** 平行。
- **`VideoDecoderPipeline`**：配置方法语义泛化（如 `configureVideo`），`configure({ codec, description })` 与 **H.264 / HEVC** 共用。
- **`LivePlayer` / 探测**：对视频轨调用 **`VideoDecoder.isConfigSupported`**（HEVC 在部分环境恒为 false，需 **明确错误文案** 与 **WASM 降级** 策略，产品可选）。

---

## 5. WASM

- **FFmpeg 构建**：`--enable-decoder=hevc`、`--enable-parser=hevc`（及依赖），评估 **体积**。
- **C API**：`wasm_video_config` 根据 **extradata** 或显式类型选择 **`AV_CODEC_ID_HEVC`**；**H.264** 保持现有路径。
- **输出格式**：仍以 **I420** 输出为主；若解码器给出 **NV12** 等，需在 **拷贝层** 扩展或 **swscale**（最小改动原则下优先与现有 I420 路径一致）。

---

## 6. 网站（第一版交互）

1. **检测流**：沿用 **`probeHttpFlv`**，展示 **视频/音频 codec 字符串** 与 **WebCodecs 能力**；在能解析的前提下 **提示** 检测到的 **H.264 vs HEVC**（来自 demux 结果或 codec 前缀）。
2. **手动选择**：**单选「H.264」/「H.265」**，再 **播放**。
3. **Player 选项**：例如 **`videoCodecHint: 'auto' | 'avc' | 'hevc'`**（第一版可为 **`'avc' | 'hevc'`** 必选，**`'auto'`** 留到后续）；与 demux **校验** 一致：若 **hint 与流不符**，**明确报错**（避免误配）。

**第二版**：`probe` 结果驱动 **默认选中** 264/265，并最终 **`auto`** 完全由 demux 决定。

---

## 7. 测试

- **单元测试**：**传统 HEVC** 与 **Enhanced HEVC** 的 **最小合成 FLV** 夹具（可对照 SRS/Monibuca 公开行为或文档中的字节布局）。
- **回归**：现有 **H.264 + AAC** 用例 **全部通过**。

---

## 8. 实现顺序（建议）

1. **Demux**：双格式 HEVC + 现有 AVC/AAC；**probe** 与 **LivePlayer** 打通。
2. **Codec 参数**：HVCC → `hev1`/`hvc1`。
3. **WebCodecs 视频路径**。
4. **WASM 视频路径**。
5. **Website**：检测文案 + **264/265** 选择 + **hint** 传参。

---

## 9. 参考

- Enhanced RTMP：[veovera/enhanced-rtmp](https://github.com/veovera/enhanced-rtmp)（实现时以字节级规范为准）。
- 仓库内：[web-playback-mse-wasm-webcodecs.md](../../web-playback-mse-wasm-webcodecs.md)（HEVC 浏览器能力说明）。
