import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ExternalLink, X } from "lucide-react";

import { loadDayDetail } from "@/lib/archive";
import { requireUser } from "@/lib/session";
import { isValidDayKey, todayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Day · ~/consistency" };

const REASON_LABELS: Record<string, string> = {
  SICK: "Unwell",
  TRAVEL: "Travelling",
  OVERLOADED: "Too much on",
  LOW_ENERGY: "No energy",
  CHOSE_NOT_TO: "Chose not to",
  OTHER: "Other",
};

export default async function ArchivedDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const user = await requireUser();

  if (!isValidDayKey(date) || date > todayKey(user.timezone)) notFound();

  const day = await loadDayDetail(user.id, user.timezone, date);
  const done = day.core.filter((task) => task.completed).length;

  return (
    <div className="rise space-y-5">
      <header>
        <Link href="/archive" className="font-data text-xs text-muted hover:text-ink">
          ← Archive
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{day.label}</h1>

        {day.restDay ? (
          <p className="font-data mt-1 text-[11px] tracking-widest text-muted">DECLARED REST DAY</p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {done} of {day.core.length} core tasks
            {day.focusMinutes > 0 ? ` · ${day.focusMinutes} min focused` : ""}
          </p>
        )}
      </header>

      <TaskList title="CORE" tasks={day.core} />
      {day.bonus.length > 0 ? <TaskList title="BONUS" tasks={day.bonus} /> : null}

      {day.shared.length > 0 ? (
        <section className="card p-5">
          <p className="font-data text-[11px] tracking-widest text-muted">SHARED</p>
          <ul className="mt-3">
            {day.shared.map((task, index) => (
              <li
                key={`${task.name}-${index}`}
                className="flex items-center gap-3 border-b border-line py-2 last:border-0"
              >
                <Mark completed={task.completed} />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    task.completed ? "text-faint line-through" : "text-ink-soft",
                  )}
                >
                  {task.name}
                </span>
                <span className="font-data shrink-0 text-[10px] tracking-widest text-faint">
                  {task.syncName.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {day.metrics ? (
        <section className="card p-5">
          <p className="font-data text-[11px] tracking-widest text-muted">THAT DAY</p>

          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="STEPS"
              value={day.metrics.steps === null ? "—" : day.metrics.steps.toLocaleString("en-IN")}
            />
            <Stat label="WAKE" value={day.metrics.wakeTime ?? "—"} />
            <Stat label="FOCUS" value={day.focusMinutes > 0 ? `${day.focusMinutes}m` : "—"} />
            <Stat
              label="REASON"
              value={day.metrics.missReason ? REASON_LABELS[day.metrics.missReason] : "—"}
            />
          </dl>

          {day.metrics.notes ? (
            <p className="mt-4 border-l-2 border-line pl-4 text-sm text-muted">
              {day.metrics.notes}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function TaskList({
  title,
  tasks,
}: {
  title: string;
  tasks: { name: string; category: string; completed: boolean; linkUrl: string | null }[];
}) {
  if (tasks.length === 0) return null;

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">{title}</p>

      <ul className="mt-3">
        {tasks.map((task, index) => (
          <li
            key={`${task.name}-${index}`}
            className="flex items-center gap-3 border-b border-line py-2 last:border-0"
          >
            <Mark completed={task.completed} />

            <span
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm",
                task.completed ? "text-faint line-through" : "text-ink-soft",
              )}
            >
              {task.name}
              {task.linkUrl ? (
                <a
                  href={task.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber hover:text-amber-soft"
                  aria-label={`Open the link for ${task.name}`}
                >
                  <ExternalLink size={12} />
                </a>
              ) : null}
            </span>

            <span className="font-data shrink-0 text-[10px] tracking-widest text-faint">
              {task.category.toUpperCase()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Mark({ completed }: { completed: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
        completed ? "border-good/50 bg-good/15 text-good" : "border-line text-faint",
      )}
    >
      {completed ? <Check size={12} strokeWidth={3} /> : <X size={11} strokeWidth={2.5} />}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-data text-[10px] tracking-widest text-faint">{label}</dt>
      <dd className="font-data mt-1 text-sm text-ink-soft">{value}</dd>
    </div>
  );
}
