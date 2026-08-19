"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ExternalLink, Play } from "lucide-react";

import { toggleTaskAction, type ProgressEvents } from "@/app/(app)/actions";
import { Celebration } from "@/components/celebration";
import { enqueue, isOffline } from "@/lib/offline-queue";
import { categoryLabel, CATEGORY_LABELS } from "@/lib/task-labels";
import { cn } from "@/lib/utils";

type BattleTask = {
  id: string;
  name: string;
  category: keyof typeof CATEGORY_LABELS;
  customLabel: string | null;
  isCore: boolean;
  completed: boolean;
  youtubeVideoId: string | null;
  linkUrl: string | null;
};

export function DailyBattle({ tasks, dateKey }: { tasks: BattleTask[]; dateKey: string }) {
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ProgressEvents | null>(null);
  const [, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic(
    tasks,
    (state: BattleTask[], update: { id: string; completed: boolean }) =>
      state.map((t) => (t.id === update.id ? { ...t, completed: update.completed } : t)),
  );

  const core = optimistic.filter((t) => t.isCore);
  const bonus = optimistic.filter((t) => !t.isCore);
  const done = core.filter((t) => t.completed).length;
  const pct = core.length === 0 ? 0 : done / core.length;
  const complete = core.length > 0 && done === core.length;

  function toggle(task: BattleTask) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: task.id, completed: !task.completed });

      // Offline: keep the tick on this device and replay it later. The box
      // fills now; the rating moves when it reaches the server.
      if (isOffline()) {
        enqueue({ taskId: task.id, date: dateKey, completed: !task.completed });
        return;
      }

      try {
        const result = await toggleTaskAction({
          taskId: task.id,
          date: dateKey,
          completed: !task.completed,
        });
        if (result.error) setError(result.error);
        else if (result.events) setEvents(result.events);
      } catch {
        // The request died mid-flight. Queue it rather than lose it.
        enqueue({ taskId: task.id, date: dateKey, completed: !task.completed });
      }
    });
  }

  return (
    <section className="card p-5 sm:p-6">
      <Celebration events={events} onDismiss={() => setEvents(null)} />
      <div className="flex items-baseline justify-between">
        <p className="font-data text-[11px] tracking-widest text-muted">TODAY&apos;S BATTLE</p>
        <p className="font-data text-sm text-ink-soft">
          {done} / {core.length} core
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-raised"
          role="progressbar"
          aria-valuenow={Math.round(pct * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Core task completion"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              complete ? "bg-good" : "bg-amber",
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <span className="font-data w-12 text-right text-lg">{Math.round(pct * 100)}%</span>
      </div>

      {complete ? (
        <p className="font-data mt-3 text-sm text-good">Perfect day. Rating banked.</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      ) : null}

      <ul className="mt-5 space-y-1">
        {core.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} />
        ))}
      </ul>

      {bonus.length > 0 ? (
        <>
          <p className="font-data mt-6 text-[11px] tracking-widest text-faint">BONUS</p>
          <ul className="mt-2 space-y-1">
            {bonus.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} bonus />
            ))}
          </ul>
        </>
      ) : null}

      {optimistic.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-ink">Nothing scheduled today.</p>
          <p className="mt-1 text-sm text-muted">
            Your rank only moves once there is something to finish. Two or three tasks is a real
            start; ten is a wish list.
          </p>
          <Link
            href="/tasks"
            className="font-data mt-4 inline-block rounded-md bg-amber px-4 py-2 text-sm text-void hover:bg-amber-soft"
          >
            Add your first tasks
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function TaskRow({
  task,
  onToggle,
  bonus,
}: {
  task: BattleTask;
  onToggle: () => void;
  bonus?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={task.completed}
        className={cn(
          "group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left",
          "transition-colors hover:bg-raised",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
            task.completed
              ? bonus
                ? "border-good bg-good text-void"
                : "border-amber bg-amber text-void"
              : "border-line-strong group-hover:border-muted",
          )}
        >
          {task.completed ? <Check size={13} strokeWidth={3} /> : null}
        </span>

        <span className={cn("flex-1 text-sm", task.completed ? "text-faint line-through" : "text-ink")}>
          {task.name}
        </span>

        {task.linkUrl ? (
          <a
            href={task.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Open the link for ${task.name}`}
            className="text-amber hover:text-amber-soft"
          >
            <ExternalLink size={13} />
          </a>
        ) : null}

        <span className="font-data text-[10px] tracking-widest text-faint">
          {categoryLabel(task).toUpperCase()}
        </span>
      </button>

      {task.youtubeVideoId && !task.completed ? (
        <Link
          href={`/watch/v/${task.youtubeVideoId}`}
          className="font-data ml-10 flex items-center gap-1.5 py-0.5 text-[10px] tracking-widest text-amber hover:text-amber-soft"
        >
          <Play size={11} /> WATCH
        </Link>
      ) : null}

    </li>
  );
}
