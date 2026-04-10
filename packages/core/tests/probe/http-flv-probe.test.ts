import { expect, test, vi } from "vite-plus/test";
import { audioSpecificConfigToCodecString } from "../../src/codec-params/aac-codec-string.ts";
import { avcDecoderConfigurationRecordToCodecString } from "../../src/codec-params/avc-codec-string.ts";
import { probeHttpFlv } from "../../src/probe/http-flv-probe.ts";

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

test("probeHttpFlv reads video + audio codec from mocked fetch", async () => {
  const avcC = new Uint8Array([
    0x01, 0x42, 0xe0, 0x1e, 0xff, 0xe1, 0x00, 0x08, 0x67, 0x42, 0xe0, 0x1e, 0xab, 0xcd, 0xef, 0x01,
    0x01, 0x68, 0xef, 0xbe,
  ]);
  const asc = new Uint8Array([0x12, 0x10]);
  const v = buildMinimalFlvWithOneVideoConfig(avcC);
  const a = buildMinimalFlvWithOneAudioAsc(asc);
  const combined = new Uint8Array(v.length + a.length - 13);
  combined.set(v.subarray(0, 13), 0);
  combined.set(v.subarray(13), 13);
  combined.set(a.subarray(13), v.length);

  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(combined, { status: 200, headers: { "Content-Type": "video/x-flv" } }),
    );

  try {
    const r = await probeHttpFlv("http://example/stream.flv");
    expect(r.ok).toBe(true);
    expect(r.video?.codec).toBe(avcDecoderConfigurationRecordToCodecString(avcC));
    expect(r.audio?.codec).toBe(audioSpecificConfigToCodecString(asc));
    expect(r.bytesRead).toBe(combined.length);
    expect(r.truncated).toBe(false);
  } finally {
    fetchSpy.mockRestore();
  }
});
