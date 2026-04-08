/** ISO 14496-3 Table 1.13 — samplingFrequencyIndex → Hz（0–12）。 */
const AAC_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
] as const;

export type AscDecoderParams = {
  codec: string;
  numberOfChannels: number;
  sampleRate: number;
};

/** 从 AudioSpecificConfig（ASC）生成 WebCodecs 常用 `mp4a.40.x` codec 字符串。 */
export function audioSpecificConfigToCodecString(asc: Uint8Array): string {
  if (asc.length < 2) {
    throw new Error("ASC too short");
  }
  const audioObjectType = (asc[0]! >> 3) & 0x1f;
  if (audioObjectType === 31) {
    throw new Error("Extended audio object type (31) is not supported in phase 2");
  }
  return `mp4a.40.${audioObjectType}`;
}

/**
 * 解析 GASpecificConfig 前若干字段，供 `AudioDecoder.configure`（需 `sampleRate` / `numberOfChannels`）。
 */
export function audioSpecificConfigToDecoderParams(asc: Uint8Array): AscDecoderParams {
  if (asc.length < 2) {
    throw new Error("ASC too short");
  }
  let bit = 0;
  const read = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const bi = bit + i;
      const byteIdx = (bi / 8) | 0;
      const shift = 7 - (bi % 8);
      v = (v << 1) | ((asc[byteIdx]! >> shift) & 1);
    }
    bit += n;
    return v;
  };

  let audioObjectType = read(5);
  if (audioObjectType === 31) {
    audioObjectType = 32 + read(6);
  }
  const samplingFreqIndex = read(4);
  let sampleRate: number;
  if (samplingFreqIndex === 0x0f) {
    sampleRate = read(24);
  } else {
    sampleRate = AAC_SAMPLE_RATES[samplingFreqIndex] ?? 44100;
  }
  const channelConfig = read(4);
  /** ISO 14496-3 Table 1.17 — channelConfiguration（简化映射常见值）。 */
  const numberOfChannels =
    channelConfig === 0
      ? 2
      : channelConfig === 1
        ? 1
        : channelConfig === 2
          ? 2
          : channelConfig <= 6
            ? channelConfig
            : channelConfig === 7
              ? 8
              : 2;

  return {
    codec: `mp4a.40.${audioObjectType}`,
    sampleRate,
    numberOfChannels,
  };
}
