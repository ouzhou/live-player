import { Clapperboard, Radio, Sparkles } from "lucide-react";

import { LivePlayerPanel } from "@/components/live-player-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,oklch(0.55_0.22_264/0.35),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,oklch(0.45_0.15_200/0.12),transparent_50%)]"
      />
      <div className="relative mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <header className="space-y-3 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Badge className="gap-1 font-normal" variant="secondary">
              <Sparkles className="size-3.5" aria-hidden />
              HTTP-FLV
            </Badge>
            <Badge className="gap-1 font-normal" variant="outline">
              <Radio className="size-3.5" aria-hidden />
              WebCodecs / WASM
            </Badge>
          </div>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <Clapperboard className="size-6" aria-hidden />
              </span>
              <div className="text-left">
                <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                  LivePlayer
                </h1>
                <p className="text-muted-foreground text-sm">
                  在浏览器中播放直播流，支持 WebCodecs 与 WASM 两种解码路径。
                </p>
              </div>
            </div>
          </div>
        </header>

        <Card className="border-border/80 shadow-xl shadow-black/20">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg">播放演示</CardTitle>
            <CardDescription>
              填入 HTTP-FLV 地址后播放。开发环境默认指向本地 Monibuca 示例流（需先启动推流，参见仓库{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">scripts/run.md</code>
              ）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LivePlayerPanel />
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs sm:text-left">
          <code className="bg-muted rounded px-1.5 py-0.5">@live-player/core</code>{" "}
          在开发模式下直连包内源码，便于调试。
        </p>
      </div>
    </div>
  );
}
