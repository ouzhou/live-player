# live-player

**Langues :** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

SDK lecteur **HTTP-FLV** expérimental : vidéo **H.264 et H.265 (HEVC)**, audio **AAC**. Démultiplexage FLV maison (dont H.265 hérité, Enhanced RTMP, etc.), sortie **WebCodecs** vers Canvas / Web Audio ; option **WASM + WebGL** avec FFmpeg **compilé localement**, **décodage logiciel H.264 uniquement** (voir [`wasm/PACKAGING.md`](wasm/PACKAGING.md)). **Les `shell.js` / `shell.wasm` précompilés ne sont pas fournis dans ce dépôt** (la démo lit le H.265 via **WebCodecs** pour limiter l’exposition brevets/licences). **`@live-player/core` n’est pas publié sur le registre npm.** Le dépôt est un **workspace pnpm** et utilise **Vite+** (`vp`) comme chaîne d’outils.

## Démo en ligne

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)** (depuis `apps/website`)

## Fonctionnalités

- Pull HTTP-FLV, démux maison, **H.264 / H.265** sur une seule chaîne
- Vidéo **`decodeMode`** : `auto` (WebCodecs ↔ WASM après la première image si WASM présent) | `webcodecs` | `wasm` (artefacts compilés localement sous `public/wasm/` de l’hôte ou `wasmScriptUrl` ; non fournis ici)
- Audio : WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`** (`auto` / `avc` / `hevc`), **`probeHttpFlv`** (en-tête seul, pas de décodage)
- **`apps/website`** : démo React + Tailwind v4 + shadcn/ui, import direct du code source `@live-player/core`

## Utilisation dans votre projet

**Pas de paquet npm** : **`@live-player/core` n’est pas publié.** Utilisez ce monorepo en workspace, `pnpm link`, une URL Git ou intégrez `packages/core` dans votre dépôt.

### Exemple minimal

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

Exemples complets (sonde, callbacks, arrêt, etc.) : **[`docs/using-live-player.md`](docs/using-live-player.md)**.

## Architecture

**Couches** : `apps/website` → **`@live-player/core`** ; si vous compilez WASM vous-même, copiez la sortie de [`wasm/`](wasm/) vers **`public/wasm/`** de l’hôte (ou `wasmScriptUrl`). Aucun binaire distribuable sous `public/wasm/` n’est commité dans ce dépôt.

**Chaîne** : flux HTTP → **`FlvDemuxer`** → vidéo **WebCodecs ou WASM**, audio **WebCodecs** → Canvas / Web Audio. Notes de conception et détails H.265 FLV : [`docs/architecture-demux-decoders.md`](docs/architecture-demux-decoders.md), [`docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md`](docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md).

```
HTTP → démux FLV (H.264 / H.265 + AAC)
         ↓
   Vidéo : WebCodecs ou WASM     Audio : AudioDecoder
         ↓                           ↓
        Canvas / WebGL            Web Audio
```

## Ingestion locale (optionnel)

Lancer RTMP → HTTP-FLV en local (p. ex. Monibuca, SRS) et aligner l’URL sur la valeur par défaut du démo `http://localhost:8080/flv/live/test`. Si un dossier local **`push-command/`** existe (peut être gitignoré), suivre son README pour pousser avec ffmpeg vers `rtmp://127.0.0.1:1935/live/test`.

## Licence

Selon le champ `license` de chaque paquet dans `package.json` (`@live-player/core` est **MIT**).
