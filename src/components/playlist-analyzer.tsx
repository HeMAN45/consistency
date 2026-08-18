"use client";

import { useMemo, useState } from "react";

import { formatDuration, finishDayKey, type PlaylistStats } from "@/lib/playlist-maths";
import { cn } from "@/lib/utils";

type Result = {
  kind: "PLAYLIST" | "SINGLE";
  playlist: {
    youtubeId: string;
    title: string;
    channelTitle: string | null;
    thumbnailUrl: string | null;
  };
  stats: PlaylistStats;
  videos: {
    youtubeId: string;
    title: string;
    position: number;
    durationSeconds: number;
    available: boolean;
  }[];
};

const PACES = [1, 2, 3, 5];

function formatDayLabel(key: string) {
  const date = new Date(`${key}T00:00:00.000Z`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PlaylistAnalyzer({ todayKey }: { todayKey: string }) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowAll(false);

    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const body = (await response.json()) as Result & { error?: string };
      if (!response.ok) setError(body.error ?? "Could not read that link.");
      else setResult(body);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const paces = useMemo(() => {
    if (!result) return [];
    return PACES.map((perDay) => ({
      perDay,
      finish: finishDayKey(todayKey, result.stats.available, perDay),
      days: Math.ceil(result.stats.available / perDay),
    }));
  }, [result, todayKey]);

  const visible = result ? (showAll ? result.videos : result.videos.slice(0, 12)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && url.trim()) void analyze();
          }}
          placeholder="https://youtube.com/playlist?list=..."
          aria-label="YouTube playlist or video link"
          className="font-data h-11 flex-1 rounded-md border border-line bg-void px-3 text-sm text-ink placeholder:text-faint focus:border-amber focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={loading || url.trim().length === 0}
          className="font-data h-11 rounded-md bg-amber px-6 text-sm text-void transition-colors hover:bg-amber-soft disabled:opacity-50"
        >
          {loading ? "Reading…" : "Analyze"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}

      {result ? (
        <>
          <div className="card p-5">
            <p className="font-data text-[11px] tracking-widest text-amber">
              {result.kind === "SINGLE" ? "SINGLE VIDEO" : "PLAYLIST"}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">
              {result.playlist.title}
            </h2>
            {result.playlist.channelTitle ? (
              <p className="mt-1 text-sm text-muted">{result.playlist.channelTitle}</p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="VIDEOS" value={String(result.stats.available)} />
              <Stat label="TOTAL" value={formatDuration(result.stats.totalSeconds)} />
              <Stat label="AVERAGE" value={formatDuration(result.stats.averageSeconds)} />
              <Stat label="LONGEST" value={formatDuration(result.stats.longestSeconds)} />
            </div>

            {result.stats.unavailable > 0 ? (
              <p className="mt-4 text-xs text-warn">
                {result.stats.unavailable} video
                {result.stats.unavailable === 1 ? " is" : "s are"} deleted or private. Excluded from
                every total above.
              </p>
            ) : null}
          </div>

          <div className="card p-5">
            <p className="font-data text-[11px] tracking-widest text-muted">AT EACH SPEED</p>
            <dl className="font-data mt-3">
              {result.stats.bySpeed.map((entry) => (
                <div
                  key={entry.speed}
                  className="flex items-baseline justify-between border-b border-line py-2.5 last:border-0"
                >
                  <dt className="text-muted">{entry.speed}x</dt>
                  <dd className="text-ink-soft">{formatDuration(entry.seconds)}</dd>
                </div>
              ))}
            </dl>
          </div>

          {result.stats.available > 1 ? (
            <div className="card p-5">
              <p className="font-data text-[11px] tracking-widest text-muted">IF YOU COMMIT</p>
              <ul className="mt-3 space-y-2">
                {paces.map((pace) => (
                  <li key={pace.perDay} className="text-sm">
                    <span className="font-data text-ink">
                      {pace.perDay} a day
                    </span>
                    <span className="text-muted">
                      {" "}
                      finishes {pace.finish ? formatDayLabel(pace.finish) : "never"}
                    </span>
                    <span className="font-data text-faint"> · {pace.days} days</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="card p-5">
            <div className="flex items-baseline justify-between">
              <p className="font-data text-[11px] tracking-widest text-muted">VIDEOS</p>
              <p className="font-data text-[11px] text-faint">{result.videos.length}</p>
            </div>

            <ol className="mt-3">
              {visible.map((video, index) => (
                <li
                  key={`${video.youtubeId}-${index}`}
                  className="flex items-baseline gap-3 border-b border-line py-2 last:border-0"
                >
                  <span className="font-data w-7 shrink-0 text-xs tabular-nums text-faint">
                    {video.position + 1}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      video.available ? "text-ink-soft" : "text-faint line-through",
                    )}
                  >
                    {video.title}
                  </span>
                  <span className="font-data shrink-0 text-xs tabular-nums text-muted">
                    {video.available ? formatDuration(video.durationSeconds) : "unavailable"}
                  </span>
                </li>
              ))}
            </ol>

            {result.videos.length > 12 ? (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                className="font-data mt-3 text-[11px] tracking-widest text-amber hover:text-amber-soft"
              >
                {showAll ? "SHOW LESS" : `SHOW ALL ${result.videos.length}`}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-data text-[10px] tracking-widest text-faint">{label}</p>
      <p className="font-data mt-1 text-lg">{value}</p>
    </div>
  );
}
