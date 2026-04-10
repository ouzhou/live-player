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

/** 相对当前页面解析，避免 `/wasm/shell.js` 固定到站点根（子路径部署或 `file://` 打开 dist 时会 404） */
function wasmScriptUrl(): string {
  return new URL("wasm/shell.js", document.baseURI).href;
}

export function LivePlayerPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<LivePlayer | null>(null);
  const playerDecodeModeRef = useRef<DecodeMode | null>(null);
  const playerVideoHintRef = useRef<VideoCodecHint | null>(null);

  const [url, setUrl] = useState(DEMO_FLV_URL);
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
    setStreamActive(false);
  }, []);

  useEffect(() => () => destroyPlayer(), [destroyPlayer]);

  const buildPlayer = useCallback((mode: DecodeMode, hint: VideoCodecHint): LivePlayer => {
    const container = hostRef.current;
    if (!container) {
      throw new Error("播放器容器未就绪");
    }
    const onError = (err: Error) => {
      setStreamActive(false);
      setStatus(`错误: ${err.message}`);
    };
    const onPlaying = () => {
      setStreamActive(true);
      if (mode === "auto") {
        setStatus("已连接流…");
      } else if (mode === "wasm") {
        setStatus("已连接流（WASM 视频 + WebGL）");
      } else {
        setStatus("已连接流（WebCodecs 硬解）");
      }
    };
    return new LivePlayer({
      container,
      decodeMode: mode,
      wasmScriptUrl: wasmScriptUrl(),
      videoCodecHint: hint,
      onError,
      onPlaying,
      onVideoBackend:
        mode === "auto"
          ? (b) =>
              setStatus(
                b === "webcodecs" ? "已连接流（自动：WebCodecs）" : "已连接流（自动：WASM）",
              )
          : undefined,
    });
  }, []);

  const ensurePlayer = useCallback((): LivePlayer => {
    const mode = decodeMode;
    if (
      playerRef.current &&
      (playerDecodeModeRef.current !== mode || playerVideoHintRef.current !== videoCodec)
    ) {
      destroyPlayer();
    }
    if (!playerRef.current) {
      playerDecodeModeRef.current = mode;
      playerVideoHintRef.current = videoCodec;
      playerRef.current = buildPlayer(mode, videoCodec);
    }
    return playerRef.current;
  }, [buildPlayer, decodeMode, destroyPlayer, videoCodec]);

  const handleDecodeChange = useCallback(
    (value: string | null) => {
      if (value !== "wasm" && value !== "webcodecs" && value !== "auto") return;
      setDecodeMode(value);
      destroyPlayer();
      setStatus("已切换解码方式，请再次点击播放");
    },
    [destroyPlayer],
  );

  const handleVideoCodecChange = useCallback(
    (value: string | null) => {
      if (value !== "avc" && value !== "hevc" && value !== "auto") return;
      setVideoCodec(value);
      destroyPlayer();
      setStatus("已切换视频编码，请再次点击播放");
    },
    [destroyPlayer],
  );

  const handlePlay = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus("请填写 URL");
      return;
    }
    setStreamActive(false);
    setStatus("请求中…");
    try {
      await ensurePlayer().play(trimmed);
    } catch {
      /* onError 已报 */
    }
  };

  const handleDestroy = () => {
    destroyPlayer();
    setStatus("已停止");
  };

  const handleProbe = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setProbeInfo("请填写 URL");
      return;
    }
    setProbeBusy(true);
    setProbeInfo("探测中…");
    try {
      const r = await probeHttpFlv(trimmed);
      const lines: string[] = [];
      if (r.video) {
        lines.push(`视频（WebCodecs codec）: ${r.video.codec}`);
        const v = r.video.codec;
        const kind = v.startsWith("avc1")
          ? "H.264/AVC"
          : v.startsWith("hev1") || v.startsWith("hvc1")
            ? "H.265/HEVC"
            : "未知";
        lines.push(`  → 识别为: ${kind}`);
        if (typeof VideoDecoder !== "undefined") {
          try {
            const sup = await VideoDecoder.isConfigSupported({
              codec: r.video.codec,
              description: r.video.description,
            });
            lines.push(
              `  → 当前环境 VideoDecoder: ${sup.supported ? "支持该配置" : "不支持该配置"}`,
            );
          } catch {
            lines.push("  → VideoDecoder.isConfigSupported 调用失败");
          }
        } else {
          lines.push("  → 无 VideoDecoder API，跳过硬解探测");
        }
      } else {
        lines.push("视频: （未解析到序列头）");
      }
      if (r.audio) {
        lines.push(`音频（WebCodecs codec）: ${r.audio.codec}`);
        if (typeof AudioDecoder !== "undefined") {
          try {
            const { codec, numberOfChannels, sampleRate } = audioSpecificConfigToDecoderParams(
              r.audio.description,
            );
            lines.push(`  → 采样率 ${sampleRate} Hz，声道 ${numberOfChannels}`);
            const sup = await AudioDecoder.isConfigSupported({
              codec,
              description: r.audio.description,
              numberOfChannels,
              sampleRate,
            });
            lines.push(
              `  → 当前环境 AudioDecoder: ${sup.supported ? "支持该配置" : "不支持该配置"}`,
            );
          } catch (e) {
            lines.push(
              `  → AudioDecoder.isConfigSupported 调用失败: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        } else {
          lines.push("  → 无 AudioDecoder API，跳过探测");
        }
      } else {
        lines.push("音频: （未解析到 AudioSpecificConfig）");
      }
      lines.push(`已读取: ${r.bytesRead} 字节`);
      if (r.ok) {
        lines.unshift("状态: 已识别音视频轨");
      } else {
        lines.unshift(`状态: 未完成${r.error ? `（${r.error}）` : ""}`);
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
          <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-5 py-5 sm:px-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">视频解码</p>
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
                  自动
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

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">视频编码</p>
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
                  自动
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
                <p className="text-sm font-medium text-foreground">检测信息</p>
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
          <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">画面</CardTitle>
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
                  播放
                </Button>
                <Button
                  className="h-11 rounded-full px-4"
                  type="button"
                  variant="outline"
                  onClick={handleDestroy}
                >
                  停止
                </Button>
                <Button
                  className="h-11 rounded-full border-input bg-white px-4"
                  type="button"
                  variant="secondary"
                  disabled={probeBusy}
                  onClick={() => void handleProbe()}
                >
                  {probeBusy ? "检测中…" : "检测流"}
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
                <span className="text-sm text-zinc-500">未连接流</span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
