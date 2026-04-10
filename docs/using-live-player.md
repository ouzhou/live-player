# 使用 `@live-player/core`

在浏览器侧用打包器（Vite / webpack 等）引用；FLV 地址需 **CORS** 允许跨域拉流。WASM 视频解码需将 **`shell.js` / `shell.wasm`** 放到 **`public/wasm/`**（或设置 `wasmScriptUrl`），见 [`../wasm/PACKAGING.md`](../wasm/PACKAGING.md)。

## 完整示例（探测 + 播放 + 停播）

下面假定页面里有 `<div id="player-root"></div>`，以及可选的停止按钮 `#btn-stop`。演示了：`probeHttpFlv` 读流头、`LivePlayer` 回调、`play` / `stopFetchOnly` / `destroy`。

```ts
import { LivePlayer, probeHttpFlv } from "@live-player/core";

const FLV_URL = "https://example.com/live.flv";

async function main() {
  const root = document.getElementById("player-root");
  if (!root) {
    throw new Error("需要 #player-root");
  }

  const player = new LivePlayer({
    container: root,
    decodeMode: "auto",
    videoCodecHint: "auto",
    wasmScriptUrl: "/wasm/shell.js",
    onError: (err) => {
      console.error("[live-player]", err.message);
    },
    onPlaying: () => {
      console.log("已开始调度音视频（首段媒体数据已解析）");
    },
    onVideoBackend: (backend) => {
      console.log("视频解码后端:", backend);
    },
  });

  const probe = await probeHttpFlv(FLV_URL);
  if (!probe.ok) {
    console.warn("探测失败:", probe.error);
  } else {
    console.log("探测读取字节数:", probe.bytesRead);
    if (probe.video) console.log("视频 codec:", probe.video.codec);
    if (probe.audio) console.log("音频 codec:", probe.audio.codec);
  }

  try {
    await player.play(FLV_URL);
  } catch (e) {
    console.error("play 失败", e);
  }

  document.getElementById("btn-stop")?.addEventListener("click", () => {
    player.stopFetchOnly();
  });

  window.addEventListener("beforeunload", () => {
    player.destroy();
  });
}

main();
```

## 更多片段

**只用探测、不播放**（例如先展示 codec 再让用户点「播放」）：

```ts
import { probeHttpFlv } from "@live-player/core";

const r = await probeHttpFlv("https://example.com/live.flv", { maxBytes: 256 * 1024 });
if (r.ok && r.video) {
  console.log(r.video.codec, r.video.description.byteLength);
}
```

**强制走 WebCodecs 或 WASM**（`auto` 会在首帧序列头后自动二选一）：

```ts
import { LivePlayer } from "@live-player/core";

new LivePlayer({ container: el, decodeMode: "webcodecs" });
new LivePlayer({ container: el, decodeMode: "wasm", wasmScriptUrl: "/wasm/shell.js" });
```

**声明流是 H.264 还是 H.265**（与流不一致时会抛错；不确定时用 `"auto"`）：

```ts
import { LivePlayer } from "@live-player/core";

new LivePlayer({ container: el, videoCodecHint: "avc" });
new LivePlayer({ container: el, videoCodecHint: "hevc" });
```

**自己提供 canvas**（不会往 DOM 里再插一层）：

```ts
import { LivePlayer } from "@live-player/core";

const canvas = document.querySelector("canvas#live")!;
const player = new LivePlayer({ container: canvas });
await player.play(url);
```
