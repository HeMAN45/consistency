"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  refreshPlaylistAction,
  removePlaylistAction,
  scheduleAction,
  unscheduleAction,
  updatePlanAction,
} from "@/app/(app)/watch/actions";
import { Button } from "@/components/ui/button";
import { finishDayKey, formatDuration } from "@/lib/playlist-maths";
import { cn } from "@/lib/utils";

type Props = {
  playlistId: string;
  todayKey: string;
  remaining: number;
  remainingSeconds: number;
  videosPerDay: number;
  isCore: boolean;
  scheduledCount: number;
};

function formatDayLabel(key: string) {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PlaylistPlanner(props: Props) {
  const router = useRouter();
  const [perDay, setPerDay] = useState(props.videosPerDay);
  const [isCore, setIsCore] = useState(props.isCore);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Recomputed as you drag, so the commitment is visible before you make it.
  const projection = useMemo(() => {
    const finish = finishDayKey(props.todayKey, props.remaining, perDay);
    const days = perDay > 0 ? Math.ceil(props.remaining / perDay) : 0;
    const minutesPerDay = props.remaining > 0 ? props.remainingSeconds / props.remaining : 0;

    return {
      finish,
      days,
      dailySeconds: Math.round(minutesPerDay * perDay),
    };
  }, [perDay, props.remaining, props.remainingSeconds, props.todayKey]);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">PLAN</p>

      {props.remaining === 0 ? (
        <p className="mt-3 text-sm text-good">Every video watched. Nothing left to schedule.</p>
      ) : (
        <>
          <div className="mt-4">
            <label htmlFor="pace" className="flex items-baseline justify-between">
              <span className="text-sm text-ink-soft">Videos a day</span>
              <span className="font-data text-lg tabular-nums">{perDay}</span>
            </label>

            <input
              id="pace"
              type="range"
              min={1}
              max={Math.min(10, Math.max(1, props.remaining))}
              value={perDay}
              onChange={(event) => setPerDay(Number(event.target.value))}
              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-raised outline-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-amber [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber"
            />
          </div>

          <p className="mt-4 text-sm">
            <span className="text-muted">At {perDay} a day you finish </span>
            <span className="font-data text-amber">
              {projection.finish ? formatDayLabel(projection.finish) : "never"}
            </span>
            <span className="text-muted">
              {" "}
              · {projection.days} days · about {formatDuration(projection.dailySeconds)} a day
            </span>
          </p>

          <label className="mt-4 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isCore}
              onChange={(event) => setIsCore(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-amber)]"
            />
            <span className="text-sm">
              Count toward my streak
              <span className="block text-xs text-faint">
                Off means these earn XP but never break a perfect day.
              </span>
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updatePlanAction({
                    playlistId: props.playlistId,
                    videosPerDay: perDay,
                    isCore,
                  }),
                )
              }
            >
              {pending ? "Saving…" : "Save and schedule"}
            </Button>

            {props.scheduledCount > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => unscheduleAction(props.playlistId))}
              >
                Clear upcoming
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => scheduleAction(props.playlistId))}
              >
                Schedule now
              </Button>
            )}
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => refreshPlaylistAction(props.playlistId))}
          className="font-data text-[10px] tracking-widest text-muted hover:text-ink"
        >
          REFRESH FROM YOUTUBE
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            run(async () => {
              const result = await removePlaylistAction(props.playlistId);
              if (!result.error) router.push("/watch");
              return result;
            });
          }}
          className={cn("font-data text-[10px] tracking-widest text-faint hover:text-bad")}
        >
          REMOVE
        </button>
      </div>
    </section>
  );
}
