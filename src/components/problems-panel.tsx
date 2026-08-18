"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Trash2 } from "lucide-react";

import {
  addProblemsAction,
  removeProblemAction,
  scheduleProblemAction,
  solveProblemAction,
  updateProblemAction,
} from "@/app/(app)/problems/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { DIFFICULTY_LABELS, PLATFORM_LABELS } from "@/lib/problem-urls";
import type { StoredProblem } from "@/lib/problems";
import { cn } from "@/lib/utils";

type Difficulty = "EASY" | "MEDIUM" | "HARD";

const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  EASY: "text-good",
  MEDIUM: "text-warn",
  HARD: "text-bad",
};

const selectClass =
  "font-data h-10 w-full rounded-md border border-line bg-void px-2 text-sm text-ink focus:border-amber focus:outline-none";

export function ProblemsPanel({
  problems,
  syncs,
}: {
  problems: StoredProblem[];
  syncs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [topics, setTopics] = useState("");
  const [syncId, setSyncId] = useState("");
  const [scheduleToday, setScheduleToday] = useState(true);
  const [filter, setFilter] = useState<"all" | "todo" | "solved">("todo");
  const [platform, setPlatform] = useState<string>("all");
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const platforms = useMemo(
    () => [...new Set(problems.map((problem) => problem.platform))],
    [problems],
  );

  const visible = problems.filter((problem) => {
    if (filter === "todo" && problem.solved) return false;
    if (filter === "solved" && !problem.solved) return false;
    if (platform !== "all" && problem.platform !== platform) return false;
    return true;
  });

  function run(fn: () => Promise<{ error?: string; message?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setMessage({ text: result.error, bad: true });
      else {
        if (result.message) setMessage({ text: result.message });
        setEditing(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">ADD PROBLEMS</p>

        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={3}
          placeholder={"https://leetcode.com/problems/two-sum/\nhttps://codeforces.com/problemset/problem/4/A"}
          className="font-data mt-3 w-full rounded-md border border-line bg-void px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-amber focus:outline-none"
        />

        <p className="mt-1.5 text-xs text-faint">
          One link per line. The platform and title are read from the URL, so nothing to type.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="DIFFICULTY" htmlFor="difficulty" hint="Optional.">
            <select
              id="difficulty"
              className={selectClass}
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as Difficulty | "")}
            >
              <option value="">Don&apos;t tag</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </Field>

          <Field label="TOPICS" htmlFor="topics" hint="Comma separated. Optional.">
            <Input
              id="topics"
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
              placeholder="arrays, dp"
            />
          </Field>

          {syncs.length > 0 ? (
            <Field label="ADD TO" htmlFor="target">
              <select
                id="target"
                className={selectClass}
                value={syncId}
                onChange={(event) => setSyncId(event.target.value)}
              >
                <option value="">Just me</option>
                {syncs.map((sync) => (
                  <option key={sync.id} value={sync.id}>
                    {sync.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        {!syncId ? (
          <label className="mt-4 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={scheduleToday}
              onChange={(event) => setScheduleToday(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-amber)]"
            />
            <span className="text-sm">
              Put them on today&apos;s board
              <span className="block text-xs text-faint">
                They appear on the dashboard as bonus tasks, so they never threaten a perfect day.
              </span>
            </span>
          </label>
        ) : (
          <p className="mt-4 text-xs text-faint">
            SYNC problems appear for every member straight away.
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button
            size="sm"
            disabled={pending || raw.trim().length === 0}
            onClick={() => {
              run(() =>
                addProblemsAction({
                  raw,
                  syncId: syncId || null,
                  difficulty: difficulty || null,
                  topics,
                  scheduleToday,
                }),
              );
              setRaw("");
            }}
          >
            {pending ? "Adding…" : "Add"}
          </Button>

          {message ? (
            <span className={message.bad ? "text-sm text-bad" : "text-sm text-good"}>
              {message.text}
            </span>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border border-line bg-void p-1">
            {(["todo", "solved", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "font-data rounded px-2.5 py-1 text-[11px] tracking-wide transition-colors",
                  filter === value ? "bg-raised text-amber" : "text-muted hover:text-ink",
                )}
              >
                {value === "todo" ? "TO DO" : value.toUpperCase()}
              </button>
            ))}
          </div>

          {platforms.length > 1 ? (
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              aria-label="Filter by platform"
              className="font-data h-8 rounded-md border border-line bg-void px-2 text-xs text-muted focus:border-amber focus:outline-none"
            >
              <option value="all">All platforms</option>
              {platforms.map((value) => (
                <option key={value} value={value}>
                  {PLATFORM_LABELS[value]}
                </option>
              ))}
            </select>
          ) : null}

          <span className="font-data ml-auto text-[11px] tabular-nums text-faint">
            {visible.length}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="card mt-3 p-6">
            <p className="text-sm text-ink">
              {problems.length === 0 ? "No problems saved yet." : "Nothing matches that filter."}
            </p>
            {problems.length === 0 ? (
              <p className="mt-1 text-sm text-muted">
                Paste a batch of links above. Solving one counts as a task, so it moves your rating.
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="mt-3 space-y-1">
            {visible.map((problem) => (
              <li key={problem.id} className="card px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={pending || problem.solved}
                    onClick={() => run(() => solveProblemAction(problem.id))}
                    aria-label={problem.solved ? "Solved" : `Mark ${problem.title} solved`}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                      problem.solved
                        ? "border-good bg-good/20 text-good"
                        : "border-line-strong text-transparent hover:border-amber hover:text-amber",
                    )}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <a
                      href={problem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-1.5 truncate text-sm hover:text-amber",
                        problem.solved ? "text-faint line-through" : "text-ink",
                      )}
                    >
                      {problem.title}
                      <ExternalLink size={11} className="shrink-0 text-amber" />
                    </a>

                    <p className="font-data mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] tracking-widest text-faint">
                      <span>{PLATFORM_LABELS[problem.platform].toUpperCase()}</span>
                      {problem.difficulty ? (
                        <span className={DIFFICULTY_CLASS[problem.difficulty]}>
                          {DIFFICULTY_LABELS[problem.difficulty].toUpperCase()}
                        </span>
                      ) : null}
                      {problem.topics.map((topic) => (
                        <span key={topic}>#{topic}</span>
                      ))}
                      {problem.syncName ? <span>· {problem.syncName.toUpperCase()}</span> : null}
                      {problem.solvedOn ? <span>· {problem.solvedOn}</span> : null}
                    </p>
                  </div>

                  {!problem.solved && !problem.scheduledFor ? (
                    <button
                      type="button"
                      onClick={() => run(() => scheduleProblemAction(problem.id))}
                      className="font-data shrink-0 text-[10px] tracking-widest text-amber hover:text-amber-soft"
                    >
                      DO TODAY
                    </button>
                  ) : null}

                  {!problem.syncName ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(editing === problem.id ? null : problem.id)}
                        className="font-data shrink-0 text-[10px] tracking-widest text-faint hover:text-ink"
                      >
                        TAG
                      </button>
                      <button
                        type="button"
                        onClick={() => run(() => removeProblemAction(problem.id))}
                        aria-label={`Remove ${problem.title}`}
                        className="shrink-0 text-faint hover:text-bad"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : null}
                </div>

                {editing === problem.id ? (
                  <TagEditor
                    problem={problem}
                    onSave={(next) =>
                      run(() =>
                        updateProblemAction({
                          problemId: problem.id,
                          difficulty: next.difficulty || null,
                          topics: next.topics,
                        }),
                      )
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TagEditor({
  problem,
  onSave,
}: {
  problem: StoredProblem;
  onSave: (next: { difficulty: string; topics: string }) => void;
}) {
  const [difficulty, setDifficulty] = useState<string>(problem.difficulty ?? "");
  const [topics, setTopics] = useState(problem.topics.join(", "));

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <select
        value={difficulty}
        onChange={(event) => setDifficulty(event.target.value)}
        aria-label="Difficulty"
        className="font-data h-9 rounded-md border border-line bg-void px-2 text-sm text-ink focus:border-amber focus:outline-none"
      >
        <option value="">No difficulty</option>
        <option value="EASY">Easy</option>
        <option value="MEDIUM">Medium</option>
        <option value="HARD">Hard</option>
      </select>

      <Input
        value={topics}
        onChange={(event) => setTopics(event.target.value)}
        placeholder="arrays, dp"
        aria-label="Topics"
        className="h-9 max-w-[220px]"
      />

      <Button size="sm" onClick={() => onSave({ difficulty, topics })}>
        Save
      </Button>
    </div>
  );
}
