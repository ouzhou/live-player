import { audioSpecificConfigToDecoderParams } from "./aac-codec-string.ts";

/**
 * WebCodecs `AudioDecoder` 薄封装；`AudioData` 交给回调，**不在此处 `close()`**（由 `AudioPlayback` 消费后关闭）。
 */
export class AudioDecoderPipeline {
  private readonly onDecoderError: (err: Error) => void;
  private readonly onAudioData: (data: AudioData) => void;
  private decoder: AudioDecoder | null = null;
  private configured = false;

  constructor(onDecoderError: (err: Error) => void, onAudioData: (data: AudioData) => void) {
    this.onDecoderError = onDecoderError;
    this.onAudioData = onAudioData;
  }

  configureFromAsc(description: Uint8Array): void {
    this.closeDecoder();
    this.configured = true;
    const { codec, numberOfChannels, sampleRate } = audioSpecificConfigToDecoderParams(description);
    this.decoder = new AudioDecoder({
      output: (data: AudioData) => {
        this.onAudioData(data);
      },
      error: (e: DOMException) => {
        this.onDecoderError(new Error(e.message));
      },
    });
    this.decoder.configure({ codec, description, numberOfChannels, sampleRate });
  }

  decodeChunk(data: Uint8Array, timestampMicros: number): void {
    if (!this.decoder || this.decoder.state === "closed" || !this.configured) {
      return;
    }
    const chunk = new EncodedAudioChunk({
      type: "key",
      timestamp: timestampMicros,
      data,
    });
    this.decoder.decode(chunk);
  }

  close(): void {
    this.closeDecoder();
    this.configured = false;
  }

  private closeDecoder(): void {
    if (this.decoder && this.decoder.state !== "closed") {
      try {
        this.decoder.close();
      } catch {
        /* ignore */
      }
    }
    this.decoder = null;
  }
}
