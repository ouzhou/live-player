# live-player

**Idiomas:** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

SDK de reproductor **HTTP-FLV** experimental: vídeo **H.264 y H.265 (HEVC)**, audio **AAC**. Demuxer FLV propio (incl. H.265 heredado, Enhanced RTMP, etc.), salida con **WebCodecs** a Canvas / Web Audio; vídeo opcional **WASM + WebGL**. El repositorio es un **workspace pnpm** y usa **Vite+** (`vp`) como cadena de herramientas.

## Demo en vivo

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)** (desde `apps/website`)

## Características

- Pull HTTP-FLV, demux propio, **H.264 / H.265** en una sola tubería
- Vídeo **`decodeMode`**: `auto` (tras el primer fotograma WebCodecs ↔ WASM) | `webcodecs` | `wasm` (requiere `public/wasm`)
- Audio: WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`** (`auto` / `avc` / `hevc`), **`probeHttpFlv`** (solo cabecera, sin decodificar)
- **`apps/website`**: demo React + Tailwind v4 + shadcn/ui, importa el código fuente de `@live-player/core`

## Uso en tu proyecto

### Instalación

```bash
pnpm add @live-player/core
```

### Ejemplo mínimo

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

Ejemplos completos (sondeo, callbacks, parada, etc.) en **[`docs/using-live-player.md`](docs/using-live-player.md)**.

## Arquitectura

**Capas**: `apps/website` → **`@live-player/core`**; la salida de compilación de [`wasm/`](wasm/) va en **`public/wasm/`** del host (o `wasmScriptUrl`).

**Tubería**: streaming HTTP → **`FlvDemuxer`** → vídeo **WebCodecs o WASM**, audio **WebCodecs** → Canvas / Web Audio. Notas de diseño y detalles H.265 FLV: [`docs/architecture-demux-decoders.md`](docs/architecture-demux-decoders.md), [`docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md`](docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md).

```
HTTP → demux FLV (H.264 / H.265 + AAC)
         ↓
   Vídeo: WebCodecs o WASM     Audio: AudioDecoder
         ↓                           ↓
        Canvas / WebGL            Web Audio
```

## Ingesta local (opcional)

Ejecuta RTMP → HTTP-FLV en local (p. ej. Monibuca, SRS) y alinea la URL con el valor por defecto del demo `http://localhost:8080/flv/live/test`. Si tienes **`push-command/`** local (puede estar en gitignore), sigue su README para enviar con ffmpeg a `rtmp://127.0.0.1:1935/live/test`.

## Licencia

Según el campo `license` de cada paquete en `package.json` (`@live-player/core` es **MIT**).
