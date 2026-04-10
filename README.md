# live-player

**Languages:** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

Experimental **HTTP-FLV** player SDK: **H.264 and H.265 (HEVC)** video, **AAC** audio. Custom FLV demuxer (including legacy H.265, Enhanced RTMP, etc.), **WebCodecs** output to Canvas / Web Audio; optional **WASM + WebGL** for video. This repo is a **pnpm workspace** and uses **Vite+** (`vp`) as the toolchain.

## Live demo

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)** (from `apps/website`)

## Features

- HTTP-FLV pull, custom demux, **H.264 / H.265** on one pipeline
- Video **`decodeMode`**: `auto` (switch WebCodecs ↔ WASM after first frame) | `webcodecs` | `wasm` (requires `public/wasm`)
- Audio: WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`** (`auto` / `avc` / `hevc`), **`probeHttpFlv`** (read stream header only, no decode)
- **`apps/website`**: React + Tailwind v4 + shadcn/ui demo, imports `@live-player/core` source directly

## Using in your project

### Install

```bash
pnpm add @live-player/core
```

### Minimal example

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

For full examples (probing, callbacks, stop, etc.) see **[`docs/using-live-player.md`](docs/using-live-player.md)**.

## Architecture

**Layers**: `apps/website` → **`@live-player/core`**; [`wasm/`](wasm/) build output goes in the host app’s **`public/wasm/`** (or `wasmScriptUrl`).

**Pipeline**: HTTP streaming → **`FlvDemuxer`** → video **WebCodecs or WASM**, audio **WebCodecs** → Canvas / Web Audio. Design notes and H.265 FLV details: [`docs/architecture-demux-decoders.md`](docs/architecture-demux-decoders.md), [`docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md`](docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md).

```
HTTP → FLV demux (H.264 / H.265 + AAC)
         ↓
   Video: WebCodecs or WASM     Audio: AudioDecoder
         ↓                           ↓
        Canvas / WebGL            Web Audio
```

## Local ingest (optional)

Run RTMP → HTTP-FLV locally (e.g. Monibuca, SRS) and point the stream at something like the demo default `http://localhost:8080/flv/live/test`. If you have a local **`push-command/`** folder (may be gitignored), follow its README to push with ffmpeg to `rtmp://127.0.0.1:1935/live/test`.

## License

Per-package `license` in `package.json` (`@live-player/core` is **MIT**).
