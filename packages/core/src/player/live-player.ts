import type { FlvDemuxEvent } from "../demux/demux-events.ts";
import { AudioDecoderPipeline } from "../decoding/webcodecs/audio-decoder-pipeline.ts";
import { VideoDecoderPipeline } from "../decoding/webcodecs/video-decoder-pipeline.ts";
import { loadEmscriptenGlue } from "../decoding/wasm/emscripten-glue.ts";
import { WasmVideoPipeline } from "../decoding/wasm/wasm-video-pipeline.ts";
import { AudioPlayback } from "../playback/audio-playback.ts";
import { GrowableBuffer } from "../util/byte-buffer.ts";
import { FlvDemuxer } from "../demux/flv-demux.ts";

function isAvcCodecString(codec: string): boolean {
  return codec.startsWith("avc1");
}

function isHevcCodecString(codec: string): boolean {
  return codec.startsWith("hev1") || codec.startsWith("hvc1");
}

function mismatchVideoHintMessage(hint: "avc" | "hevc", codec: string): string {
  if (hint === "avc") {
    return `视频轨 codec 为 ${codec}，与所选 H.264 不符`;
  }
  return `视频轨 codec 为 ${codec}，与所选 H.265 不符`;
}

/**
 * 视频解码后端：`auto` 在首段序列头处检测（有 WebCodecs 则 `isConfigSupported`，否则或失败则 WASM）；
 * `webcodecs` 为浏览器硬解；`wasm` 为 FFmpeg WASM + WebGL2（I420）。
 */
export type DecodeMode = "auto" | "webcodecs" | "wasm";

/**
 * 视频编码提示：`auto` 不校验，按流中 codec 解码；`avc` / `hevc` 与 demux 结果不一致时抛错。
 */
export type VideoCodecHint = "auto" | "avc" | "hevc";

export type PlayerOptions = {
  /** 容器元素（内部会创建 canvas）或直接传入 canvas */
  container: HTMLElement | HTMLCanvasElement;
  onError?: (err: Error) => void;
  onPlaying?: () => void;
  /**
   * `decodeMode: "auto"` 在解析到首个视频序列头并选定后端后回调一次（便于 UI 展示实际路径）。
   */
  onVideoBackend?: (backend: "webcodecs" | "wasm") => void;
  /** 默认 `auto` */
  decodeMode?: DecodeMode;
  /**
   * 声明视频为 H.264 或 H.265；`auto` 不校验。未传视为 `auto`。
   */
  videoCodecHint?: VideoCodecHint;
  /**
   * `decodeMode` 为 `wasm` 或 `auto` 回落到 WASM 时加载的 Emscripten `shell.js` URL（需与 `shell.wasm` 同目录）。
   * 默认 `/wasm/shell.js`（由宿主放到 `public/wasm/`）。
   */
  wasmScriptUrl?: string;
};

/** @internal */
export const DEFAULT_WASM_SCRIPT_URL = "/wasm/shell.js";

type VideoPipeline = VideoDecoderPipeline | WasmVideoPipeline;

async function chooseAutoVideoBackend(
  codec: string,
  description: Uint8Array,
): Promise<"webcodecs" | "wasm"> {
  if (typeof globalThis.VideoDecoder === "undefined") {
    return "wasm";
  }
  try {
    const { supported } = await VideoDecoder.isConfigSupported({
      codec,
      description,
    });
    if (supported) {
      return "webcodecs";
    }
  } catch {
    /* 回落 WASM */
  }
  return "wasm";
}

function assertWebGl2ForWasm(): void {
  const probe = document.createElement("canvas");
  if (!probe.getContext("webgl2")) {
    throw new Error("WebGL2 is required for WASM video decode");
  }
}

/**
 * HTTP-FLV（H.264 / HEVC + AAC）：拉流 → FLV demux → 视频按 `decodeMode` → 音频 `AudioDecoder` → Web Audio。
 */
export class LivePlayer {
  private readonly options: PlayerOptions;
  private readonly canvas: HTMLCanvasElement;
  private readonly ownsCanvas: boolean;
  private abortController: AbortController | null = null;
  private pipeline: VideoPipeline | null = null;
  private audioPipeline: AudioDecoderPipeline | null = null;
  private audioPlayback: AudioPlayback | null = null;

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
    const decodeMode = this.options.decodeMode ?? "auto";
    const hint = this.options.videoCodecHint ?? "auto";

    if (decodeMode === "webcodecs" && typeof globalThis.VideoDecoder === "undefined") {
      const err = new Error("VideoDecoder (WebCodecs) is not available in this environment");
      this.options.onError?.(err);
      throw err;
    }
    if (decodeMode === "wasm") {
      assertWebGl2ForWasm();
    }

    if (typeof globalThis.AudioDecoder === "undefined") {
      const err = new Error("AudioDecoder (WebCodecs) is not available in this environment");
      this.options.onError?.(err);
      throw err;
    }

