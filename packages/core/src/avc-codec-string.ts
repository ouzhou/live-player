/** 从 AVCDecoderConfigurationRecord（avcC）生成 WebCodecs 常用 `avc1.xxYYzz` 字符串。 */
export function avcDecoderConfigurationRecordToCodecString(avcC: Uint8Array): string {
  if (avcC.length < 4) {
    throw new Error("avcC too short");
  }
  const profile = avcC[1]!;
  const compat = avcC[2]!;
  const level = avcC[3]!;
  const h = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  return `avc1.${h(profile)}${h(compat)}${h(level)}`;
}
