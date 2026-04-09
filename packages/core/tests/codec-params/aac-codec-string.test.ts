import { expect, test } from "vite-plus/test";
import {
  audioSpecificConfigToCodecString,
  audioSpecificConfigToDecoderParams,
} from "../../src/codec-params/aac-codec-string.ts";

test("maps 2-byte ASC to mp4a.40.2", () => {
  const asc = new Uint8Array([0x12, 0x10]);
  expect(audioSpecificConfigToCodecString(asc)).toBe("mp4a.40.2");
});

test("parses ASC to sample rate and channels for AudioDecoder", () => {
  const asc = new Uint8Array([0x12, 0x10]);
  const p = audioSpecificConfigToDecoderParams(asc);
  expect(p.codec).toBe("mp4a.40.2");
  expect(p.sampleRate).toBe(44100);
  expect(p.numberOfChannels).toBe(2);
});

test("throws on short ASC", () => {
  expect(() => audioSpecificConfigToCodecString(new Uint8Array([0x12]))).toThrow(/too short/);
});
