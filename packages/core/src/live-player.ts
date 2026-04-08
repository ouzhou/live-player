import { GrowableBuffer } from "./byte-buffer.ts";
import { FlvVideoDemuxer } from "./flv-video.ts";
import { VideoDecoderPipeline } from "./video-decoder-pipeline.ts";

export type PlayerOptions = {
  /** 容器元素（内部会创建 canvas）或直接传入 canvas */
  container: HTMLElement | HTMLCanvasElement;
  onError?: (err: Error) => void;
  onPlaying?: () => void;
};

/**
 * HTTP-FLV（H.264）+ WebCodecs：拉流 → FLV 视频轨 demux → `VideoDecoder` → Canvas。
 */
export class LivePlayer {
  private readonly options: PlayerOptions;
  private readonly canvas: HTMLCanvasElement;
  private readonly ownsCanvas: boolean;
  private abortController: AbortController | null = null;
  private pipeline: VideoDecoderPipeline | null = null;

  constructor(options: PlayerOptions) {
    this.options = options;
    const { container } = options;
    if (container instanceof HTMLCanvasElement) {
      this.canvas = container;
      this.ownsCanvas = false;
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      canvas.style.width = "100%";
      canvas.style.maxWidth = "640px";
      canvas.style.background = "#111";
      canvas.setAttribute("data-live-player", "canvas");
      container.appendChild(canvas);
      this.canvas = canvas;
      this.ownsCanvas = true;
    }
  }

  /** 返回内部用于渲染的 canvas（便于调试或自行布局） */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * 开始播放给定 URL（需支持跨域拉流）。
   */
  async play(url: string): Promise<void> {
    this.stopFetchOnly();
    if (typeof globalThis.VideoDecoder === "undefined") {
      const err = new Error("VideoDecoder (WebCodecs) is not available in this environment");
      this.options.onError?.(err);
      throw err;
    }

    const ac = new AbortController();
    this.abortController = ac;

    const buffer = new GrowableBuffer();
    const demux = new FlvVideoDemuxer();
    let pipeline: VideoDecoderPipeline | null = new VideoDecoderPipeline(this.canvas, (err) => {
      this.options.onError?.(err);
      ac.abort();
    });
    this.pipeline = pipeline;

    try {
      const res = await fetch(url, {
        signal: ac.signal,
        mode: "cors",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch stream: HTTP ${res.status}`);
      }
      const body = res.body;
      if (!body) {
        throw new Error("Response has no body");
      }

      const reader = body.getReader();
      let notifiedPlaying = false;

      while (true) {
        const { done, value } = await reader.read();
        if (ac.signal.aborted) {
          return;
        }
        if (done) {
          break;
        }
        if (value && value.byteLength > 0) {
          buffer.append(value);
          if (!notifiedPlaying) {
            notifiedPlaying = true;
            this.options.onPlaying?.();
          }
        }

        for (;;) {
          const { events, consumed } = demux.parse(buffer.view());
          if (consumed === 0) {
            break;
          }
          buffer.consume(consumed);
          for (const ev of events) {
            if (ev.kind === "error") {
              const err = new Error(ev.message);
              this.options.onError?.(err);
              throw err;
            }
            if (ev.kind === "config") {
              pipeline!.configureFromAvc(ev.description, ev.codec);
            } else {
              const micros = Math.round(ev.ptsMs * 1000);
              pipeline!.decodeChunk(ev.data, micros, ev.keyFrame);
            }
          }
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.name === "AbortError") {
        return;
      }
      this.options.onError?.(err);
      throw err;
    } finally {
      pipeline?.close();
      pipeline = null;
      this.pipeline = null;
      if (this.abortController === ac) {
        this.abortController = null;
      }
    }
  }

  /** 停止当前网络请求与解码；保留 canvas 与实例以便再次 play */
  stopFetchOnly(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.pipeline?.close();
    this.pipeline = null;
  }

  destroy(): void {
    this.stopFetchOnly();
    if (this.ownsCanvas && this.canvas.parentElement) {
      this.canvas.remove();
    }
  }
}
