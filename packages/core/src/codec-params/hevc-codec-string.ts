/**
 * HEVCDecoderConfigurationRecord（ISO/IEC 14496-15 §8.3.3.1）→ WebCodecs `hev1.` / `hvc1.` 字符串。
 *
 * 第二段 compatibility 使用 **general_profile_compatibility_flags 高 4 位**（与 WebKit
 * `createHEVCCodecParametersString` 行为及常见 `hvc1.1.6.Lxx` 示例一致），而非 GStreamer
 * 的按位反转链（避免过长十六进制段）。
 */

export type HevcCodecBrand = "hev1" | "hvc1";

function readU32BE(buf: Uint8Array, o: number): number {
  return (buf[o]! << 24) | (buf[o + 1]! << 16) | (buf[o + 2]! << 8) | buf[o + 3]!;
}

/**
 * @param hvcc 完整 HEVCDecoderConfigurationRecord（至少 23 字节）
 * @param brand `hev1` 或 `hvc1`
 */
export function hevcDecoderConfigurationRecordToCodecString(
  hvcc: Uint8Array,
  brand: HevcCodecBrand = "hev1",
): string {
  if (hvcc.length < 23) {
    throw new Error("HEVCDecoderConfigurationRecord too short (need >= 23 bytes)");
  }
  const profileTier = hvcc[1]!;
  const profileSpace = (profileTier >> 6) & 0x03;
  const tierFlag = (profileTier >> 5) & 0x01;
  const profileIdc = profileTier & 0x1f;

  const compat = readU32BE(hvcc, 2);
  /** 与 WebKit LayoutTests `hvc1.1.6.L93` 等对齐：取 compat 最高 4 位 */
  const compatHigh4 = (compat >>> 28) & 0x0f;

  const constraint = hvcc.subarray(6, 12);
  const levelIdc = hvcc[12]!;

  let last = 5;
  while (last >= 0 && constraint[last] === 0) {
    last--;
  }

  let p1 = "";
  if (profileSpace === 1) {
    p1 = "A";
  } else if (profileSpace === 2) {
    p1 = "B";
  } else if (profileSpace === 3) {
    p1 = "C";
  }
  p1 += String(profileIdc);

  let s = `${brand}.${p1}.${compatHigh4.toString(16).toUpperCase()}.${tierFlag ? "H" : "L"}${levelIdc}`;
  for (let i = 0; i <= last; i++) {
    s += `.${constraint[i]!.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return s;
}
