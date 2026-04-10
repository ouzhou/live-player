/**
 * WebCodecs `VideoDecoder` → Canvas 2D，首帧按 `VideoFrame` 尺寸调整 canvas 像素大小。
 */
export class VideoDecoderPipeline {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly onDecoderError: (err: Error) => void;
  private decoder: VideoDecoder | null = null;
  private hasSized = false;

  constructor(canvas: HTMLCanvasElement, onDecoderError: (err: Error) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is not available");
    }
    this.ctx = ctx;
    this.onDecoderError = onDecoderError;
  }

  configureVideo(description: Uint8Array, codec: string): void {
    this.closeDecoder();
    this.hasSized = false;
    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        try {
          if (!this.hasSized) {
            this.canvas.width = frame.displayWidth;
            this.canvas.height = frame.displayHeight;
            this.hasSized = true;
          }
          this.ctx.drawImage(frame, 0, 0);
        } finally {
          frame.close();
        }
      },
      error: (e: DOMException) => {
        this.onDecoderError(new Error(e.message));
      },
    });
    this.decoder.configure({ codec, description });
  }

  decodeChunk(data: Uint8Array, timestampMicros: number, keyChunk: boolean): void {
    if (!this.decoder || this.decoder.state === "closed") {
      return;
    }
    const chunk = new EncodedVideoChunk({
      type: keyChunk ? "key" : "delta",
      timestamp: timestampMicros,
      data,
    });
    this.decoder.decode(chunk);
  }

  close(): void {
    this.closeDecoder();
    this.hasSized = false;
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
