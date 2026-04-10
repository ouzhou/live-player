# live-player

**언어:** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md)

실험적 **HTTP-FLV** 플레이어 SDK: **H.264 / H.265(HEVC)** 비디오, **AAC** 오디오. 자체 FLV demux(레거시 H.265, Enhanced RTMP 등), **WebCodecs**로 Canvas / Web Audio 출력. 선택 사항으로 **직접 빌드한** FFmpeg **WASM + WebGL**(**H.264 소프트 디코드만**, [`wasm/PACKAGING.md`](wasm/PACKAGING.md) 참고). **미리 빌드된 `shell.js` / `shell.wasm` 은 이 저장소에 포함하지 않습니다**(데모에서 H.265 는 **WebCodecs** 로 재생해 특허·라이선스 배포 부담을 줄임). **`@live-player/core` 는 npm 에 게시하지 않습니다.** 저장소는 **pnpm workspace**, 도구 체인은 **Vite+**(`vp`).

## 라이브 데모

**[https://flv-live-player.vercel.app/](https://flv-live-player.vercel.app/)** (`apps/website`)

## 기능

- HTTP-FLV 수신, 자체 demux, **H.264 / H.265** 단일 파이프라인
- 비디오 **`decodeMode`**: `auto`(WASM 이 있을 때 첫 프레임 후 WebCodecs ↔ WASM) | `webcodecs` | `wasm`(로컬 빌드 산출물을 호스트 `public/wasm/` 또는 `wasmScriptUrl` 에 두어야 함; 여기에는 바이너리를 묶지 않음)
- 오디오: WebCodecs `AudioDecoder` + Web Audio
- **`videoCodecHint`**(`auto` / `avc` / `hevc`), **`probeHttpFlv`**(헤더만 읽기, 디코딩 없음)
- **`apps/website`**: React + Tailwind v4 + shadcn/ui 데모, `@live-player/core` 소스 직접 참조

## 프로젝트에서 사용

**npm 패키지 없음**: **`@live-player/core` 는 게시하지 않습니다.** 이 모노레포를 workspace 로 쓰거나, `pnpm link`, Git URL, 또는 `packages/core` 를 직접 포함하세요.

### 최소 예제

```ts
import { LivePlayer } from "@live-player/core";

const player = new LivePlayer({ container: document.getElementById("player-root")! });
await player.play("https://example.com/live.flv");
```

프로브, 콜백, 정지 등은 **[`docs/using-live-player.md`](docs/using-live-player.md)** 참고.

## 아키텍처

**계층**: `apps/website` → **`@live-player/core`**; WASM 을 직접 빌드하면 [`wasm/`](wasm/) 산출물을 호스트 **`public/wasm/`**에 복사(또는 `wasmScriptUrl`). `public/wasm/` 의 배포용 바이너리는 이 저장소에 커밋하지 않습니다.

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
