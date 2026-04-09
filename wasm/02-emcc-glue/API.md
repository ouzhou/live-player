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

- 所有 `data` 均为 **连续字节**，由 JS 写入 WASM 堆（`Module._malloc` + 全局 **`HEAPU8`.set / 下标写入**）后传**指针**与 **长度**。（Emscripten 5 生成物里 **`HEAPU8` 多为全局 TypedArray**，不一定挂在 `Module.HEAPU8`。）
- **`codec` 字符串**首版可不进 WASM；若需要，可另增 `wasm_video_set_codec(const char*)` 或把字符串放在固定区。
- C 边界上时间戳用 **`double pts_ms`**（与 demux 的 `ptsMs` 一致）；接入 WebCodecs 时再 `* 1000` 转微秒即可。

### 1.1 解码后取 I420（已实现，供 WebGL 三平面 / shader 使用）

在 **`wasm_video_chunk` 成功且内部收到一帧** 后，可调用：

| 符号                                         | 作用                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wasm_has_decoded_frame()`                   | 非 `0` 表示已有最后一帧可拷贝                                                                                                                                                   |
| `wasm_frame_width()` / `wasm_frame_height()` | 像素宽高                                                                                                                                                                        |
| `wasm_copy_i420(dst_y, dst_u, dst_v)`        | 将 **YUV420P** 拷入 JS 已 `malloc` 的缓冲：`Y` 为 `w*h`，`U`/`V` 各 `(w/2)*(h/2)`，**紧凑无 padding**；任一指针可为 `NULL` 则跳过该平面。成功 `0`，失败 `-1`/`-4`（非 I420 等） |

---

## 2. 返回值与错误码

| 函数                                      | 返回值                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| `wasm_init()`                             | `0` 成功，非 `0` 见下表                                      |
| `wasm_video_config` / `wasm_audio_config` | `0` 成功；内部保存 extradata，供后续 `avcodec_open2`         |
| `wasm_video_chunk` / `wasm_audio_chunk`   | `0` 已处理；视频侧在成功解码后会更新「最后一帧」供 §1.1 拷贝 |
| `wasm_close()`                            | `0` 成功；释放解码器与缓冲（见 §5）                          |

**建议错误码（C `int`，与当前桩一致的可选子集）：**

| 值   | 含义                                                                           |
| ---- | ------------------------------------------------------------------------------ |
| `0`  | 成功                                                                           |
| `-1` | 参数非法（如 `len > 0` 但 `data == nullptr`）                                  |
| `-2` | 未 `wasm_init` 或已 `wasm_close` 后仍调用                                      |
| `-3` | 解码器内部错误（`avcodec_send_packet` / `receive_frame` 失败等，具体可再细分） |

**说明：** 解码失败时可能返回 `-3`；`-2` 可在「未 open 解码器就喂 chunk」等场景补充。

---

## 3. 解码输出（分阶段约定）

输入已由 §1 固定为 **与 `FlvDemuxEvent` 同源** 的字节与时间戳。输出侧按迭代递增，**不在此要求首版就输出 YUV/PCM**。

| 阶段                | 行为                                                                                 | JS 侧                                                                  |
| ------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **A（已部分替代）** | 视频：**libavcodec** 解出 **I420**，由 §1.1 **`wasm_copy_i420`** 拉到 JS；音频仍为桩 | 见 **`browser/fixtures-i420-webgl.html`**：WebGL2 + **YUV→RGB shader** |
| **B（可选增强）**   | 视频：回调或 **RGBA**（`swscale`）；音频：PCM                                        | 按需再增                                                               |
| **C（可选）**       | 大块缓冲用 **`SharedArrayBuffer` + 原子写读索引**（环形缓冲），减少拷贝              | 需 Worker / `crossOriginIsolated` 等前置                               |

**原则：** 解码输出 **不要求** 与 WebCodecs 的 `VideoFrame`/`AudioData` 内存布局一致；只要在 JS 中能 **稳定拿到带时间戳的帧** 即可再喂 Canvas / `AudioContext`。

---

## 4. Worker 与主线程消息（未来对接，非必须现在实现）

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

## 5. 生命周期

| 顺序 | 调用                                      | 说明                                                                               |
| ---- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| 1    | `wasm_init()`                             | 分配/打开解码器上下文（桩为空操作）                                                |
| 2    | `wasm_video_config` / `wasm_audio_config` | 可多次（切流时先 `wasm_close` 再 `init`，或后续增加 `wasm_reset`，二选一由实现定） |
| 3    | `wasm_video_chunk` / `wasm_audio_chunk`   | 按 demux 顺序喂入                                                                  |
| 4    | `wasm_close()`                            | 释放资源；之后若要再播需重新 `wasm_init`                                           |

**与 `FlvDemuxEvent.error`：** 若 demux 报错，JS **不应** 再向 WASM 送新 chunk，除非已 `wasm_close` 并重新 `init` + config。

---

## 6. 与主代码关系

- **现阶段**：不修改 `LivePlayer`；用 **mock 页 + fixtures** 驱动 `shell.js`。
- **对接时**：在 Worker 里 `createLivePlayerWasm()`，按上表 `malloc` + `ccall`；输出见 §3。
