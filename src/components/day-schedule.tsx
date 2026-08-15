"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { createBlockAction, deleteBlockAction } from "@/app/(app)/calendar/actions";
import { cancelRestDayAction, declareRestDayAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ScheduleEntry } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type Props = {
  dateKey: string;
  entries: ScheduleEntry[];
  tasks: { id: string; name: string; completed: boolean }[];
  completionPct: number;
  coreDone: number;
  coreTotal: number;
  isRestDay: boolean;
  canDeclareRest: boolean;
  restDaysUsed: number;
  restDaysPerMonth: number;
};

const selectClass =
  "font-data h-10 w-full rounded-md border border-line bg-void px-2 text-sm text-ink focus:border-amber focus:outline-none";

export function DaySchedule({
  dateKey,
  entries,
  tasks,
  completionPct,
  coreDone,
  coreTotal,
  isRestDay,
  canDeclareRest,
  restDaysUsed,
  restDaysPerMonth,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", start: "08:00", end: "09:30", taskId: "" });
  const [, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else {
        setAdding(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-data text-[11px] tracking-widest text-muted">SCHEDULE</p>
          <p className="font-data text-[11px] text-faint">
            {entries.length} {entries.length === 1 ? "block" : "blocks"}
          </p>
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nothing planned. Blocks here are yours. They never tick a task off for you.
          </p>
        ) : (
          <ul className="mt-4">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline gap-4 border-b border-line py-3 last:border-0"
              >
                <span className="font-data w-24 shrink-0 text-sm tabular-nums text-ink-soft">
                  {entry.start}–{entry.end}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{entry.title}</span>
                  {entry.taskName ? (
                    <span className="font-data text-[10px] tracking-widest text-faint">
                      LINKED · {entry.taskName.toUpperCase()}
                    </span>
                  ) : null}
                  {entry.imported ? (
                    <span className="font-data text-[10px] tracking-widest text-faint">
                      IMPORTED · READ ONLY
                    </span>
                  ) : null}
                </span>

                {!entry.imported ? (
                  <button
                    type="button"
                    onClick={() => run(() => deleteBlockAction(entry.id))}
                    aria-label={`Delete ${entry.title}`}
                    className="text-muted hover:text-bad"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        ) : null}

        {adding ? (
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            <Field label="WHAT" htmlFor="block-title">
              <Input
                id="block-title"
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="DSA, 90 min"
                maxLength={60}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="FROM" htmlFor="block-start">
                <Input
                  id="block-start"
                  type="time"
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </Field>
              <Field label="TO" htmlFor="block-end">
                <Input
                  id="block-end"
                  type="time"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </Field>
            </div>

            {tasks.length > 0 ? (
              <Field label="LINK TO TASK" htmlFor="block-task" hint="Optional. Linking never completes it.">
                <select
                  id="block-task"
                  className={selectClass}
                  value={draft.taskId}
                  onChange={(e) => setDraft({ ...draft, taskId: e.target.value })}
                >
                  <option value="">No task</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!draft.title.trim()}
                onClick={() =>
                  run(() =>
                    createBlockAction({
                      date: dateKey,
                      title: draft.title,
                      start: draft.start,
                      end: draft.end,
                      taskId: draft.taskId || null,
                    }),
                  )
                }
              >
                Add block
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="mt-4" onClick={() => setAdding(true)}>
            Add block
          </Button>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-data text-[11px] tracking-widest text-muted">REST DAY</p>
          <p className="font-data text-[11px] tabular-nums text-faint">
            {restDaysUsed} / {restDaysPerMonth} THIS MONTH
          </p>
        </div>

        {isRestDay ? (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              This day is declared rest. Core tasks are not counted, the streak holds, and the
              rating does not move.
            </p>
            {canDeclareRest ? (
              <Button
                size="sm"
                variant="ghost"
                className="mt-3"
                onClick={() => run(() => cancelRestDayAction(dateKey))}
              >
                Cancel rest day
              </Button>
            ) : (
              <p className="mt-2 text-xs text-faint">
                It has already started, so it stays on the record.
              </p>
            )}
          </>
        ) : canDeclareRest ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Planning time off is discipline. Declare it and the day costs you nothing.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() => run(() => declareRestDayAction(dateKey, null))}
            >
              Declare rest day
            </Button>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Rest days have to be declared at least a day ahead. Yesterday cannot become one.
          </p>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-data text-[11px] tracking-widest text-muted">TODAY&apos;S BATTLE</p>
          <p className="font-data text-sm text-ink-soft">
            {coreDone} / {coreTotal} core
          </p>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                completionPct >= 1 ? "bg-good" : "bg-amber",
              )}
              style={{ width: `${completionPct * 100}%` }}
            />
          </div>
          <span className="font-data w-12 text-right text-lg">
            {Math.round(completionPct * 100)}%
          </span>
        </div>

        <p className="mt-4 text-xs text-faint">
          Your plan and your record are separate on purpose. Blocks describe intent; only ticking a
          task on the dashboard changes your rating.
        </p>
      </section>
    </div>
  );
}
