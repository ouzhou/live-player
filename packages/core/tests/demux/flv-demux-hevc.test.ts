import { expect, test } from "vite-plus/test";
import { hevcDecoderConfigurationRecordToCodecString } from "../../src/codec-params/hevc-codec-string.ts";
import { FlvDemuxer } from "../../src/demux/flv-demux.ts";

function writeU24BE(buf: Uint8Array, o: number, v: number): void {
  buf[o] = (v >> 16) & 0xff;
  buf[o + 1] = (v >> 8) & 0xff;
  buf[o + 2] = v & 0xff;
}

function buildFlvHeaderPlusOneVideoTag(videoBody: Uint8Array): Uint8Array {
  const dataSize = videoBody.length;
  const tagTotal = 11 + dataSize + 4;
  const total = 13 + tagTotal;
  const out = new Uint8Array(total);
  let p = 0;
  out[p++] = 0x46;
  out[p++] = 0x4c;
  out[p++] = 0x56;
  out[p++] = 1;
  out[p++] = 5;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 9;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  const tagStart = p;
  out[p++] = 9;
  writeU24BE(out, p, dataSize);
  p += 3;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out.set(videoBody, p);
  p += dataSize;
  const prev = 11 + dataSize;
  out[p++] = (prev >> 24) & 0xff;
  out[p++] = (prev >> 16) & 0xff;
  out[p++] = (prev >> 8) & 0xff;
  out[p++] = prev & 0xff;
  expect(p).toBe(out.length);
  expect(p - tagStart).toBe(tagTotal);
  return out;
}

test("parses legacy FLV HEVC (codec id 12) sequence header", () => {
  const hvcc = new Uint8Array(23);
  hvcc[0] = 1;
  hvcc[1] = 1;
  hvcc[2] = 0x60;
  hvcc[3] = 0;
  hvcc[4] = 0;
  hvcc[5] = 0;
  hvcc[12] = 93;
  const codec = hevcDecoderConfigurationRecordToCodecString(hvcc, "hev1");
  const body = new Uint8Array(5 + hvcc.length);
  body[0] = 0x1c;
  body[1] = 0;
  body[2] = 0;
  body[3] = 0;
  body[4] = 0;
  body.set(hvcc, 5);
  const flv = buildFlvHeaderPlusOneVideoTag(body);
  const demux = new FlvDemuxer();
  const { events, consumed } = demux.parse(flv);
  expect(consumed).toBe(flv.length);
  expect(events).toHaveLength(1);
  const e = events[0]!;
  expect(e.kind).toBe("config");
  if (e.kind !== "config") return;
  expect(e.codec).toBe(codec);
});

test("parses Enhanced RTMP HEVC sequence start (0x90 + hvc1 + HVCC)", () => {
  const hvcc = new Uint8Array(23);
  hvcc[0] = 1;
  hvcc[1] = 1;
  hvcc[2] = 0x60;
  hvcc[3] = 0;
  hvcc[4] = 0;
  hvcc[5] = 0;
  hvcc[12] = 93;
  const codec = hevcDecoderConfigurationRecordToCodecString(hvcc, "hvc1");
  const body = new Uint8Array(5 + hvcc.length);
  body[0] = 0x90;
  body[1] = 0x68;
  body[2] = 0x76;
  body[3] = 0x63;
  body[4] = 0x31;
  body.set(hvcc, 5);
  const flv = buildFlvHeaderPlusOneVideoTag(body);
  const demux = new FlvDemuxer();
  const { events, consumed } = demux.parse(flv);
  expect(consumed).toBe(flv.length);
  expect(events[0]!.kind).toBe("config");
  const e = events[0]!;
  if (e.kind !== "config") return;
  expect(e.codec).toBe(codec);
});
