import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";

import { WatchImport } from "@/components/watch-import";
import { formatDuration } from "@/lib/playlist-maths";
import { listPlaylists } from "@/lib/playlists";
import { requireUser } from "@/lib/session";
import { tasksForDay } from "@/lib/tasks";
import { todayKey } from "@/lib/time";
import { watchSummary } from "@/lib/watch-progress";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Watch · ~/consistency" };

function formatDayLabel(key: string) {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default async function WatchPage() {
  const user = await requireUser();
  const today = todayKey(user.timezone);

  const [playlists, progress, tasks] = await Promise.all([
    listPlaylists(user.id),
    watchSummary(user.id, user.timezone),
    tasksForDay(user.id, today, user.timezone),
  ]);

  const behindById = new Map(progress.map((row) => [row.id, row.behind]));
  const todaysVideos = tasks.filter((task) => task.youtubeVideoId);
  const outstanding = todaysVideos.filter((task) => !task.completed);

  return (
    <div className="rise space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-data text-2xl tracking-tight">Watch</h1>
          <p className="mt-1 text-sm text-muted">
            Courses become daily tasks that count like everything else.
          </p>
        </div>

        <Link
          href="/analyze"
          className="font-data rounded-md border border-amber/40 bg-amber/10 px-3 py-1.5 text-xs text-amber transition-colors hover:bg-amber/20"
        >
          Playlist analyzer →
        </Link>
      </header>

      {todaysVideos.length > 0 ? (
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <p className="font-data text-[11px] tracking-widest text-amber">TODAY</p>
            <p className="font-data text-[11px] tabular-nums text-faint">
              {todaysVideos.length - outstanding.length} / {todaysVideos.length}
            </p>
          </div>

          <ul className="mt-3">
            {todaysVideos.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    task.completed ? "bg-good" : "bg-amber",
                  )}
                />

                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    task.completed ? "text-faint line-through" : "text-ink-soft",
                  )}
                >
                  {task.name}
                </span>

                {task.completed ? (
                  <span className="font-data shrink-0 text-[10px] tracking-widest text-good">
                    DONE
                  </span>
                ) : (
                  <Link
                    href={`/watch/v/${task.youtubeVideoId}`}
                    className="font-data flex shrink-0 items-center gap-1 text-[10px] tracking-widest text-amber hover:text-amber-soft"
                  >
                    <Play size={11} /> WATCH
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {playlists.length === 0 ? (
        <>
          <WatchImport />
          <div className="card p-6">
            <p className="text-sm text-ink">Nothing saved yet.</p>
            <p className="mt-1 text-sm text-muted">
              Paste a playlist above. Set a pace, and its videos become dated tasks on your
              dashboard.
            </p>
          </div>
        </>
      ) : (
        <>
          <section>
            <p className="font-data text-[11px] tracking-widest text-muted">YOUR COURSES</p>

            <ul className="mt-3 space-y-3">
              {playlists.map((playlist) => {
                const pct = playlist.total === 0 ? 0 : playlist.watched / playlist.total;
                const behind = behindById.get(playlist.id) ?? 0;
                const done = playlist.remaining === 0;

                return (
                  <li key={playlist.id}>
                    <Link
                      href={`/watch/${playlist.id}`}
                      className="card block p-4 hover:border-line-strong"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-sm text-ink">
                          {playlist.title}
                        </p>
                        <span className="font-data shrink-0 text-xs tabular-nums text-muted">
                          {playlist.watched} / {playlist.total}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-500",
                              done ? "bg-good" : "bg-amber",
                            )}
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                        <span className="font-data w-10 shrink-0 text-right text-[11px] tabular-nums text-faint">
                          {Math.round(pct * 100)}%
                        </span>
                      </div>

                      <p className="mt-2 text-xs">
                        {done ? (
                          <span className="text-good">Finished</span>
                        ) : behind > 0 ? (
                          <span className="text-warn">
                            {behind} behind · {formatDuration(playlist.remainingSeconds)} left
                          </span>
                        ) : (
                          <span className="text-faint">
                            {formatDuration(playlist.remainingSeconds)} left at{" "}
                            {playlist.videosPerDay} a day
                          </span>
                        )}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <WatchImport />
        </>
      )}
    </div>
  );
}
