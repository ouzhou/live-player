import { expect, test } from "vite-plus/test";
import { hevcDecoderConfigurationRecordToCodecString } from "../../src/codec-params/hevc-codec-string.ts";

/** WebKit LayoutTests 期望的 `hvc1.1.6.L93` 向量（简化第二段 compat）。 */
test("builds hvc1.1.6.L93 from synthetic HVCC", () => {
  const hvcc = new Uint8Array(23);
  hvcc[0] = 1;
  hvcc[1] = 1;
  hvcc[2] = 0x60;
  hvcc[3] = 0;
  hvcc[4] = 0;
  hvcc[5] = 0;
  hvcc[12] = 93;
  expect(hevcDecoderConfigurationRecordToCodecString(hvcc, "hvc1")).toBe("hvc1.1.6.L93");
});

test("appends constraint bytes", () => {
  const hvcc = new Uint8Array(23);
  hvcc[0] = 1;
  hvcc[1] = 1;
  hvcc[2] = 0x60;
  hvcc[3] = 0;
  hvcc[4] = 0;
  hvcc[5] = 0;
  hvcc[6] = 0xb0;
  hvcc[12] = 93;
  expect(hevcDecoderConfigurationRecordToCodecString(hvcc, "hvc1")).toBe("hvc1.1.6.L93.B0");
});
