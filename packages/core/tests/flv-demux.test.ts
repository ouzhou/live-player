import { expect, test } from "vite-plus/test";
import { audioSpecificConfigToCodecString } from "../src/aac-codec-string.ts";
import { avcDecoderConfigurationRecordToCodecString } from "../src/avc-codec-string.ts";
import { FlvDemuxer } from "../src/flv-demux.ts";

function writeU24BE(buf: Uint8Array, o: number, v: number): void {
  buf[o] = (v >> 16) & 0xff;
  buf[o + 1] = (v >> 8) & 0xff;
  buf[o + 2] = v & 0xff;
}

function buildMinimalFlvWithOneVideoConfig(avcC: Uint8Array): Uint8Array {
  const dataSize = 5 + avcC.length;
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
  out[p++] = 0x17;
  out[p++] = 0x00;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out.set(avcC, p);
  p += avcC.length;
  const prev = 11 + dataSize;
  out[p++] = (prev >> 24) & 0xff;
  out[p++] = (prev >> 16) & 0xff;
  out[p++] = (prev >> 8) & 0xff;
  out[p++] = prev & 0xff;
  expect(p).toBe(out.length);
  expect(p - tagStart).toBe(tagTotal);
  return out;
}

function buildMinimalFlvWithOneAudioAsc(asc: Uint8Array): Uint8Array {
  const dataSize = 2 + asc.length;
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
  out[p++] = 8;
  writeU24BE(out, p, dataSize);
  p += 3;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0;
  out[p++] = 0xaf;
  out[p++] = 0x00;
  out.set(asc, p);
  p += asc.length;
  const prev = 11 + dataSize;
  out[p++] = (prev >> 24) & 0xff;
  out[p++] = (prev >> 16) & 0xff;
  out[p++] = (prev >> 8) & 0xff;
  out[p++] = prev & 0xff;
  expect(p).toBe(out.length);
  expect(p - tagStart).toBe(tagTotal);
  return out;
}

test("parses minimal FLV with one AVC sequence header tag", () => {
  const avcC = new Uint8Array([
    0x01, 0x42, 0xe0, 0x1e, 0xff, 0xe1, 0x00, 0x08, 0x67, 0x42, 0xe0, 0x1e, 0xab, 0xcd, 0xef, 0x01,
    0x01, 0x68, 0xef, 0xbe,
  ]);
  const whole = buildMinimalFlvWithOneVideoConfig(avcC);
  const demux = new FlvDemuxer();
  const { events, consumed } = demux.parse(whole);
  expect(consumed).toBe(whole.length);
  expect(events).toHaveLength(1);
  const e = events[0]!;
  expect(e.kind).toBe("config");
  if (e.kind !== "config") return;
  expect(e.codec).toBe(avcDecoderConfigurationRecordToCodecString(avcC));
  expect(Array.from(e.description)).toEqual(Array.from(avcC));
  expect(e.ptsMs).toBe(0);
});

test("parses minimal FLV with one AAC AudioSpecificConfig tag", () => {
  const asc = new Uint8Array([0x12, 0x10]);
  const whole = buildMinimalFlvWithOneAudioAsc(asc);
  const demux = new FlvDemuxer();
  const { events, consumed } = demux.parse(whole);
  expect(consumed).toBe(whole.length);
  expect(events).toHaveLength(1);
  const e = events[0]!;
  expect(e.kind).toBe("audio_config");
  if (e.kind !== "audio_config") return;
  expect(e.codec).toBe(audioSpecificConfigToCodecString(asc));
  expect(Array.from(e.description)).toEqual(Array.from(asc));
  expect(e.ptsMs).toBe(0);
});

test("errors on non-AAC audio tag", () => {
  const dataSize = 2;
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
  out[p++] = 8;
  writeU24BE(out, p, dataSize);
  p += 3;
  for (let i = 0; i < 7; i++) out[p++] = 0;
  out[p++] = 0x02;
  out[p++] = 0x00;
  const prev = 11 + dataSize;
  out[p++] = (prev >> 24) & 0xff;
  out[p++] = (prev >> 16) & 0xff;
  out[p++] = (prev >> 8) & 0xff;
  out[p++] = prev & 0xff;

  const demux = new FlvDemuxer();
  const { events, consumed } = demux.parse(out);
  expect(consumed).toBe(out.length);
  expect(events).toHaveLength(1);
  expect(events[0]!.kind).toBe("error");
});
