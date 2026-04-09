/**
 * WASM 解码器桩：导出与 FlvDemuxer 对齐的 C API，并链接 libavutil/libavcodec。
 * 当前不解真实码流；后续在此打开 AVCodecContext、喂 AVPacket、取 AVFrame。
 */

#include <cstdint>
#include <cstring>
#include <vector>

#include <emscripten/emscripten.h>

extern "C" {
#include <libavutil/avutil.h>
}

namespace {

std::vector<uint8_t> g_video_extradata;
std::vector<uint8_t> g_audio_extradata;

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE
const char* wasm_get_version() {
  return av_version_info();
}

/** 初始化（占位；后续分配 AVCodecContext 等） */
EMSCRIPTEN_KEEPALIVE
int wasm_init() {
  return 0;
}

/** 释放资源；再播需重新 `wasm_init` 并送 config。见 API.md §5 */
EMSCRIPTEN_KEEPALIVE
int wasm_close() {
  g_video_extradata.clear();
  g_audio_extradata.clear();
  return 0;
}

/** AVC sequence header：与 FlvDemuxer `config.description` 一致 */
EMSCRIPTEN_KEEPALIVE
int wasm_video_config(const uint8_t* data, int len) {
  if (!data && len > 0) {
    return -1;
  }
  g_video_extradata.assign(data, data + len);
  return 0;
}

/**
 * 视频压缩帧：与 FlvDemuxer `chunk` 一致。
 * pts_ms：毫秒；is_key：非 0 表示关键帧。
 */
EMSCRIPTEN_KEEPALIVE
int wasm_video_chunk(const uint8_t* data, int len, double pts_ms, int is_key) {
  (void)data;
  (void)len;
  (void)pts_ms;
  (void)is_key;
  // TODO: AVPacket + avcodec_send_packet / receive_frame
  return 0;
}

/** AudioSpecificConfig：与 `audio_config.description` 一致 */
EMSCRIPTEN_KEEPALIVE
int wasm_audio_config(const uint8_t* data, int len) {
  if (!data && len > 0) {
    return -1;
  }
  g_audio_extradata.assign(data, data + len);
  return 0;
}

/** AAC 帧：与 `audio_chunk` 一致 */
EMSCRIPTEN_KEEPALIVE
int wasm_audio_chunk(const uint8_t* data, int len, double pts_ms) {
  (void)data;
  (void)len;
  (void)pts_ms;
  return 0;
}

}  // extern "C"
