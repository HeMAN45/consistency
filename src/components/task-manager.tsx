"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore, ChevronDown, ChevronUp, ExternalLink, Pencil, Trash2, X } from "lucide-react";

import {
  archiveTaskAction,
  createTaskAction,
  reorderTasksAction,
  updateTaskAction,
} from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { categoryLabel, CATEGORY_LABELS, DAY_TYPE_LABELS } from "@/lib/task-labels";
import { cn } from "@/lib/utils";

type Category = keyof typeof CATEGORY_LABELS;
type DayType = keyof typeof DAY_TYPE_LABELS;

export type ManagedTask = {
  id: string;
  name: string;
  category: Category;
  customLabel: string | null;
  dayType: DayType;
  scheduledDate: string | null;
  linkUrl: string | null;
  isCore: boolean;
  archived: boolean;
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const DAY_TYPES = Object.keys(DAY_TYPE_LABELS) as DayType[];

const selectClass =
  "font-data h-10 w-full rounded-md border border-line bg-void px-2 text-sm text-ink focus:border-amber focus:outline-none";

export function TaskManager({ tasks }: { tasks: ManagedTask[] }) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [, startTransition] = useTransition();

  const active = tasks.filter((t) => !t.archived);
  const archived = tasks.filter((t) => t.archived);
  const core = active.filter((t) => t.isCore);
  const bonus = active.filter((t) => !t.isCore);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else setEditing(null);
    });
  }

  function move(task: ManagedTask, direction: -1 | 1) {
    const group = task.isCore ? core : bonus;
    const index = group.findIndex((t) => t.id === task.id);
    const target = index + direction;
    if (target < 0 || target >= group.length) return;

    const reordered = [...group];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    // Send the whole active order so sortOrder stays contiguous across groups.
    const orderedIds = [
      ...(task.isCore ? reordered : core).map((t) => t.id),
      ...(task.isCore ? bonus : reordered).map((t) => t.id),
    ];

    run(() => reorderTasksAction({ orderedIds }));
  }

  return (
    <div className="space-y-6">
      <NewTaskForm onSubmit={(data) => run(() => createTaskAction(data))} />

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}

      <Group
        title="CORE"
        caption="These decide your daily completion, streak and rating."
        tasks={core}
        editing={editing}
        setEditing={setEditing}
        onSave={(data) => run(() => updateTaskAction(data))}
        onArchive={(id) => run(() => archiveTaskAction(id, true))}
        onMove={move}
      />

      <Group
        title="BONUS"
        caption="Extra XP. Never required for a perfect day."
        tasks={bonus}
        editing={editing}
        setEditing={setEditing}
        onSave={(data) => run(() => updateTaskAction(data))}
        onArchive={(id) => run(() => archiveTaskAction(id, true))}
        onMove={move}
      />

      {archived.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="font-data text-[11px] tracking-widest text-muted hover:text-ink-soft"
          >
            ARCHIVED ({archived.length})
          </button>

          {showArchived ? (
            <ul className="mt-3 space-y-1">
              {archived.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-md border border-line px-3 py-2"
                >
                  <span className="flex-1 text-sm text-faint line-through">{task.name}</span>
                  <button
                    type="button"
                    onClick={() => run(() => archiveTaskAction(task.id, false))}
                    className="text-muted hover:text-ink"
                    aria-label={`Restore ${task.name}`}
                  >
                    <ArchiveRestore size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Group({
  title,
  caption,
  tasks,
  editing,
  setEditing,
  onSave,
  onArchive,
  onMove,
}: {
  title: string;
  caption: string;
  tasks: ManagedTask[];
  editing: string | null;
  setEditing: (id: string | null) => void;
  onSave: (data: ManagedTask) => void;
  onArchive: (id: string) => void;
  onMove: (task: ManagedTask, direction: -1 | 1) => void;
}) {
  return (
    <section>
      <p className="font-data text-[11px] tracking-widest text-muted">{title}</p>
      <p className="mt-1 text-xs text-faint">{caption}</p>

      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing here yet.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {tasks.map((task, index) => (
            <li key={task.id} className="card px-3 py-2">
              {editing === task.id ? (
                <EditRow task={task} onCancel={() => setEditing(null)} onSave={onSave} />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => onMove(task, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${task.name} up`}
                      className="text-faint hover:text-ink disabled:opacity-25"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(task, 1)}
                      disabled={index === tasks.length - 1}
                      aria-label={`Move ${task.name} down`}
                      className="text-faint hover:text-ink disabled:opacity-25"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm">
                      {task.name}
                      {task.linkUrl ? (
                        <a
                          href={task.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open the link for ${task.name}`}
                          className="text-amber hover:text-amber-soft"
                        >
                          <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </p>
                    <p className="font-data text-[10px] tracking-widest text-faint">
                      {categoryLabel(task).toUpperCase()} ·{" "}
                      {task.dayType === "ONE_OFF" && task.scheduledDate
                        ? task.scheduledDate
                        : DAY_TYPE_LABELS[task.dayType].toUpperCase()}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditing(task.id)}
                    className="text-muted hover:text-ink"
                    aria-label={`Edit ${task.name}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onArchive(task.id)}
                    className="text-muted hover:text-bad"
                    aria-label={`Archive ${task.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditRow({
  task,
  onCancel,
  onSave,
}: {
  task: ManagedTask;
  onCancel: () => void;
  onSave: (data: ManagedTask) => void;
}) {
  const [draft, setDraft] = useState(task);

  return (
    <div className="space-y-3 py-1">
      <Input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        aria-label="Task name"
        maxLength={60}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          className={selectClass}
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
          aria-label="Category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={draft.dayType}
          onChange={(e) => setDraft({ ...draft, dayType: e.target.value as DayType })}
          aria-label="Schedule"
        >
          {DAY_TYPES.map((d) => (
            <option key={d} value={d}>
              {DAY_TYPE_LABELS[d]}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={draft.isCore ? "core" : "bonus"}
          onChange={(e) => setDraft({ ...draft, isCore: e.target.value === "core" })}
          aria-label="Core or bonus"
        >
          <option value="core">Core</option>
          <option value="bonus">Bonus</option>
        </select>
      </div>

      {draft.dayType === "ONE_OFF" ? (
        <Input
          type="date"
          value={draft.scheduledDate ?? ""}
          onChange={(e) => setDraft({ ...draft, scheduledDate: e.target.value })}
          aria-label="Date for this one-off task"
        />
      ) : null}

      <Input
        value={draft.linkUrl ?? ""}
        onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })}
        placeholder="Link (optional): a LeetCode or Codeforces problem"
        aria-label="Task link"
      />

      {draft.category === "CUSTOM" ? (
        <Input
          value={draft.customLabel ?? ""}
          onChange={(e) => setDraft({ ...draft, customLabel: e.target.value })}
          placeholder="Name this category, e.g. Guitar"
          aria-label="Custom category name"
          maxLength={24}
        />
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(draft)}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NewTaskForm({
  onSubmit,
}: {
  onSubmit: (data: Omit<ManagedTask, "id" | "archived">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    category: "CUSTOM" as Category,
    customLabel: "" as string,
    dayType: "DAILY" as DayType,
    scheduledDate: "" as string,
    linkUrl: "" as string,
    isCore: true,
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        Add task
      </Button>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="font-data text-[11px] tracking-widest text-muted">NEW TASK</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="text-muted hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <Field label="NAME" htmlFor="new-task-name">
          <Input
            id="new-task-name"
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Solve 2 DSA problems"
            maxLength={60}
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-3">
          <select
            className={selectClass}
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
            aria-label="Category"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            value={draft.dayType}
            onChange={(e) => setDraft({ ...draft, dayType: e.target.value as DayType })}
            aria-label="Schedule"
          >
            {DAY_TYPES.map((d) => (
              <option key={d} value={d}>
                {DAY_TYPE_LABELS[d]}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            value={draft.isCore ? "core" : "bonus"}
            onChange={(e) => setDraft({ ...draft, isCore: e.target.value === "core" })}
            aria-label="Core or bonus"
          >
            <option value="core">Core</option>
            <option value="bonus">Bonus</option>
          </select>
        </div>

        <Field
          label="LINK"
          htmlFor="new-task-link"
          hint="Optional. A LeetCode or Codeforces problem, a doc, anything."
        >
          <Input
            id="new-task-link"
            value={draft.linkUrl}
            onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })}
            placeholder="https://leetcode.com/problems/two-sum/"
          />
        </Field>

        {draft.dayType === "ONE_OFF" ? (
          <Field
            label="DATE"
            htmlFor="new-task-date"
            hint="This task appears on that day only."
          >
            <Input
              id="new-task-date"
              type="date"
              value={draft.scheduledDate}
              onChange={(e) => setDraft({ ...draft, scheduledDate: e.target.value })}
            />
          </Field>
        ) : null}

        {draft.category === "CUSTOM" ? (
          <Field
            label="CATEGORY NAME"
            htmlFor="new-task-custom"
            hint="Your own label. Analytics groups by it."
          >
            <Input
              id="new-task-custom"
              value={draft.customLabel}
              onChange={(e) => setDraft({ ...draft, customLabel: e.target.value })}
              placeholder="Guitar"
              maxLength={24}
            />
          </Field>
        ) : null}

        <Button
          size="sm"
          disabled={
            draft.name.trim().length === 0 ||
            (draft.dayType === "ONE_OFF" && !draft.scheduledDate)
          }
          onClick={() => {
            onSubmit(draft);
            setDraft({
              name: "",
              category: "CUSTOM",
              customLabel: "",
              dayType: "DAILY",
              scheduledDate: "",
              linkUrl: "",
              isCore: true,
            });
            setOpen(false);
          }}
          className={cn(draft.name.trim().length === 0 && "opacity-50")}
        >
          Create task
        </Button>
      </div>
    </div>
  );
}
