# WASM 解码器约定（与 `FlvDemuxer` 对齐）

主线程 **`packages/core` 的 `FlvDemuxer`** 产出事件见 `FlvDemuxEvent`。WASM 侧按**同一语义**收数，不重复解 FLV。

---

## 1. 事件 → WASM 调用映射（建议）

| `FlvDemuxEvent`                                | 建议的 WASM 入口（C ABI，`extern "C"`）       | 说明                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `{ kind: "config", description, codec }`       | `wasm_video_config(data, len)`                | `description` = **AVCDecoderConfigurationRecord**（含 SPS/PPS），与 WebCodecs `configure({ description })` 同源            |
| `{ kind: "chunk", data, ptsMs, keyFrame }`     | `wasm_video_chunk(data, len, pts_ms, is_key)` | `data` = 该帧 **NAL 负载**（与当前喂给 `VideoDecoder` 的 `EncodedVideoChunk` 同源）；`pts_ms` 用 **double**，与 demux 一致 |
| `{ kind: "audio_config", description, codec }` | `wasm_audio_config(data, len)`                | `description` = **AudioSpecificConfig**                                                                                    |
| `{ kind: "audio_chunk", data, ptsMs }`         | `wasm_audio_chunk(data, len, pts_ms)`         | AAC 帧原始字节                                                                                                             |

约定：

- 所有 `data` 均为 **连续字节**，由 JS 写入 WASM 堆（`Module._malloc` + `HEAPU8.set`）后传**指针**与 **长度**。
- **`codec` 字符串**首版可不进 WASM；若需要，可另增 `wasm_video_set_codec(const char*)` 或把字符串放在固定区。
- C 边界上时间戳用 **`double pts_ms`**（与 demux 的 `ptsMs` 一致）；接入 WebCodecs 时再 `* 1000` 转微秒即可。

---

## 2. 返回值（建议）

| 函数                                      | 返回值                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| `wasm_init()`                             | `0` 成功，非 `0` 错误码                              |
| `wasm_video_config` / `wasm_audio_config` | `0` 成功；内部保存 extradata，供后续 `avcodec_open2` |
| `wasm_video_chunk` / `wasm_audio_chunk`   | `0` 已接收；解码输出后续可通过回调或环形缓冲再约定   |

当前实现为 **桩**：校验长度、调用 `av_version_info`，不解码真实帧。

---

## 3. Worker 与主线程消息（未来对接，非必须现在实现）

仅作占位，便于与主代码对接时统一：

```ts
// 主 → Worker（二进制 + 元数据分离）
type ToWasmVideoConfig = {
  type: "video_config";
  description: ArrayBuffer; // copy from Uint8Array
};
type ToWasmVideoChunk = {
  type: "video_chunk";
  ptsUs: bigint;
  key: boolean;
  data: ArrayBuffer;
};
// audio 同理 type: "audio_config" | "audio_chunk"
```

---

## 4. 与主代码关系

- **现阶段**：不修改 `LivePlayer`；用 **mock 页 + fixtures** 驱动 `shell.js`。
- **对接时**：在 Worker 里 `createLivePlayerWasm()`，按上表 `malloc` + `ccall`。
