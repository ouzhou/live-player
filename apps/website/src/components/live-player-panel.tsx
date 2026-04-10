import { useCallback, useEffect, useRef, useState } from "react";

import {
  audioSpecificConfigToDecoderParams,
  LivePlayer,
  probeHttpFlv,
  type DecodeMode,
  type VideoCodecHint,
} from "@live-player/core";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

const DEMO_FLV_URL = "http://localhost:8080/flv/live/test";

export function LivePlayerPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<LivePlayer | null>(null);
  const playerDecodeModeRef = useRef<DecodeMode | null>(null);
  const playerVideoHintRef = useRef<VideoCodecHint | null>(null);
  const playerWasmUrlRef = useRef<string | null>(null);

  const [url, setUrl] = useState(DEMO_FLV_URL);
  const [wasmUrl, setWasmUrl] = useState(() => new URL("wasm/shell.js", document.baseURI).href);
  const [videoCodec, setVideoCodec] = useState<VideoCodecHint>("auto");
  const [decodeMode, setDecodeMode] = useState<DecodeMode>("auto");
  const [status, setStatus] = useState("");
  const [probeInfo, setProbeInfo] = useState("");
  const [probeBusy, setProbeBusy] = useState(false);
  const [streamActive, setStreamActive] = useState(false);

  const destroyPlayer = useCallback(() => {
    playerRef.current?.destroy();
    playerRef.current = null;
    playerDecodeModeRef.current = null;
    playerVideoHintRef.current = null;
    playerWasmUrlRef.current = null;
    setStreamActive(false);
  }, []);

  useEffect(() => () => destroyPlayer(), [destroyPlayer]);

  const buildPlayer = useCallback(
    (mode: DecodeMode, hint: VideoCodecHint): LivePlayer => {
      const container = hostRef.current;
      if (!container) {
        throw new Error("Player container is not ready");
      }
      const onError = (err: Error) => {
        setStreamActive(false);
        setStatus(`Error: ${err.message}`);
      };
      const onPlaying = () => {
        setStreamActive(true);
        if (mode === "auto") {
          setStatus("Stream connected…");
        } else if (mode === "wasm") {
          setStatus("Stream connected (WASM video + WebGL)");
        } else {
          setStatus("Stream connected (WebCodecs)");
        }
      };
      const script = wasmUrl.trim() || new URL("wasm/shell.js", document.baseURI).href;
      return new LivePlayer({
        container,
        decodeMode: mode,
        wasmScriptUrl: script,
        videoCodecHint: hint,
        onError,
        onPlaying,
        onVideoBackend:
          mode === "auto"
            ? (b) =>
                setStatus(
                  b === "webcodecs"
                    ? "Stream connected (auto: WebCodecs)"
                    : "Stream connected (auto: WASM)",
                )
            : undefined,
      });
    },
    [wasmUrl],
  );

  const ensurePlayer = useCallback((): LivePlayer => {
    const mode = decodeMode;
    const wasmKey = wasmUrl.trim();
    if (
      playerRef.current &&
      (playerDecodeModeRef.current !== mode ||
        playerVideoHintRef.current !== videoCodec ||
        playerWasmUrlRef.current !== wasmKey)
    ) {
      destroyPlayer();
    }
    if (!playerRef.current) {
      playerDecodeModeRef.current = mode;
      playerVideoHintRef.current = videoCodec;
      playerWasmUrlRef.current = wasmKey;
      playerRef.current = buildPlayer(mode, videoCodec);
    }
    return playerRef.current;
  }, [buildPlayer, decodeMode, destroyPlayer, videoCodec, wasmUrl]);

  const handleDecodeChange = useCallback(
    (value: string | null) => {
      if (value !== "wasm" && value !== "webcodecs" && value !== "auto") return;
      setDecodeMode(value);
      destroyPlayer();
      setStatus("Decode mode changed — press Play again");
    },
    [destroyPlayer],
  );

  const handleVideoCodecChange = useCallback(
    (value: string | null) => {
      if (value !== "avc" && value !== "hevc" && value !== "auto") return;
      setVideoCodec(value);
      destroyPlayer();
      setStatus("Video codec hint changed — press Play again");
    },
    [destroyPlayer],
  );

  const handlePlay = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus("Enter a URL");
      return;
    }
    setStreamActive(false);
    setStatus("Connecting…");
    try {
      await ensurePlayer().play(trimmed);
    } catch {
      /* onError reports */
    }
  };

  const handleDestroy = () => {
    destroyPlayer();
    setStatus("Stopped");
  };

  const handleProbe = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setProbeInfo("Enter a URL");
      return;
    }
    setProbeBusy(true);
    setProbeInfo("Probing…");
    try {
      const r = await probeHttpFlv(trimmed);
      const lines: string[] = [];
      if (r.video) {
        lines.push(`Video (WebCodecs codec): ${r.video.codec}`);
        const v = r.video.codec;
        const kind = v.startsWith("avc1")
          ? "H.264/AVC"
          : v.startsWith("hev1") || v.startsWith("hvc1")
            ? "H.265/HEVC"
            : "unknown";
        lines.push(`  → Detected as: ${kind}`);
        if (typeof VideoDecoder !== "undefined") {
          try {
            const sup = await VideoDecoder.isConfigSupported({
              codec: r.video.codec,
              description: r.video.description,
            });
            lines.push(
              `  → VideoDecoder in this browser: ${sup.supported ? "config supported" : "config not supported"}`,
            );
          } catch {
            lines.push("  → VideoDecoder.isConfigSupported failed");
          }
        } else {
          lines.push("  → No VideoDecoder API; skipped hardware decode check");
        }
      } else {
        lines.push("Video: (no sequence header parsed)");
      }
      if (r.audio) {
        lines.push(`Audio (WebCodecs codec): ${r.audio.codec}`);
        if (typeof AudioDecoder !== "undefined") {
          try {
            const { codec, numberOfChannels, sampleRate } = audioSpecificConfigToDecoderParams(
              r.audio.description,
            );
            lines.push(`  → Sample rate ${sampleRate} Hz, channels ${numberOfChannels}`);
            const sup = await AudioDecoder.isConfigSupported({
              codec,
              description: r.audio.description,
              numberOfChannels,
              sampleRate,
            });
            lines.push(
              `  → AudioDecoder in this browser: ${sup.supported ? "config supported" : "config not supported"}`,
            );
          } catch (e) {
            lines.push(
              `  → AudioDecoder.isConfigSupported failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        } else {
          lines.push("  → No AudioDecoder API; skipped");
        }
      } else {
        lines.push("Audio: (no AudioSpecificConfig parsed)");
      }
      lines.push(`Bytes read: ${r.bytesRead}`);
      if (r.ok) {
        lines.unshift("Status: audio and video tracks identified");
      } else {
        lines.unshift(`Status: incomplete${r.error ? ` (${r.error})` : ""}`);
      }
      setProbeInfo(lines.join("\n"));
    } catch (e) {
      setProbeInfo(e instanceof Error ? e.message : String(e));
    } finally {
      setProbeBusy(false);
    }
  };

  return (
    <div
      id="player-demo"
      className="grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)] lg:items-start lg:gap-8"
    >
      <Card className="min-w-0 border border-border bg-card py-0 shadow-lg">
        <CardHeader className="border-b border-border px-5 py-4 sm:px-6 sm:py-5">
          <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-5 py-5 sm:px-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Video decode</p>
            <RadioGroup
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6"
              value={decodeMode}
              onValueChange={handleDecodeChange}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="auto" id="decode-auto" />
                <label
                  className="cursor-pointer text-sm font-medium leading-none"
                  htmlFor="decode-auto"
                >
                  Auto
                </label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="webcodecs" id="decode-webcodecs" />
                <label
                  className="cursor-pointer text-sm font-medium leading-none"
                  htmlFor="decode-webcodecs"
                >
                  WebCodecs
                </label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="wasm" id="decode-wasm" />
                <label
                  className="cursor-pointer text-sm font-medium leading-none"
                  htmlFor="decode-wasm"
                >
                  WASM
                </label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="wasm-script-url">WASM glue (shell.js) URL</Label>
            <Input
              id="wasm-script-url"
              name="wasmScriptUrl"
              type="url"
              autoComplete="off"
              inputMode="url"
              className="h-11 rounded-2xl bg-white px-4 text-sm"
              spellCheck={false}
              value={wasmUrl}
              onChange={(e) => {
                setWasmUrl(e.target.value);
                destroyPlayer();
                setStatus("WASM URL changed — press Play again");
              }}
              placeholder="/wasm/shell.js or full https://…"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              To reduce{" "}
              <strong className="font-medium text-foreground">patent and licensing exposure</strong>{" "}
              from shipping a software decoder for{" "}
              <strong className="font-medium text-foreground">H.265 (HEVC)</strong> on the web, this
              demo plays H.265 only via the browser{" "}
              <strong className="font-medium text-foreground">WebCodecs</strong> path—there is no
              HEVC software decode inside WASM. Use this URL to load the Emscripten glue (
              <code className="rounded bg-muted px-1 py-0.5">shell.js</code>, next to{" "}
              <code className="rounded bg-muted px-1 py-0.5">shell.wasm</code>) that contains{" "}
              <strong className="font-medium text-foreground">H.264 soft-decode only</strong>, for
              Auto / WASM fallback when needed. Build from{" "}
              <code className="rounded bg-muted px-1 py-0.5">wasm/PACKAGING.md</code>, then paste or
              deploy to a reachable URL.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Video codec</p>
            <RadioGroup
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6"
              value={videoCodec}
              onValueChange={handleVideoCodecChange}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="auto" id="video-auto" />
                <label
                  className="cursor-pointer text-sm font-medium leading-none"
                  htmlFor="video-auto"
                >
                  Auto
                </label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="avc" id="video-avc" />
                <label
                  className="cursor-pointer text-sm font-medium leading-none"
                  htmlFor="video-avc"
                >
                  H.264
                </label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="hevc" id="video-hevc" />
                <label
                  className="cursor-pointer text-sm font-medium leading-none"
                  htmlFor="video-hevc"
                >
                  H.265
                </label>
              </div>
            </RadioGroup>
          </div>

          {probeInfo ? (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Probe output</p>
                <pre className="max-h-64 overflow-auto rounded-2xl border bg-white p-3 text-left text-xs leading-relaxed whitespace-pre-wrap text-foreground sm:p-4">
                  {probeInfo}
                </pre>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="min-w-0 border border-border bg-card py-0 shadow-lg lg:sticky lg:top-6">
        <CardHeader className="space-y-0.5 border-b border-border px-5 py-4 sm:px-6 sm:py-5">
          <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">Player</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-2">
            <Label htmlFor="flv-url">HTTP-FLV URL</Label>
            <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
              <Input
                id="flv-url"
                name="flvUrl"
                type="url"
                autoComplete="off"
                inputMode="url"
                className="h-11 min-w-0 flex-1 rounded-2xl bg-white px-4 text-sm"
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://…"
              />
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  className="h-11 rounded-full px-4"
                  type="button"
                  onClick={() => void handlePlay()}
                >
                  Play
                </Button>
                <Button
                  className="h-11 rounded-full px-4"
                  type="button"
                  variant="outline"
                  onClick={handleDestroy}
                >
                  Stop
                </Button>
                <Button
                  className="h-11 rounded-full border-input bg-white px-4"
                  type="button"
                  variant="secondary"
                  disabled={probeBusy}
                  onClick={() => void handleProbe()}
                >
                  {probeBusy ? "Probing…" : "Probe stream"}
                </Button>
              </div>
            </div>
          </div>

          <output aria-live="polite" className="block min-h-[1.25rem] text-sm text-emerald-700">
            {status}
          </output>

          <div className="relative aspect-video min-h-[180px] w-full overflow-hidden rounded-2xl border bg-black">
            <div ref={hostRef} className="absolute inset-0 min-h-0 min-w-0" />
            {!streamActive ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-zinc-500">No stream</span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
