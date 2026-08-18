import Link from "next/link";

import { formatDuration } from "@/lib/playlist-maths";
import type { PlaylistProgress } from "@/lib/watch-progress";
import { cn } from "@/lib/utils";

export function WatchAnalytics({ playlists }: { playlists: PlaylistProgress[] }) {
  if (playlists.length === 0) return null;

  const watchedSeconds = playlists.reduce((sum, playlist) => sum + playlist.watchedSeconds, 0);
  const remainingSeconds = playlists.reduce((sum, playlist) => sum + playlist.remainingSeconds, 0);
  const watched = playlists.reduce((sum, playlist) => sum + playlist.watched, 0);
  const total = playlists.reduce((sum, playlist) => sum + playlist.total, 0);

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">WATCHING</p>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="VIDEOS DONE" value={`${watched} / ${total}`} />
        <Stat label="TIME WATCHED" value={formatDuration(watchedSeconds)} />
        <Stat label="TIME LEFT" value={formatDuration(remainingSeconds)} />
        <Stat label="AT 1.5x" value={formatDuration(Math.round(remainingSeconds / 1.5))} />
      </div>

      <ul className="mt-5 space-y-4 border-t border-line pt-4">
        {playlists.map((playlist) => {
          const pct = playlist.total === 0 ? 0 : playlist.watched / playlist.total;
          const done = playlist.remaining === 0;

          return (
            <li key={playlist.id}>
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/watch/${playlist.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-ink-soft hover:text-amber"
                >
                  {playlist.title}
                </Link>
                <span className="font-data shrink-0 text-xs tabular-nums text-muted">
                  {playlist.watched} / {playlist.total}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      done ? "bg-good" : "bg-amber",
                    )}
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <span className="font-data w-10 text-right text-[11px] tabular-nums text-faint">
                  {Math.round(pct * 100)}%
                </span>
              </div>

              {playlist.behind > 0 ? (
                <p className="mt-1 text-xs text-warn">{playlist.behind} behind pace</p>
              ) : done ? (
                <p className="mt-1 text-xs text-good">Finished</p>
              ) : (
                <p className="mt-1 text-xs text-faint">
                  {formatDuration(playlist.remainingSeconds)} left at {playlist.videosPerDay} a day
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
