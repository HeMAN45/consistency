"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";

import { toggleSyncTaskAction } from "@/app/(app)/social-actions";
import type { SharedTodayTask } from "@/lib/sync";
import { cn } from "@/lib/utils";

/**
 * Deliberately styled apart from the Daily Battle. Shared work is real work,
 * but it does not move your personal rank, and the interface should not blur
 * that line.
 */
export function SharedToday({
  tasks,
  dateKey,
}: {
  tasks: SharedTodayTask[];
  dateKey: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic(
    tasks,
    (state: SharedTodayTask[], update: { id: string; completed: boolean }) =>
      state.map((task) =>
        task.id === update.id
          ? {
              ...task,
              completed: update.completed,
              doneCount: task.doneCount + (update.completed ? 1 : -1),
            }
          : task,
      ),
  );

  if (tasks.length === 0) return null;

  const done = optimistic.filter((task) => task.completed).length;

  function toggle(task: SharedTodayTask) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: task.id, completed: !task.completed });
      const result = await toggleSyncTaskAction({
        syncTaskId: task.id,
        date: dateKey,
        completed: !task.completed,
      });
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-data text-[11px] tracking-widest text-muted">SHARED TODAY</p>
        <p className="font-data text-sm text-ink-soft">
          {done} / {optimistic.length}
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 space-y-1">
        {optimistic.map((task) => (
          <li key={task.id}>
            <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-raised">
              <button
                type="button"
                onClick={() => toggle(task)}
                aria-pressed={task.completed}
                aria-label={`Mark ${task.name} ${task.completed ? "not done" : "done"}`}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                  task.completed
                    ? "border-good bg-good/20 text-good"
                    : "border-line-strong text-transparent hover:border-amber",
                )}
              >
                <Check size={12} strokeWidth={3} />
              </button>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "flex items-center gap-1.5 truncate text-sm",
                    task.completed ? "text-faint line-through" : "text-ink",
                  )}
                >
                  {task.name}
                  {task.linkUrl ? (
                    <a
                      href={task.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open the link for ${task.name}`}
                      className="shrink-0 text-amber hover:text-amber-soft"
                    >
                      <ExternalLink size={12} />
                    </a>
                  ) : null}
                </span>

                <Link
                  href={`/sync/${task.syncId}`}
                  className="font-data text-[10px] tracking-widest text-faint hover:text-ink"
                >
                  {task.syncName.toUpperCase()}
                </Link>
              </span>

              <span className="font-data shrink-0 text-[11px] tabular-nums text-faint">
                {task.doneCount}/{task.memberCount}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-faint">
        Shared work counts toward your SYNC, never toward your personal rank.
      </p>
    </section>
  );
}
