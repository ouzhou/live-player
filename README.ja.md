# live-player

**言語：** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

実験的な **HTTP-FLV** プレーヤー SDK：**H.264 / H.265（HEVC）** 映像、**AAC** 音声。独自 FLV demux（従来の H.265、Enhanced RTMP など）、**WebCodecs** で Canvas / Web Audio へ出力。映像は **WASM + WebGL** も選択可能。リポジトリは **pnpm workspace**、ツールチェーンは **Vite+**（`vp`）。

## ライブデモ

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)**（`apps/website`）

## 機能

- HTTP-FLV 受信、独自 demux、**H.264 / H.265** を同一パイプラインで処理
- 映像 **`decodeMode`**：`auto`（先頭フレーム後に WebCodecs ↔ WASM）| `webcodecs` | `wasm`（`public/wasm` が必要）
- 音声：WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`**（`auto` / `avc` / `hevc`）、**`probeHttpFlv`**（ヘッダのみ読取、デコードなし）
- **`apps/website`**：React + Tailwind v4 + shadcn/ui のデモ、`@live-player/core` をソースから直接参照

## プロジェクトでの利用

### インストール

```bash
pnpm add @live-player/core
```

### 最小サンプル

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

プローブ、コールバック、停止などの詳細は **[`docs/using-live-player.md`](docs/using-live-player.md)** を参照。

## アーキテクチャ

**階層**：`apps/website` → **`@live-player/core`**；[`wasm/`](wasm/) のビルド成果物はホストの **`public/wasm/`** に配置（または `wasmScriptUrl`）。

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
