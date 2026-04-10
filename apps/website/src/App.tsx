import { Clapperboard, ExternalLink } from "lucide-react";

import { LivePlayerPanel } from "@/components/live-player-panel";

const REPO_URL = "https://github.com/ouzhou/live-player";

export default function App() {
  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-linear-to-b from-white/70 via-white/15 to-transparent" />
      <div className="relative mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Clapperboard className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Live Player</h1>
              <p className="text-sm text-muted-foreground">HTTP-FLV live</p>
            </div>
          </div>
          <a
            className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 rounded-full border border-input bg-white px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={REPO_URL}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            View on GitHub
          </a>
        </header>

        <main id="main-content" className="min-w-0 flex-1 pb-8">
          <LivePlayerPanel />
        </main>
      </div>
    </div>
  );
}
