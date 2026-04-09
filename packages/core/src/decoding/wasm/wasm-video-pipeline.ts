import { I420WebGLRenderer } from "../../rendering/i420-webgl-renderer.ts";
import { getEmscriptenHeap, type EmscriptenModule } from "./emscripten-glue.ts";

/**
 * FFmpeg WASM（`wasm_video_*` + `wasm_copy_i420`）→ WebGL2 I420 显示。
 *
 * 注意：`_malloc` / FFmpeg 可能触发 `memory.grow()`，旧 `HEAPU8` 的 `ArrayBuffer` 会被 detach；
 * 每次 `malloc`（或可能扩容的 WASM 调用）之后都要重新 `getEmscriptenHeap()` 再读写。
 */
export class WasmVideoPipeline {
  private readonly onDecoderError: (err: Error) => void;
  private readonly mod: EmscriptenModule;
  private readonly renderer: I420WebGLRenderer;
  private chunkFn: ((p: number, l: number, pts: number, key: number) => number) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    onDecoderError: (err: Error) => void,
    mod: EmscriptenModule,
  ) {
    this.onDecoderError = onDecoderError;
    this.mod = mod;
    this.renderer = new I420WebGLRenderer(canvas);
    const init = mod._wasm_init();
    if (init !== 0) {
      throw new Error(`wasm_init failed: ${init}`);
    }
    this.chunkFn = mod.cwrap("wasm_video_chunk", "number", [
      "number",
      "number",
      "number",
      "number",
    ]) as (p: number, l: number, pts: number, key: number) => number;
  }

  configureFromAvc(description: Uint8Array, _codec: string): void {
    void _codec;
    const ptr = this.mod._malloc(description.length);
    const heap = getEmscriptenHeap(this.mod);
    try {
      heap.set(description, ptr);
      const ret = this.mod._wasm_video_config(ptr, description.length);
      if (ret !== 0) {
        throw new Error(`wasm_video_config failed: ${ret}`);
      }
    } finally {
      this.mod._free(ptr);
    }
  }

  decodeChunk(data: Uint8Array, timestampMicros: number, keyChunk: boolean): void {
    const fn = this.chunkFn;
    if (!fn) {
      return;
    }
    const ptr = this.mod._malloc(data.length);
    const heapAfterPacket = getEmscriptenHeap(this.mod);
    try {
      heapAfterPacket.set(data, ptr);
      const ptsMs = timestampMicros / 1000;
      fn(ptr, data.length, ptsMs, keyChunk ? 1 : 0);
    } finally {
      this.mod._free(ptr);
    }

    if (this.mod._wasm_has_decoded_frame() === 0) {
      return;
    }
    const w = this.mod._wasm_frame_width();
    const h = this.mod._wasm_frame_height();
    if (w <= 0 || h <= 0) {
      return;
    }
    const cw = (w / 2) | 0;
    const ch = (h / 2) | 0;
    const ySize = w * h;
    const uvSize = cw * ch;
    const py = this.mod._malloc(ySize);
    const pu = this.mod._malloc(uvSize);
    const pv = this.mod._malloc(uvSize);
    try {
      if (this.mod._wasm_copy_i420(py, pu, pv) !== 0) {
        this.onDecoderError(new Error("wasm_copy_i420 failed"));
        return;
      }
      const heapForFrame = getEmscriptenHeap(this.mod);
      const y = heapForFrame.subarray(py, py + ySize);
      const u = heapForFrame.subarray(pu, pu + uvSize);
      const v = heapForFrame.subarray(pv, pv + uvSize);
      this.renderer.drawI420(w, h, y, u, v);
    } finally {
      this.mod._free(py);
      this.mod._free(pu);
      this.mod._free(pv);
    }
  }

  close(): void {
    this.chunkFn = null;
    try {
      this.mod._wasm_close();
    } catch {
      /* ignore */
    }
    this.renderer.dispose();
  }
}
