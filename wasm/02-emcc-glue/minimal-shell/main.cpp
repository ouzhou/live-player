/**
 * WASM H.264 解码（I420）+ 与 FlvDemuxer 对齐的 C API。
 * wasm_video_config 后 wasm_video_chunk 可收到帧；用 wasm_copy_i420 拷到 JS 堆再 WebGL 渲染。
 */

#include <cstdint>
#include <cstring>
#include <vector>

#include <emscripten/emscripten.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
}

namespace {

std::vector<uint8_t> g_video_extradata;
std::vector<uint8_t> g_audio_extradata;

const AVCodec* g_codec = nullptr;
AVCodecContext* g_avctx = nullptr;
AVFrame* g_dec_frame = nullptr;
AVFrame* g_last_frame = nullptr;

void free_last_frame() {
  if (g_last_frame) {
    av_frame_free(&g_last_frame);
    g_last_frame = nullptr;
  }
}

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE
const char* wasm_get_version() {
  return av_version_info();
}

EMSCRIPTEN_KEEPALIVE
int wasm_init() {
  return 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_close() {
  free_last_frame();
  if (g_dec_frame) {
    av_frame_free(&g_dec_frame);
    g_dec_frame = nullptr;
  }
  if (g_avctx) {
    avcodec_free_context(&g_avctx);
    g_avctx = nullptr;
  }
  g_codec = nullptr;
  g_video_extradata.clear();
  g_audio_extradata.clear();
  return 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_video_config(const uint8_t* data, int len) {
  if (!data && len > 0) {
    return -1;
  }
  g_video_extradata.assign(data, data + len);

  free_last_frame();
  if (g_dec_frame) {
    av_frame_free(&g_dec_frame);
    g_dec_frame = nullptr;
  }
  if (g_avctx) {
    avcodec_free_context(&g_avctx);
    g_avctx = nullptr;
  }

  g_codec = avcodec_find_decoder(AV_CODEC_ID_H264);
  if (!g_codec) {
    return -3;
  }
  g_avctx = avcodec_alloc_context3(g_codec);
  if (!g_avctx) {
    return -3;
  }
  g_avctx->extradata =
      (uint8_t*)av_malloc(static_cast<size_t>(len) + AV_INPUT_BUFFER_PADDING_SIZE);
  if (!g_avctx->extradata) {
    avcodec_free_context(&g_avctx);
    g_avctx = nullptr;
    return -3;
  }
  memcpy(g_avctx->extradata, data, static_cast<size_t>(len));
  g_avctx->extradata_size = len;
  memset(g_avctx->extradata + len, 0, AV_INPUT_BUFFER_PADDING_SIZE);

  int ret = avcodec_open2(g_avctx, g_codec, nullptr);
  if (ret < 0) {
    avcodec_free_context(&g_avctx);
    g_avctx = nullptr;
    return -3;
  }

  g_dec_frame = av_frame_alloc();
  if (!g_dec_frame) {
    avcodec_free_context(&g_avctx);
    g_avctx = nullptr;
    return -3;
  }
  return 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_video_chunk(const uint8_t* data, int len, double pts_ms, int is_key) {
  (void)pts_ms;
  (void)is_key;
  if (!g_avctx) {
    return -2;
  }
  if (!data || len <= 0) {
    return -1;
  }

  AVPacket* pkt = av_packet_alloc();
  if (!pkt) {
    return -3;
  }
  if (av_new_packet(pkt, len) < 0) {
    av_packet_free(&pkt);
    return -3;
  }
  memcpy(pkt->data, data, static_cast<size_t>(len));
  pkt->size = len;

  int send_ret = avcodec_send_packet(g_avctx, pkt);
  av_packet_free(&pkt);
  if (send_ret < 0) {
    return -3;
  }

  while (true) {
    int ret = avcodec_receive_frame(g_avctx, g_dec_frame);
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      return -3;
    }
    if (!g_last_frame) {
      g_last_frame = av_frame_alloc();
      if (!g_last_frame) {
        return -3;
      }
    }
    av_frame_unref(g_last_frame);
    if (av_frame_ref(g_last_frame, g_dec_frame) < 0) {
      return -3;
    }
  }
  return 0;
}

/** 是否有已解码的帧可供拷贝 */
EMSCRIPTEN_KEEPALIVE
int wasm_has_decoded_frame() {
  return g_last_frame ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_frame_width() {
  return g_last_frame ? g_last_frame->width : 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_frame_height() {
  return g_last_frame ? g_last_frame->height : 0;
}

/**
 * 将最后一帧 I420 拷到 JS 已分配的紧凑缓冲（Y: w*h, U/V: (w/2)*(h/2)）。
 * 任一指针可为 nullptr 则跳过该平面（便于只测 Y）。
 */
EMSCRIPTEN_KEEPALIVE
int wasm_copy_i420(uint8_t* dst_y, uint8_t* dst_u, uint8_t* dst_v) {
  if (!g_last_frame) {
    return -1;
  }
  if (g_last_frame->format != AV_PIX_FMT_YUV420P) {
    return -4;
  }
  const int w = g_last_frame->width;
  const int h = g_last_frame->height;
  const int cw = w / 2;
  const int ch = h / 2;

  for (int y = 0; y < h; y++) {
    if (dst_y) {
      memcpy(dst_y + static_cast<size_t>(y) * w,
             g_last_frame->data[0] + static_cast<size_t>(y) * g_last_frame->linesize[0],
             static_cast<size_t>(w));
    }
  }
  for (int y = 0; y < ch; y++) {
    if (dst_u) {
      memcpy(dst_u + static_cast<size_t>(y) * cw,
             g_last_frame->data[1] + static_cast<size_t>(y) * g_last_frame->linesize[1],
             static_cast<size_t>(cw));
    }
    if (dst_v) {
      memcpy(dst_v + static_cast<size_t>(y) * cw,
             g_last_frame->data[2] + static_cast<size_t>(y) * g_last_frame->linesize[2],
             static_cast<size_t>(cw));
    }
  }
  return 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_audio_config(const uint8_t* data, int len) {
  if (!data && len > 0) {
    return -1;
  }
  g_audio_extradata.assign(data, data + len);
  return 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_audio_chunk(const uint8_t* data, int len, double pts_ms) {
  (void)data;
  (void)len;
  (void)pts_ms;
  return 0;
}

}  // extern "C"
