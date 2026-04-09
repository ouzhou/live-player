/**
 * 与 `wasm/artifacts/emcc-glue/shell.js`（Emscripten）对接的最小类型与加载。
 */

export type EmscriptenModule = {
  /** Emscripten 3+ 常把 `HEAPU8` 放在全局而非 `Module` 上；此处可选。 */
  HEAPU8?: Uint8Array;
  _malloc: (n: number) => number;
  _free: (p: number) => void;
  _wasm_init: () => number;
  _wasm_close: () => number;
  _wasm_video_config: (ptr: number, len: number) => number;
  _wasm_video_chunk: (ptr: number, len: number, ptsMs: number, isKey: number) => number;
  _wasm_has_decoded_frame: () => number;
  _wasm_frame_width: () => number;
  _wasm_frame_height: () => number;
  _wasm_copy_i420: (py: number, pu: number, pv: number) => number;
  cwrap: (
    ident: string,
    returnType: string | null,
    argTypes: string[],
  ) => (...args: number[]) => number;
};

let cachedScriptUrl: string | null = null;
let cachedLoad: Promise<EmscriptenModule> | null = null;

/** Emscripten 生成的 `shell.js` 通常把 `HEAPU8` 挂在 `globalThis`，而非 `Module.HEAPU8`。 */
export function getEmscriptenHeap(mod: EmscriptenModule): Uint8Array {
  const gt = globalThis as unknown as { HEAPU8?: Uint8Array };
  if (gt.HEAPU8?.buffer) {
    return gt.HEAPU8;
  }
  if (mod.HEAPU8?.buffer) {
    return mod.HEAPU8;
  }
  throw new Error("HEAPU8 is not available (Emscripten heap not ready)");
}

function isGlueReady(): boolean {
  const gt = globalThis as unknown as {
    HEAPU8?: Uint8Array;
    Module?: EmscriptenModule;
  };
  return Boolean(gt.HEAPU8?.buffer && gt.Module && typeof gt.Module._wasm_init === "function");
}

/**
 * 动态插入 `shell.js`，在 `onRuntimeInitialized` 后返回全局 `Module`。
 * 同一 `scriptUrl` 只加载一次。
 */
export function loadEmscriptenGlue(scriptUrl: string): Promise<EmscriptenModule> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("loadEmscriptenGlue requires a browser document"));
  }
  const g = globalThis as unknown as { Module?: EmscriptenModule };
  if (isGlueReady() && g.Module) {
    return Promise.resolve(g.Module);
  }
  if (cachedScriptUrl === scriptUrl && cachedLoad) {
    return cachedLoad;
  }
  cachedScriptUrl = scriptUrl;
  cachedLoad = new Promise((resolve, reject) => {
    const w = globalThis as unknown as {
      Module?: Record<string, unknown>;
    };
    const prevInit = w.Module?.onRuntimeInitialized;
    const prevReady = w.Module;
    let settled = false;
    const finish = (mod: EmscriptenModule) => {
      if (!settled) {
        settled = true;
        resolve(mod);
      }
    };
    const fail = (err: Error) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    w.Module = {
      ...prevReady,
      onRuntimeInitialized: function (this: unknown) {
        try {
          if (typeof prevInit === "function") {
            prevInit.call(this);
          }
        } catch (e) {
          fail(e instanceof Error ? e : new Error(String(e)));
          return;
        }
        const mod = w.Module as unknown as EmscriptenModule | undefined;
        if (mod && typeof mod._wasm_init === "function" && isGlueReady()) {
          finish(mod);
        } else {
          fail(
            new Error(
              "Emscripten 初始化异常：未找到全局 HEAPU8 或 wasm 导出（请确认 shell.js 与 Emscripten 版本匹配）。",
            ),
          );
        }
      },
    };

    const s = document.createElement("script");
    s.async = true;
    s.src = scriptUrl;
    s.onerror = () => {
      fail(
        new Error(
          `无法加载 ${scriptUrl}（404 或路径错误）。请将 wasm 构建产物 shell.js / shell.wasm 放到宿主 public 目录对应路径（例如 apps/website/public/wasm/），见 wasm/PACKAGING.md。`,
        ),
      );
    };
    document.head.appendChild(s);
  });
  void cachedLoad.catch(() => {
    if (cachedScriptUrl === scriptUrl) {
      cachedScriptUrl = null;
      cachedLoad = null;
    }
  });
  return cachedLoad;
}
