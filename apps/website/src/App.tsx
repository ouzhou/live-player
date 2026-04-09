import { Clapperboard, ExternalLink, Radio, Sparkles } from "lucide-react";

import { LivePlayerPanel } from "@/components/live-player-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REPO_URL = "https://github.com/ouzhou/live-player";

export default function App() {
  return (
    <div className="bg-zinc-50 text-foreground">
      <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-14">
        <header className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1 font-normal" variant="secondary">
                <Sparkles className="size-3.5" aria-hidden />
                HTTP-FLV
              </Badge>
              <Badge className="gap-1 font-normal" variant="outline">
                <Radio className="size-3.5" aria-hidden />
                WebCodecs / WASM
              </Badge>
            </div>
            <a
              className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm underline-offset-4 transition-colors hover:underline"
              href={REPO_URL}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-4 shrink-0" aria-hidden />
              ouzhou/live-player
            </a>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Clapperboard className="size-6" aria-hidden />
            </span>
            <div>
              <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                LivePlayer
              </h1>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                在浏览器中播放直播流，支持 WebCodecs 与 WASM 两种解码路径。
              </p>
            </div>
          </div>
        </header>

        <Card className="border-border shadow-md">
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
