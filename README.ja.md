# live-player

**言語：** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

実験的な **HTTP-FLV** プレーヤー SDK：**H.264 / H.265（HEVC）** 映像、**AAC** 音声。独自 FLV demux（従来の H.265、Enhanced RTMP など）、**WebCodecs** で Canvas / Web Audio へ出力。任意で **自前ビルド**の FFmpeg **WASM + WebGL**（**H.264 ソフトデコードのみ**、[`wasm/PACKAGING.md`](wasm/PACKAGING.md) 参照）。**ビルド済みの `shell.js` / `shell.wasm` は本リポジトリに同梱しません**（デモでは H.265 を **WebCodecs** で再生し、特許・ライセンス上の配布面を抑えます）。**`@live-player/core` は npm に公開しません。** リポジトリは **pnpm workspace**、ツールチェーンは **Vite+**（`vp`）。

## ライブデモ

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)**（`apps/website`）

## 機能

- HTTP-FLV 受信、独自 demux、**H.264 / H.265** を同一パイプラインで処理
- 映像 **`decodeMode`**：`auto`（WASM がある場合のみ先頭フレーム後に WebCodecs ↔ WASM）| `webcodecs` | `wasm`（ローカルビルド成果物をホストの `public/wasm/` または `wasmScriptUrl` に置く必要あり；本リポジトリにはバイナリを同梱しない）
- 音声：WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`**（`auto` / `avc` / `hevc`）、**`probeHttpFlv`**（ヘッダのみ読取、デコードなし）
- **`apps/website`**：React + Tailwind v4 + shadcn/ui のデモ、`@live-player/core` をソースから直接参照

## プロジェクトでの利用

**npm パッケージはありません**：**`@live-player/core` は公開しません。** このモノレポを workspace として使う、`pnpm link`、Git URL、または `packages/core` を独自リポジトリに取り込んでください。

### 最小サンプル

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

プローブ、コールバック、停止などの詳細は **[`docs/using-live-player.md`](docs/using-live-player.md)** を参照。

## アーキテクチャ

**階層**：`apps/website` → **`@live-player/core`**；WASM を自前ビルドする場合は [`wasm/`](wasm/) の出力をホストの **`public/wasm/`** にコピー（または `wasmScriptUrl` を設定）。`public/wasm/` の配布用バイナリは本リポジトリにはコミットしません。

**パイプライン**：HTTP ストリーミング → **`FlvDemuxer`** → 映像 **WebCodecs または WASM**、音声 **WebCodecs** → Canvas / Web Audio。設計と H.265 FLV の詳細は [`docs/architecture-demux-decoders.md`](docs/architecture-demux-decoders.md)、[`docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md`](docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md)。

```
HTTP → FLV demux（H.264 / H.265 + AAC）
         ↓
   映像：WebCodecs または WASM     音声：AudioDecoder
         ↓                           ↓
        Canvas / WebGL            Web Audio
```

## ローカル取り込み（任意）

ローカルで RTMP → HTTP-FLV（Monibuca、SRS など）を起動し、デモのデフォルト `http://localhost:8080/flv/live/test` に合わせます。ローカルの **`push-command/`**（gitignore される場合あり）がある場合は、その README に従い ffmpeg で `rtmp://127.0.0.1:1935/live/test` へプッシュします。

## ライセンス

各パッケージの `package.json` の `license` に従います（`@live-player/core` は **MIT**）。
