"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";

import { markVideoWatchedAction, saveWatchProgressAction } from "@/app/(app)/watch/watch-actions";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/playlist-maths";
import { cn } from "@/lib/utils";

/*
 * Minimal shape of the bits of the IFrame API this component uses.
 */
type YTPlayer = {
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement | string, options: unknown) => YTPlayer;
      PlayerState: { PLAYING: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYING = 1;
const SAVE_EVERY_SECONDS = 15;
const COMPLETION_RATIO = 0.9;

/*
 * Credit is measured in video seconds advanced, not wall-clock seconds elapsed.
 * That matters because playback speed changes the relationship between the two:
 * at 2x, ten minutes of video passes in five minutes of your life, and counting
 * the clock would punish you for watching faster.
 *
 * A jump larger than this is a seek, not playback, so it earns nothing. Five
 * seconds per one-second tick leaves room for 4x while still catching scrubs.
 */
const MAX_CREDIT_PER_TICK = 5;

export function VideoPlayer({
  videoId,
  youtubeId,
  title,
  durationSeconds,
  initialSeconds,
  alreadyWatched,
}: {
  videoId: string;
  youtubeId: string;
  title: string;
  durationSeconds: number;
  initialSeconds: number;
  alreadyWatched: boolean;
}) {
  const router = useRouter();
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const lastTick = useRef<number | null>(null);

  const [watched, setWatched] = useState(initialSeconds);
  const [complete, setComplete] = useState(alreadyWatched);
  const [saving, setSaving] = useState(false);

  const watchedRef = useRef(initialSeconds);
  const savedAt = useRef(initialSeconds);
  const completeRef = useRef(alreadyWatched);

  const target = Math.floor(durationSeconds * COMPLETION_RATIO);

  const persist = useCallback(
    async (seconds: number) => {
      setSaving(true);
      const result = await saveWatchProgressAction({ videoId, watchedSeconds: seconds });
      setSaving(false);
      savedAt.current = seconds;

      if (result.completed && !completeRef.current) {
        completeRef.current = true;
        setComplete(true);
        router.refresh();
      }
    },
    [videoId, router],
  );

  useEffect(() => {
    function create() {
      if (!holder.current || !window.YT?.Player) return;

      player.current = new window.YT.Player(holder.current, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      });
    }

    if (window.YT?.Player) {
      create();
    } else {
      // Injected imperatively: React refuses to render a <script> element.
      if (!document.getElementById("yt-iframe-api")) {
        const script = document.createElement("script");
        script.id = "yt-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
      window.onYouTubeIframeAPIReady = create;
    }

    const timer = window.setInterval(() => {
      const instance = player.current;
      if (!instance || typeof instance.getCurrentTime !== "function") return;

      if (instance.getPlayerState() !== PLAYING) {
        lastTick.current = null; // paused, so the next tick starts a fresh span
        return;
      }

      const position = instance.getCurrentTime();

      if (lastTick.current === null) {
        lastTick.current = position;
        return;
      }

      const advanced = position - lastTick.current;
      lastTick.current = position;

      // Backwards is a rewind, forwards beyond the cap is a skip. Neither is
      // watching, so neither earns anything.
      if (advanced <= 0 || advanced > MAX_CREDIT_PER_TICK) return;

      watchedRef.current = Math.min(
        durationSeconds || Infinity,
        watchedRef.current + advanced,
      );
      setWatched(Math.round(watchedRef.current));

      if (
        !completeRef.current &&
        watchedRef.current - savedAt.current >= SAVE_EVERY_SECONDS
      ) {
        void persist(Math.round(watchedRef.current));
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      if (watchedRef.current > savedAt.current) void persist(Math.round(watchedRef.current));
      player.current?.destroy?.();
      player.current = null;
    };
  }, [youtubeId, durationSeconds, persist]);

  const progress = durationSeconds > 0 ? Math.min(1, watched / durationSeconds) : 0;
  const toTarget = Math.max(0, target - watched);

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <div className="aspect-video w-full bg-void">
          <div ref={holder} className="h-full w-full" />
        </div>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-data text-[11px] tracking-widest text-muted">WATCHED</p>
          <p className="font-data text-[11px] tabular-nums text-faint">
            {formatDuration(watched)} of {formatDuration(durationSeconds)}
            {saving ? " · saving" : ""}
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-1000",
              complete ? "bg-good" : "bg-amber",
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {complete ? (
          <p className="font-data mt-3 flex items-center gap-2 text-sm text-good">
            <Check size={14} strokeWidth={3} /> Counted. The task is ticked.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {formatDuration(toTarget)} of the video left before this counts. Any speed is fine, it
            measures the video, not the clock. Skipping ahead earns nothing.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <a
            href={`https://www.youtube.com/watch?v=${youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-data flex items-center gap-1.5 text-[11px] tracking-widest text-muted hover:text-ink"
          >
            <ExternalLink size={13} /> OPEN ON YOUTUBE
          </a>

          {!complete ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                void markVideoWatchedAction(videoId).then((result) => {
                  if (result.completed) {
                    setComplete(true);
                    completeRef.current = true;
                    router.refresh();
                  }
                });
              }}
            >
              I watched this elsewhere
            </Button>
          ) : null}
        </div>
      </section>

      <p className="text-xs text-faint">{title}</p>
    </div>
  );
}
