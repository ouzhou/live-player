import { avcDecoderConfigurationRecordToCodecString } from "../codec-params/avc-codec-string.ts";
import { hevcDecoderConfigurationRecordToCodecString } from "../codec-params/hevc-codec-string.ts";
import type { FlvDemuxEvent } from "./demux-events.ts";

/** Enhanced RTMP：首字节 bit7 = ExVideoTagHeader（见 enhanced-rtmp-v2） */
export const FLV_VIDEO_EX_HEADER_FLAG = 0x80;

export const FLV_VIDEO_CODEC_AVC = 7;
/** 传统 FLV 中 HEVC 的 CodecID（国内 CDN / SRS 非 Enhanced 路径） */
export const FLV_VIDEO_CODEC_HEVC = 12;

const FOURCC_HVC1 = 0x68766331;
const FOURCC_HEV1 = 0x68657631;

/** VideoPacketType（Enhanced，低 4 位） */
const VPT_SEQUENCE_START = 0;
const VPT_CODED_FRAMES = 1;
const VPT_SEQUENCE_END = 2;
const VPT_CODED_FRAMES_X = 3;
const VPT_METADATA = 4;
const VPT_MOD_EX = 7;

function readCompositionTimeMs(buf: Uint8Array, o: number): number {
  const b0 = buf[o]!;
  const b1 = buf[o + 1]!;
  const b2 = buf[o + 2]!;
  let v = (b0 << 16) | (b1 << 8) | b2;
  if (v & 0x800000) v |= ~0xffffff;
  return v;
}

function readU32BE(buf: Uint8Array, o: number): number {
  return (buf[o]! << 24) | (buf[o + 1]! << 16) | (buf[o + 2]! << 8) | buf[o + 3]!;
}

function isKeyFrameEnhanced(b0: number): boolean {
  return ((b0 >> 4) & 0x07) === 1;
}

/**
 * 传统 AVC：body[0]=Frame|Codec7，body[1]=AVCPacketType，body[2..4]=CTS，负载 body[5..]
 */
export function parseFlvVideoTagLegacyAvc(
  body: Uint8Array,
  flvTagTimestampMs: number,
): { events: FlvDemuxEvent[]; error?: string } {
  if (body.length < 5) {
    return { events: [], error: "Truncated AVC video tag" };
  }
  const frameAndCodec = body[0]!;
  const packetType = body[1]!;
  const comp = readCompositionTimeMs(body, 2);
  const ptsMs = flvTagTimestampMs + comp;
  const keyFrame = frameAndCodec >> 4 === 1;
  const payload = body.subarray(5);

  if (packetType === 0) {
    const description = new Uint8Array(payload);
    let codec: string;
    try {
      codec = avcDecoderConfigurationRecordToCodecString(description);
    } catch (e) {
      return {
        events: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
    return {
      events: [{ kind: "config", ptsMs, description, codec }],
    };
  }
  if (packetType === 1) {
    return {
      events: [{ kind: "chunk", ptsMs, data: new Uint8Array(payload), keyFrame }],
    };
  }
  if (packetType === 2) {
    return { events: [] };
  }
  return { events: [], error: `Unknown AVCPacketType ${packetType}` };
}

/**
 * 传统 HEVC：与 AVC 相同 5 字节头，序列头为 HVCC。
 */
export function parseFlvVideoTagLegacyHevc(
  body: Uint8Array,
  flvTagTimestampMs: number,
): { events: FlvDemuxEvent[]; error?: string } {
  if (body.length < 5) {
    return { events: [], error: "Truncated HEVC video tag" };
  }
  const frameAndCodec = body[0]!;
  const packetType = body[1]!;
  const comp = readCompositionTimeMs(body, 2);
  const ptsMs = flvTagTimestampMs + comp;
  const keyFrame = frameAndCodec >> 4 === 1;
  const payload = body.subarray(5);

  if (packetType === 0) {
    const description = new Uint8Array(payload);
    let codec: string;
    try {
      codec = hevcDecoderConfigurationRecordToCodecString(description, "hev1");
    } catch (e) {
      return {
        events: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
    return {
      events: [{ kind: "config", ptsMs, description, codec }],
    };
  }
  if (packetType === 1) {
    return {
      events: [{ kind: "chunk", ptsMs, data: new Uint8Array(payload), keyFrame }],
    };
  }
  if (packetType === 2) {
    return { events: [] };
  }
  return { events: [], error: `Unknown HEVC packet type ${packetType}` };
}

/**
 * Enhanced RTMP 视频：body[0] 含 ExHeader，body[1..4]=FourCC。
 */
export function parseFlvVideoTagEnhanced(
  body: Uint8Array,
  flvTagTimestampMs: number,
): { events: FlvDemuxEvent[]; error?: string } {
  if (body.length < 5) {
    return { events: [], error: "Truncated enhanced video tag" };
  }
  const b0 = body[0]!;
  let packetType = b0 & 0x0f;
  const keyFrame = isKeyFrameEnhanced(b0);
  const fourcc = readU32BE(body, 1);

  if (fourcc !== FOURCC_HVC1 && fourcc !== FOURCC_HEV1) {
    return {
      events: [],
      error: `Unsupported enhanced video FourCC 0x${fourcc.toString(16)} (need hvc1/hev1 for HEVC)`,
    };
  }
  const brand = fourcc === FOURCC_HEV1 ? "hev1" : "hvc1";

  if (packetType === VPT_MOD_EX) {
    return { events: [], error: "Enhanced FLV VideoPacketType ModEx is not supported yet" };
  }
  if (packetType === VPT_METADATA) {
    return { events: [] };
  }
  if (packetType === VPT_SEQUENCE_END) {
    return { events: [] };
  }

  if (packetType === VPT_SEQUENCE_START) {
    const payload = body.subarray(5);
    if (payload.length < 23) {
      return { events: [], error: "HEVC sequence header too short" };
    }
    const description = new Uint8Array(payload);
    let codec: string;
    try {
      codec = hevcDecoderConfigurationRecordToCodecString(description, brand);
    } catch (e) {
      return {
        events: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
    return {
      events: [{ kind: "config", ptsMs: flvTagTimestampMs, description, codec }],
    };
  }

  if (packetType === VPT_CODED_FRAMES) {
    if (body.length < 8) {
      return { events: [], error: "Truncated HEVC CodedFrames" };
    }
    const comp = readCompositionTimeMs(body, 5);
    const ptsMs = flvTagTimestampMs + comp;
    const payload = body.subarray(8);
    return {
      events: [{ kind: "chunk", ptsMs, data: new Uint8Array(payload), keyFrame }],
    };
  }

  if (packetType === VPT_CODED_FRAMES_X) {
    const payload = body.subarray(5);
    return {
      events: [
        {
          kind: "chunk",
          ptsMs: flvTagTimestampMs,
          data: new Uint8Array(payload),
          keyFrame,
        },
      ],
    };
  }

  return { events: [], error: `Unknown enhanced VideoPacketType ${packetType}` };
}
