import "./style.css";
import { LivePlayer } from "@live-player/core";

/** 本地 Monibuca HTTP-FLV（与 `scripts/run.md` 推流示例一致） */
const DEMO_FLV_URL = "http://localhost:8080/flv/live/test";

const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `
  <main class="demo">
    <h1>LivePlayer</h1>
    <p class="hint">开发模式从 <code>@live-player/core</code> 解析 <code>development → src/index.ts</code></p>
    <label>
      HTTP-FLV URL
      <input id="url" type="url" size="56" value="${DEMO_FLV_URL}" readonly />
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

let player: LivePlayer | null = new LivePlayer({
  container: playerHost,
  onError: (err: Error) => {
    statusEl.textContent = `错误: ${err.message}`;
  },
  onPlaying: () => {
    statusEl.textContent = "已连接流（当前为占位：尚未解码画面）";
  },
});

function ensurePlayer(): LivePlayer {
  if (!player) {
    player = new LivePlayer({
      container: playerHost,
      onError: (err: Error) => {
        statusEl.textContent = `错误: ${err.message}`;
      },
      onPlaying: () => {
        statusEl.textContent = "已连接流（当前为占位：尚未解码画面）";
      },
    });
  }
  return player;
}

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
  statusEl.textContent = "已 destroy";
});
