/**
 * HTTP-FLV 解封装中性输出（与解码后端无关）。
 *
 * @see docs/superpowers/specs/2026-04-09-demux-neutral-format-design.md
 */
export type FlvDemuxEvent =
  | { kind: "config"; ptsMs: number; description: Uint8Array; codec: string }
  | { kind: "chunk"; ptsMs: number; data: Uint8Array; keyFrame: boolean }
  | { kind: "audio_config"; ptsMs: number; description: Uint8Array; codec: string }
  | { kind: "audio_chunk"; ptsMs: number; data: Uint8Array }
  | { kind: "error"; message: string };

/** `FlvDemuxer.parse` 的返回值。 */
export type FlvDemuxParseResult = {
  events: FlvDemuxEvent[];
  consumed: number;
};
