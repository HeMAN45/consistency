"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type ViewMember = {
  userId: string;
  displayName: string;
  isYou: boolean;
};

export type ViewTask = {
  id: string;
  name: string;
  canRemove: boolean;
  completions: { userId: string; displayName: string; completed: boolean; isYou: boolean }[];
};

export type ActivityEntry = {
  id: string;
  at: string;
  displayName: string;
  taskName: string;
  isYou: boolean;
};

export type SharedViewProps = {
  members: ViewMember[];
  tasks: ViewTask[];
  activity: ActivityEntry[];
  onToggle: (task: ViewTask) => void;
  onRemove: (taskId: string) => void;
};

export const VIEWS = ["board", "people", "tasks", "activity"] as const;
export type ViewId = (typeof VIEWS)[number];

const VIEW_LABELS: Record<ViewId, string> = {
  board: "Board",
  people: "People",
  tasks: "Tasks",
  activity: "Activity",
};

export function ViewSwitcher({
  value,
  onChange,
}: {
  value: ViewId;
  onChange: (next: ViewId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="How to view shared work"
      className="flex gap-1 rounded-md border border-line bg-void p-1"
    >
      {VIEWS.map((view) => (
        <button
          key={view}
          role="tab"
          aria-selected={value === view}
          onClick={() => onChange(view)}
          className={cn(
            "font-data rounded px-2.5 py-1 text-[11px] tracking-wide transition-colors",
            value === view ? "bg-raised text-amber" : "text-muted hover:text-ink",
          )}
        >
          {VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  );
}

/** Remembers the last view so the room opens the way you left it. */
export function useStoredView() {
  const [view, setView] = useState<ViewId>("board");

  useEffect(() => {
    const stored = window.localStorage.getItem("sync-view");
    if (stored && (VIEWS as readonly string[]).includes(stored)) setView(stored as ViewId);
  }, []);

  function update(next: ViewId) {
    setView(next);
    window.localStorage.setItem("sync-view", next);
  }

  return [view, update] as const;
}

// ---------------------------------------------------------------- helpers

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Ring({ done, total, you }: { done: number; total: number; you: boolean }) {
  const pct = total === 0 ? 0 : done / total;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--color-raised)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={pct >= 1 ? "var(--color-good)" : you ? "var(--color-amber)" : "var(--color-line-strong)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="font-data absolute inset-0 flex items-center justify-center text-[11px] tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// ------------------------------------------------------------- board view

/** Today as a scoreboard. Members ranked by what they've actually cleared. */
export function BoardView({ members, tasks, onToggle }: SharedViewProps) {
  const rows = members
    .map((member) => {
      const done = tasks.filter(
        (task) => task.completions.find((c) => c.userId === member.userId)?.completed,
      );
      return { member, done: done.length, total: tasks.length };
    })
    .sort((a, b) => b.done - a.done || a.member.displayName.localeCompare(b.member.displayName));

  return (
    <ol className="space-y-2">
      {rows.map((row, index) => {
        const leading = index === 0 && row.done > 0;
        return (
          <li
            key={row.member.userId}
            className={cn(
              "flex items-center gap-4 rounded-lg border p-3",
              row.member.isYou ? "border-amber/40 bg-raised/40" : "border-line",
            )}
          >
            <span
              className={cn(
                "font-data w-5 text-center text-sm tabular-nums",
                leading ? "text-amber" : "text-faint",
              )}
            >
              {index + 1}
            </span>

            <Ring done={row.done} total={row.total} you={row.member.isYou} />

            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm", row.member.isYou && "text-amber")}>
                {row.member.displayName}
                {row.member.isYou ? " (you)" : ""}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {tasks.map((task) => {
                  const completed =
                    task.completions.find((c) => c.userId === row.member.userId)?.completed ?? false;

                  if (!row.member.isYou) {
                    return (
                      <span
                        key={task.id}
                        title={`${task.name}: ${completed ? "done" : "not yet"}`}
                        className={cn(
                          "h-2 w-6 rounded-full",
                          completed ? "bg-good/70" : "bg-raised",
                        )}
                      />
                    );
                  }

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onToggle(task)}
                      aria-label={`Mark ${task.name} ${completed ? "not done" : "done"}`}
                      title={task.name}
                      className={cn(
                        "h-2 w-6 rounded-full transition-colors",
                        completed ? "bg-amber" : "bg-line-strong hover:bg-amber/60",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------ people view

export function PeopleView({ members, tasks, onToggle }: SharedViewProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {members.map((member) => {
        const done = tasks.filter(
          (task) => task.completions.find((c) => c.userId === member.userId)?.completed,
        ).length;

        return (
          <div
            key={member.userId}
            className={cn(
              "rounded-lg border p-4",
              member.isYou ? "border-amber/40" : "border-line",
            )}
          >
            <div className="flex items-center gap-3">
              <Ring done={done} total={tasks.length} you={member.isYou} />
              <div className="min-w-0">
                <p className={cn("truncate text-sm", member.isYou && "text-amber")}>
                  {member.displayName}
                  {member.isYou ? " (you)" : ""}
                </p>
                <p className="font-data text-[10px] tracking-widest text-faint">
                  {done === tasks.length && tasks.length > 0 ? "DAY CLEARED" : "TODAY"}
                </p>
              </div>
            </div>

            <ul className="mt-3 space-y-1">
              {tasks.map((task) => {
                const completed =
                  task.completions.find((c) => c.userId === member.userId)?.completed ?? false;

                const row = (
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 rounded-[4px] border",
                        completed
                          ? member.isYou
                            ? "border-amber bg-amber"
                            : "border-good/50 bg-good/40"
                          : "border-line-strong",
                      )}
                    />
                    <span className={cn("text-xs", completed ? "text-faint" : "text-ink-soft")}>
                      {task.name}
                    </span>
                  </span>
                );

                return (
                  <li key={task.id}>
                    {member.isYou ? (
                      <button
                        type="button"
                        onClick={() => onToggle(task)}
                        aria-pressed={completed}
                        className="w-full py-0.5 text-left"
                      >
                        {row}
                      </button>
                    ) : (
                      <span className="block py-0.5">{row}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------- tasks view

export function TasksView({ tasks, onToggle, onRemove }: SharedViewProps) {
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const done = task.completions.filter((c) => c.completed).length;
        const all = done === task.completions.length;
        const mine = task.completions.find((c) => c.isYou);

        return (
          <div key={task.id} className="rounded-lg border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">{task.name}</p>
                <p
                  className={cn(
                    "font-data mt-0.5 text-[10px] tracking-widest",
                    all ? "text-good" : "text-faint",
                  )}
                >
                  {all ? "EVERYONE IN" : `${done} OF ${task.completions.length}`}
                </p>
              </div>

              {task.canRemove ? (
                confirming === task.id ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        onRemove(task.id);
                      }}
                      className="font-data text-[10px] tracking-widest text-bad"
                    >
                      REMOVE
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="font-data text-[10px] tracking-widest text-faint hover:text-ink"
                    >
                      CANCEL
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(task.id)}
                    className="font-data shrink-0 text-[10px] tracking-widest text-faint hover:text-bad"
                  >
                    REMOVE
                  </button>
                )
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {task.completions.map((person) => (
                <span
                  key={person.userId}
                  title={`${person.displayName}: ${person.completed ? "done" : "not yet"}`}
                  className={cn(
                    "font-data rounded-full border px-2.5 py-1 text-[11px]",
                    person.completed
                      ? person.isYou
                        ? "border-amber bg-amber text-void"
                        : "border-good/40 bg-good/15 text-good"
                      : "border-line text-faint",
                  )}
                >
                  {initials(person.displayName)}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onToggle(task)}
              className={cn(
                "font-data mt-3 w-full rounded-md border py-2 text-xs transition-colors",
                mine?.completed
                  ? "border-line bg-raised text-muted hover:text-ink"
                  : "border-amber bg-amber text-void hover:bg-amber-soft",
              )}
            >
              {mine?.completed ? "Undo mine" : "Mark mine done"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------- activity view

export function ActivityView({ activity }: SharedViewProps) {
  if (activity.length === 0) {
    return <p className="text-sm text-muted">Nothing completed here yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {activity.map((entry, index) => (
        <li key={entry.id} className="flex gap-3 py-2.5">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                entry.isYou ? "bg-amber" : "bg-line-strong",
              )}
            />
            {index < activity.length - 1 ? <span className="w-px flex-1 bg-line" /> : null}
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <p className="text-sm">
              <span className={entry.isYou ? "text-amber" : "text-ink-soft"}>
                {entry.isYou ? "You" : entry.displayName}
              </span>{" "}
              <span className="text-muted">completed</span> {entry.taskName}
            </p>
            <p className="font-data text-[10px] tracking-widest text-faint">
              {relativeTime(entry.at).toUpperCase()}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
