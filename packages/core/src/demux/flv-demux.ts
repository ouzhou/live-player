import type { FlvDemuxEvent, FlvDemuxParseResult } from "./demux-events.ts";
import { audioSpecificConfigToCodecString } from "../codec-params/aac-codec-string.ts";
import {
  FLV_VIDEO_CODEC_AVC,
  FLV_VIDEO_CODEC_HEVC,
  FLV_VIDEO_EX_HEADER_FLAG,
  parseFlvVideoTagEnhanced,
  parseFlvVideoTagLegacyAvc,
  parseFlvVideoTagLegacyHevc,
} from "./flv-video.ts";

export type { FlvDemuxEvent, FlvDemuxParseResult } from "./demux-events.ts";

const FLV_TAG_AUDIO = 8;
const FLV_TAG_VIDEO = 9;
const FLV_SOUND_FORMAT_AAC = 10;

function readU24BE(buf: Uint8Array, o: number): number {
  return (buf[o]! << 16) | (buf[o + 1]! << 8) | buf[o + 2]!;
}

function readU32BE(buf: Uint8Array, o: number): number {
  return (buf[o]! << 24) | (buf[o + 1]! << 16) | (buf[o + 2]! << 8) | buf[o + 3]!;
}

/** FLV Tag Header 内时间戳（毫秒），与常见实现一致：低 24 位 + Extended。 */
function readTagTimestampMs(buf: Uint8Array, tagStart: number): number {
  return (
    buf[tagStart + 4]! |
    (buf[tagStart + 5]! << 8) |
    (buf[tagStart + 6]! << 16) |
    (buf[tagStart + 7]! << 24)
  );
}

export class FlvDemuxer {
  private headerDone = false;

  parse(buffer: Uint8Array): FlvDemuxParseResult {
    const events: FlvDemuxEvent[] = [];
    let o = 0;

    if (!this.headerDone) {
      if (buffer.length < 13) {
        return { events, consumed: 0 };
      }
      if (buffer[0] !== 0x46 || buffer[1] !== 0x4c || buffer[2] !== 0x56 || buffer[3] !== 1) {
        return {
          events: [{ kind: "error", message: "Invalid FLV header" }],
          consumed: 0,
        };
      }
      const dataOffset = readU32BE(buffer, 5);
      if (dataOffset !== 9) {
        return {
          events: [{ kind: "error", message: "Unsupported FLV header size" }],
          consumed: 0,
        };
      }
      o = 13;
      this.headerDone = true;
    }

    while (o < buffer.length) {
      if (buffer.length - o < 11) {
        break;
      }
      const tagStart = o;
      const tagType = buffer[o]!;
      const dataSize = readU24BE(buffer, o + 1);
      const tagBlock = 11 + dataSize + 4;
      if (buffer.length - o < tagBlock) {
        break;
      }

      const prevSize = readU32BE(buffer, o + 11 + dataSize);
      const expectedPrev = 11 + dataSize;
      if (prevSize !== expectedPrev) {
        events.push({
          kind: "error",
          message: `PreviousTagSize mismatch: got ${prevSize}, expected ${expectedPrev}`,
        });
        return { events, consumed: o };
      }

      o += tagBlock;

      if (tagType === FLV_TAG_AUDIO) {
        const ts = readTagTimestampMs(buffer, tagStart);
        const body = buffer.subarray(tagStart + 11, tagStart + 11 + dataSize);
        if (body.length < 2) {
          events.push({ kind: "error", message: "Truncated audio tag" });
          return { events, consumed: o };
        }
        const soundFormat = (body[0]! >> 4) & 0x0f;
        if (soundFormat !== FLV_SOUND_FORMAT_AAC) {
          events.push({
            kind: "error",
            message: `Unsupported audio format ${soundFormat} (need AAC)`,
          });
          return { events, consumed: o };
        }
        const packetType = body[1]!;
        const payload = body.subarray(2);
        const ptsMs = ts;

        if (packetType === 0) {
          const description = new Uint8Array(payload);
          let codec: string;
          try {
            codec = audioSpecificConfigToCodecString(description);
          } catch (e) {
            events.push({
              kind: "error",
              message: e instanceof Error ? e.message : String(e),
            });
            return { events, consumed: o };
          }
          events.push({
            kind: "audio_config",
            ptsMs,
            description,
            codec,
          });
        } else if (packetType === 1) {
          events.push({
            kind: "audio_chunk",
            ptsMs,
            data: new Uint8Array(payload),
          });
        } else {
          events.push({
            kind: "error",
            message: `Unknown AACPacketType ${packetType}`,
          });
          return { events, consumed: o };
        }
        continue;
      }

      if (tagType !== FLV_TAG_VIDEO) {
        continue;
      }

      const ts = readTagTimestampMs(buffer, tagStart);
      const body = buffer.subarray(tagStart + 11, tagStart + 11 + dataSize);
      if (body.length < 1) {
        events.push({ kind: "error", message: "Empty video tag" });
        return { events, consumed: o };
      }

      const b0 = body[0]!;
      let videoResult: ReturnType<typeof parseFlvVideoTagLegacyAvc>;
      if ((b0 & FLV_VIDEO_EX_HEADER_FLAG) !== 0) {
        videoResult = parseFlvVideoTagEnhanced(body, ts);
      } else {
        const codecId = b0 & 0x0f;
        if (codecId === FLV_VIDEO_CODEC_AVC) {
          videoResult = parseFlvVideoTagLegacyAvc(body, ts);
        } else if (codecId === FLV_VIDEO_CODEC_HEVC) {
          videoResult = parseFlvVideoTagLegacyHevc(body, ts);
        } else {
          events.push({
            kind: "error",
            message: `Unsupported video codec id ${codecId}; video tag data[0]=0x${b0.toString(16).padStart(2, "0")}. Need AVC(7), HEVC(12), or Enhanced RTMP (bit7=1).`,
          });
          return { events, consumed: o };
        }
      }

      if (videoResult.error) {
        events.push({ kind: "error", message: videoResult.error });
        return { events, consumed: o };
      }
      events.push(...videoResult.events);
    }

    return { events, consumed: o };
  }
}
