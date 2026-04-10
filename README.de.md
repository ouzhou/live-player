# live-player

**Sprachen:** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

Experimentelles **HTTP-FLV**-Player-SDK: **H.264- und H.265-(HEVC)-**Video, **AAC**-Audio. Eigenes FLV-Demuxing (u. a. Legacy-H.265, Enhanced RTMP), **WebCodecs**-Ausgabe auf Canvas / Web Audio; optional **WASM + WebGL** für Video. Das Repo ist ein **pnpm-Workspace** und nutzt **Vite+** (`vp`) als Toolchain.

## Live-Demo

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)** (aus `apps/website`)

## Funktionen

- HTTP-FLV-Pull, eigenes Demux, **H.264 / H.265** in einer Pipeline
- Video **`decodeMode`**: `auto` (nach dem ersten Frame WebCodecs ↔ WASM) | `webcodecs` | `wasm` (benötigt `public/wasm`)
- Audio: WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`** (`auto` / `avc` / `hevc`), **`probeHttpFlv`** (nur Header lesen, kein Decode)
- **`apps/website`**: React + Tailwind v4 + shadcn/ui-Demo, bindet `@live-player/core` direkt aus dem Quellcode ein

## Nutzung im eigenen Projekt

### Installation

```bash
pnpm add @live-player/core
```

### Minimales Beispiel

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

Vollständige Beispiele (Probing, Callbacks, Stopp usw.) siehe **[`docs/using-live-player.md`](docs/using-live-player.md)**.

## Architektur

**Schichten**: `apps/website` → **`@live-player/core`**; Build-Artefakte aus [`wasm/`](wasm/) liegen im Host unter **`public/wasm/`** (oder `wasmScriptUrl`).

**Pipeline**: HTTP-Streaming → **`FlvDemuxer`** → Video **WebCodecs oder WASM**, Audio **WebCodecs** → Canvas / Web Audio. Designhinweise und H.265-FLV-Details: [`docs/architecture-demux-decoders.md`](docs/architecture-demux-decoders.md), [`docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md`](docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md).

```
HTTP → FLV-Demux (H.264 / H.265 + AAC)
         ↓
   Video: WebCodecs oder WASM     Audio: AudioDecoder
         ↓                           ↓
        Canvas / WebGL            Web Audio
```

## Lokales Ingest (optional)

RTMP → HTTP-FLV lokal betreiben (z. B. Monibuca, SRS) und die Stream-URL an die Demo-Standardadresse `http://localhost:8080/flv/live/test` anpassen. Falls ein lokales **`push-command/`** existiert (ggf. gitignore), dessen README für ffmpeg-Push nach `rtmp://127.0.0.1:1935/live/test` befolgen.

## Lizenz

Je nach `license` in der jeweiligen `package.json` (`@live-player/core` ist **MIT**).
