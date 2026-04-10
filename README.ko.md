# live-player

**언어:** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

실험적 **HTTP-FLV** 플레이어 SDK: **H.264 / H.265(HEVC)** 비디오, **AAC** 오디오. 자체 FLV demux(레거시 H.265, Enhanced RTMP 등), **WebCodecs**로 Canvas / Web Audio 출력. 비디오는 **WASM + WebGL** 선택 가능. 저장소는 **pnpm workspace**, 도구 체인은 **Vite+**(`vp`).

## 라이브 데모

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)** (`apps/website`)

## 기능

- HTTP-FLV 수신, 자체 demux, **H.264 / H.265** 단일 파이프라인
- 비디오 **`decodeMode`**: `auto`(첫 프레임 후 WebCodecs ↔ WASM) | `webcodecs` | `wasm`(`public/wasm` 필요)
- 오디오: WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`**(`auto` / `avc` / `hevc`), **`probeHttpFlv`**(헤더만 읽기, 디코딩 없음)
- **`apps/website`**: React + Tailwind v4 + shadcn/ui 데모, `@live-player/core` 소스 직접 참조

## 프로젝트에서 사용

### 설치

```bash
pnpm add @live-player/core
```

### 최소 예제

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

프로브, 콜백, 정지 등은 **[`docs/using-live-player.md`](docs/using-live-player.md)** 참고.

## 아키텍처

**계층**: `apps/website` → **`@live-player/core`**; [`wasm/`](wasm/) 빌드 산출물은 호스트 **`public/wasm/`**에 배치(또는 `wasmScriptUrl`).

**파이프라인**: HTTP 스트리밍 → **`FlvDemuxer`** → 비디오 **WebCodecs 또는 WASM**, 오디오 **WebCodecs** → Canvas / Web Audio. 설계 및 H.265 FLV 세부는 [`docs/architecture-demux-decoders.md`](docs/architecture-demux-decoders.md), [`docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md`](docs/superpowers/specs/2026-04-10-hevc-flv-dual-format-design.md).

```
HTTP → FLV demux(H.264 / H.265 + AAC)
         ↓
   비디오: WebCodecs 또는 WASM     오디오: AudioDecoder
         ↓                           ↓
        Canvas / WebGL            Web Audio
```

## 로컬 수집(선택)

로컬에서 RTMP → HTTP-FLV(Monibuca, SRS 등)를 띄우고 데모 기본값 `http://localhost:8080/flv/live/test`에 맞춥니다. 로컬 **`push-command/`**(gitignore될 수 있음)가 있으면 해당 README대로 ffmpeg로 `rtmp://127.0.0.1:1935/live/test`에 푸시합니다.

## 라이선스

각 패키지 `package.json`의 `license`를 따릅니다(`@live-player/core`는 **MIT**).
