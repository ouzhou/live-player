import { expect, test } from "vite-plus/test";
import { avcDecoderConfigurationRecordToCodecString } from "../src/avc-codec-string.ts";

test("maps fixed avcC bytes to avc1 codec string", () => {
  const avcC = new Uint8Array([
    0x01, 0x42, 0xe0, 0x1e, 0xff, 0xe1, 0x00, 0x08, 0x67, 0x42, 0xe0, 0x1e, 0xab, 0xcd, 0xef, 0x01,
    0x01, 0x68, 0xef, 0xbe,
  ]);
  expect(avcDecoderConfigurationRecordToCodecString(avcC)).toBe("avc1.42E01E");
});
