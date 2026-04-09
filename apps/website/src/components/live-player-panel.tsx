import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_WASM_SCRIPT_URL, LivePlayer, type DecodeMode } from "@live-player/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

const DEMO_FLV_URL = "http://localhost:8080/flv/live/test";

export function LivePlayerPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<LivePlayer | null>(null);
  const playerDecodeModeRef = useRef<DecodeMode | null>(null);

  const [url, setUrl] = useState(DEMO_FLV_URL);
  const [decodeMode, setDecodeMode] = useState<DecodeMode>("webcodecs");
  const [status, setStatus] = useState("");

  const destroyPlayer = useCallback(() => {
    playerRef.current?.destroy();
    playerRef.current = null;
    playerDecodeModeRef.current = null;
  }, []);

  useEffect(() => () => destroyPlayer(), [destroyPlayer]);

  const buildPlayer = useCallback((mode: DecodeMode): LivePlayer => {
    const container = hostRef.current;
    if (!container) {
      throw new Error("播放器容器未就绪");
    }
    const onError = (err: Error) => {
      setStatus(`错误: ${err.message}`);
    };
    const onPlaying = () => {
      setStatus(mode === "wasm" ? "已连接流（WASM 视频 + WebGL）" : "已连接流（WebCodecs 硬解）");
    };
    if (mode === "wasm") {
      return new LivePlayer({
        container,
        decodeMode: "wasm",
        wasmScriptUrl: DEFAULT_WASM_SCRIPT_URL,
        onError,
        onPlaying,
      });
    }
    return new LivePlayer({
      container,
      decodeMode: "webcodecs",
      onError,
      onPlaying,
    });
  }, []);

  const ensurePlayer = useCallback((): LivePlayer => {
    const mode = decodeMode;
    if (playerRef.current && playerDecodeModeRef.current !== mode) {
      destroyPlayer();
    }
    if (!playerRef.current) {
      playerDecodeModeRef.current = mode;
      playerRef.current = buildPlayer(mode);
    }
    return playerRef.current;
  }, [buildPlayer, decodeMode, destroyPlayer]);

  const handleDecodeChange = useCallback(
    (value: string | null) => {
      if (value !== "wasm" && value !== "webcodecs") return;
      setDecodeMode(value);
      destroyPlayer();
      setStatus("已切换解码方式，请再次点击播放");
    },
    [destroyPlayer],
  );

  const handlePlay = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus("请填写 URL");
      return;
    }
    setStatus("请求中…");
    try {
      await ensurePlayer().play(trimmed);
    } catch {
      /* onError 已报 */
    }
  };

  const handleDestroy = () => {
    destroyPlayer();
    setStatus("已停止并销毁播放器");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-foreground">视频解码</Label>
        <RadioGroup
          className="flex flex-col gap-3 sm:flex-row sm:gap-6"
          value={decodeMode}
          onValueChange={handleDecodeChange}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <RadioGroupItem value="webcodecs" id="decode-webcodecs" />
            <span className="space-y-0.5">
              <span className="text-sm font-medium leading-none">WebCodecs</span>
              <span className="text-muted-foreground block text-xs">硬解 + Canvas 2D</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <RadioGroupItem value="wasm" id="decode-wasm" />
            <span className="space-y-0.5">
              <span className="text-sm font-medium leading-none">WASM + WebGL</span>
              <span className="text-muted-foreground block text-xs">
                需 <code className="bg-muted rounded px-0.5">public/wasm/shell.js</code>
              </span>
            </span>
          </label>
        </RadioGroup>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="flv-url">HTTP-FLV URL</Label>
        <Input
          id="flv-url"
          type="url"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://..."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handlePlay()}>
          播放
        </Button>
        <Button type="button" variant="outline" onClick={handleDestroy}>
          销毁
        </Button>
      </div>

      <p className="min-h-[1.25rem] text-sm text-emerald-700" role="status">
        {status}
      </p>

      <div
        ref={hostRef}
        className="bg-muted/50 aspect-video min-h-[200px] w-full overflow-hidden rounded-xl border"
      />
    </div>
  );
}
