import "./style.css";
import { DEFAULT_WASM_SCRIPT_URL, LivePlayer, type DecodeMode } from "@live-player/core";

/** 本地 Monibuca HTTP-FLV（与 `scripts/run.md` 推流示例一致） */
const DEMO_FLV_URL = "http://localhost:8080/flv/live/test";

const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `
  <main class="demo">
    <h1>LivePlayer</h1>
    <p class="hint">开发模式从 <code>@live-player/core</code> 解析 <code>development → src/index.ts</code></p>
    <fieldset class="decode-mode">
      <legend>视频解码</legend>
      <div class="decode-mode__options">
        <label class="decode-mode__label">
          <input type="radio" name="decode" value="webcodecs" checked />
          WebCodecs（硬解 + Canvas 2D）
        </label>
        <label class="decode-mode__label">
          <input type="radio" name="decode" value="wasm" />
          WASM + WebGL（需 <code>public/wasm/shell.js</code>）
        </label>
      </div>
    </fieldset>
    <label>
      HTTP-FLV URL
      <input id="url" type="url" size="56" value="${DEMO_FLV_URL}" />
    </label>
    <div class="actions">
      <button id="play" type="button">play(url)</button>
      <button id="destroy" type="button">destroy()</button>
    </div>
    <p id="status" class="status" role="status"></p>
    <div id="player" class="player-host"></div>
  </main>
`;

const statusEl = root.querySelector<HTMLParagraphElement>("#status")!;
const playerHost = root.querySelector<HTMLDivElement>("#player")!;

let player: LivePlayer | null = null;
/** 与当前 `player` 实例一致的解码模式（`decodeMode` 仅在构造函数生效） */
let playerDecodeMode: DecodeMode | null = null;

function getSelectedDecodeMode(): DecodeMode {
  const el = root.querySelector<HTMLInputElement>('input[name="decode"]:checked');
  return el?.value === "wasm" ? "wasm" : "webcodecs";
}

function buildPlayer(mode: DecodeMode): LivePlayer {
  const onError = (err: Error) => {
    statusEl.textContent = `错误: ${err.message}`;
  };
  const onPlaying = () => {
    statusEl.textContent =
      mode === "wasm" ? "已连接流（WASM 视频 + WebGL）" : "已连接流（WebCodecs 硬解）";
  };
  if (mode === "wasm") {
    return new LivePlayer({
      container: playerHost,
      decodeMode: "wasm",
      wasmScriptUrl: DEFAULT_WASM_SCRIPT_URL,
      onError,
      onPlaying,
    });
  }
  return new LivePlayer({
    container: playerHost,
    decodeMode: "webcodecs",
    onError,
    onPlaying,
  });
}

function ensurePlayer(): LivePlayer {
  const mode = getSelectedDecodeMode();
  if (player && playerDecodeMode !== mode) {
    player.destroy();
    player = null;
    playerDecodeMode = null;
  }
  if (!player) {
    playerDecodeMode = mode;
    player = buildPlayer(mode);
  }
  return player;
}

root.querySelectorAll('input[name="decode"]').forEach((el) => {
  el.addEventListener("change", () => {
    if (player) {
      player.destroy();
      player = null;
      playerDecodeMode = null;
    }
    statusEl.textContent = "已切换解码方式，请再次点击 play";
  });
});

root.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", async () => {
  const url = root.querySelector<HTMLInputElement>("#url")!.value.trim();
  if (!url) {
    statusEl.textContent = "请填写 URL";
    return;
  }
  statusEl.textContent = "请求中…";
  try {
    await ensurePlayer().play(url);
  } catch {
    /* onError 已报 */
  }
});

root.querySelector<HTMLButtonElement>("#destroy")!.addEventListener("click", () => {
  player?.destroy();
  player = null;
  playerDecodeMode = null;
  statusEl.textContent = "已 destroy";
});