    const ac = new AbortController();
    this.abortController = ac;

    const buffer = new GrowableBuffer();
    const demux = new FlvDemuxer();
    const wasmUrl = this.options.wasmScriptUrl ?? DEFAULT_WASM_SCRIPT_URL;

    let pipeline: VideoPipeline | null = null;
    const preVideoQueue: FlvDemuxEvent[] = [];

    if (decodeMode === "webcodecs") {
      pipeline = new VideoDecoderPipeline(this.canvas, (err) => {
        this.options.onError?.(err);
        ac.abort();
      });
      this.pipeline = pipeline;
    } else if (decodeMode === "wasm") {
      try {
        const mod = await loadEmscriptenGlue(wasmUrl);
        pipeline = new WasmVideoPipeline(
          this.canvas,
          (err) => {
            this.options.onError?.(err);
            ac.abort();
          },
          mod,
        );
        this.pipeline = pipeline;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.options.onError?.(err);
        throw err;
      }
    }

    const audioPlayback = new AudioPlayback();
    this.audioPlayback = audioPlayback;
    let audioPipeline: AudioDecoderPipeline | null = new AudioDecoderPipeline(
      (err) => {
        this.options.onError?.(err);
        ac.abort();
      },
      (data) => {
        audioPlayback.schedule(data);
      },
    );
    this.audioPipeline = audioPipeline;

    let audioReady = false;

    const videoError = (err: Error) => {
      this.options.onError?.(err);
      ac.abort();
    };

    const createWebCodecsPipeline = (): VideoDecoderPipeline =>
      new VideoDecoderPipeline(this.canvas, videoError);

    const createWasmPipeline = async (): Promise<WasmVideoPipeline> => {
      assertWebGl2ForWasm();
      const mod = await loadEmscriptenGlue(wasmUrl);
      return new WasmVideoPipeline(this.canvas, videoError, mod);
    };

    const processEvent = async (ev: FlvDemuxEvent): Promise<void> => {
      if (ev.kind === "error") {
        const err = new Error(ev.message);
        this.options.onError?.(err);
        throw err;
      }

      if (decodeMode === "auto" && pipeline === null) {
        if (ev.kind === "config") {
          if (hint === "avc" && !isAvcCodecString(ev.codec)) {
            throw new Error(mismatchVideoHintMessage("avc", ev.codec));
          }
          if (hint === "hevc" && !isHevcCodecString(ev.codec)) {
            throw new Error(mismatchVideoHintMessage("hevc", ev.codec));
          }
          const backend = await chooseAutoVideoBackend(ev.codec, ev.description);
          this.options.onVideoBackend?.(backend);
          if (backend === "webcodecs") {
            pipeline = createWebCodecsPipeline();
          } else {
            try {
              pipeline = await createWasmPipeline();
            } catch (e) {
              const err = e instanceof Error ? e : new Error(String(e));
              this.options.onError?.(err);
              throw err;
            }
          }
          this.pipeline = pipeline;
          pipeline.configureVideo(ev.description, ev.codec);
          const queued = preVideoQueue.splice(0);
          for (const q of queued) {
            await processEvent(q);
          }
          return;
        }
        preVideoQueue.push(ev);
        return;
      }

      if (ev.kind === "config") {
        if (hint === "avc" && !isAvcCodecString(ev.codec)) {
          throw new Error(mismatchVideoHintMessage("avc", ev.codec));
        }
        if (hint === "hevc" && !isHevcCodecString(ev.codec)) {
          throw new Error(mismatchVideoHintMessage("hevc", ev.codec));
        }
        pipeline!.configureVideo(ev.description, ev.codec);
      } else if (ev.kind === "chunk") {
        const micros = Math.round(ev.ptsMs * 1000);
        pipeline!.decodeChunk(ev.data, micros, ev.keyFrame);
      } else if (ev.kind === "audio_config") {
        audioReady = true;
        audioPipeline!.configureFromAsc(ev.description);
      } else if (ev.kind === "audio_chunk") {
        if (!audioReady) {
          throw new Error("AAC frame before AudioSpecificConfig");
        }
        const micros = Math.round(ev.ptsMs * 1000);
        audioPipeline!.decodeChunk(ev.data, micros);
      }
    };

    try {
      await audioPlayback.ensureRunning();

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
            await processEvent(ev);
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
      audioPipeline?.close();
      audioPipeline = null;
      this.audioPipeline = null;
      audioPlayback.close();
      this.audioPlayback = null;
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
    this.audioPipeline?.close();
    this.audioPipeline = null;
    this.audioPlayback?.close();
    this.audioPlayback = null;
  }

  destroy(): void {
    this.stopFetchOnly();
    if (this.ownsCanvas && this.canvas.parentElement) {
      this.canvas.remove();
    }
  }
}
