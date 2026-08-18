"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { addSyncCourseAction } from "@/app/(app)/sync/course-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatDuration } from "@/lib/playlist-maths";
import { cn } from "@/lib/utils";

type Course = {
  id: string;
  title: string;
  sharedSchedule: boolean;
  videosPerDay: number;
  total: number;
  watched: number;
  remaining: number;
  remainingSeconds: number;
};

export function SyncCourses({ syncId, courses }: { syncId: string; courses: Course[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [shared, setShared] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addSyncCourseAction({ syncId, url, sharedSchedule: shared });
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl("");
      setAdding(false);
      if (result.id) router.push(`/sync/${syncId}/course/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-data text-[11px] tracking-widest text-muted">COURSES</p>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="font-data text-[10px] tracking-widest text-amber hover:text-amber-soft"
          >
            ADD
          </button>
        ) : null}
      </div>

      {courses.length === 0 && !adding ? (
        <p className="mt-3 text-sm text-muted">
          Add a YouTube playlist and its videos become shared work, on one schedule or at each
          member&apos;s own pace.
        </p>
      ) : null}

      {courses.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {courses.map((course) => {
            const pct = course.total === 0 ? 0 : course.watched / course.total;

            return (
              <li key={course.id}>
                <Link href={`/sync/${syncId}/course/${course.id}`} className="group block">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink group-hover:text-amber">
                      {course.title}
                    </span>
                    <span className="font-data shrink-0 text-xs tabular-nums text-muted">
                      {course.watched} / {course.total}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          course.remaining === 0 ? "bg-good" : "bg-amber",
                        )}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                    <span className="font-data w-10 text-right text-[11px] tabular-nums text-faint">
                      {Math.round(pct * 100)}%
                    </span>
                  </div>

                  <p className="font-data mt-1 text-[10px] tracking-widest text-faint">
                    {course.sharedSchedule ? "SHARED SCHEDULE" : "OWN PACE"} ·{" "}
                    {course.videosPerDay}/DAY · {formatDuration(course.remainingSeconds)} LEFT
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {adding ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://youtube.com/playlist?list=..."
            autoFocus
          />

          <fieldset className="space-y-2">
            <legend className="font-data text-[10px] tracking-widest text-muted">SCHEDULE</legend>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                checked={shared}
                onChange={() => setShared(true)}
                className="mt-1 h-3.5 w-3.5 accent-[var(--color-amber)]"
              />
              <span className="text-sm">
                One schedule for everyone
                <span className="block text-xs text-faint">
                  Same videos on the same days. It never reschedules itself around whoever is
                  slowest.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                checked={!shared}
                onChange={() => setShared(false)}
                className="mt-1 h-3.5 w-3.5 accent-[var(--color-amber)]"
              />
              <span className="text-sm">
                Each member at their own pace
                <span className="block text-xs text-faint">
                  Shared playlist, personal plan. Falls behind and catches up per person.
                </span>
              </span>
            </label>
          </fieldset>

          {error ? (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={pending || url.trim().length === 0}>
              {pending ? "Reading…" : "Add course"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
