"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";


import {
  archiveSyncTaskAction,
  createSyncTaskAction,
  inviteToSyncAction,
  leaveSyncAction,
  nudgeMemberAction,
  removeMemberAction,
  toggleSyncTaskAction,
} from "@/app/(app)/social-actions";
import { RankBadge } from "@/components/rank-badge";
import {
  ActivityView,
  BoardView,
  PeopleView,
  TasksView,
  useStoredView,
  ViewSwitcher,
  type ActivityEntry,
  type ViewTask,
} from "@/components/sync-views";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Member = {
  userId: string;
  displayName: string;
  username: string;
  rating: number;
  streak: number;
  progress: number;
  target: number;
  pct: number;
  isYou: boolean;
  atRisk: boolean;
  onRestDay: boolean;
  nudgedByYou: boolean;
  acceptsNudges: boolean;
  doneToday: number;
  scheduledToday: number;
};

type SharedTask = {
  id: string;
  name: string;
  isCore: boolean;
  canRemove: boolean;
  completions: { userId: string; displayName: string; completed: boolean; isYou: boolean }[];
};

type Props = {
  syncId: string;
  goalTitle: string | null;
  isOwner: boolean;
  today: string;
  members: Member[];
  tasks: SharedTask[];
  activity: ActivityEntry[];
  groupActivity: number;
  streak: { current: number; longest: number; todayRatio: number; todayQualifies: boolean; threshold: number };
  milestones: { threshold: number; reached: boolean }[];
  writable: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function SyncRoom(props: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [view, setView] = useStoredView();
  const [inviteName, setInviteName] = useState("");
  const [, startTransition] = useTransition();

  const [tasks, setTasks] = useOptimistic(
    props.tasks,
    (state: SharedTask[], update: { taskId: string; userId: string; completed: boolean }) =>
      state.map((task) =>
        task.id === update.taskId
          ? {
              ...task,
              completions: task.completions.map((c) =>
                c.userId === update.userId ? { ...c, completed: update.completed } : c,
              ),
            }
          : task,
      ),
  );

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function toggleMine(task: SharedTask) {
    if (!props.writable) {
      setError("This season is closed. Its record stays as it is.");
      return;
    }

    const mine = task.completions.find((c) => c.isYou);
    if (!mine) return;

    setError(null);
    startTransition(async () => {
      setTasks({ taskId: task.id, userId: mine.userId, completed: !mine.completed });
      const result = await toggleSyncTaskAction({
        syncTaskId: task.id,
        date: props.today,
        completed: !mine.completed,
      });
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  // Fixed column order, so the matrix reads down a member as well as across a task.
  const columns = props.members;

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-data text-[11px] tracking-widest text-muted">GROUP STREAK</p>
            <p className="font-data mt-1.5 text-3xl leading-none tabular-nums">
              {props.streak.current}
              <span className="ml-1.5 text-sm text-muted">
                {props.streak.current === 1 ? "day" : "days"}
              </span>
            </p>
            <p className="mt-1 text-xs text-faint">Best {props.streak.longest}</p>
          </div>

          <div className="text-right">
            <p className="font-data text-[11px] tracking-widest text-muted">TODAY</p>
            <p
              className={cn(
                "font-data mt-1.5 text-2xl leading-none tabular-nums",
                props.streak.todayQualifies ? "text-good" : "text-ink",
              )}
            >
              {Math.round(props.streak.todayRatio * 100)}%
            </p>
            <p className="mt-1 text-xs text-faint">
              {Math.round(props.streak.threshold * 100)}% keeps it alive
            </p>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raised">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              props.streak.todayQualifies ? "bg-good" : "bg-amber",
            )}
            style={{ width: `${Math.min(100, props.streak.todayRatio * 100)}%` }}
          />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="font-data text-[11px] tracking-widest text-muted">MILESTONES</p>
          <ol className="mt-3 flex items-center gap-2">
            {props.milestones.map((milestone, index) => (
              <li key={milestone.threshold} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "font-data flex h-8 flex-1 items-center justify-center rounded-md border text-xs tabular-nums",
                    milestone.reached
                      ? "border-amber bg-amber/15 text-amber"
                      : "border-line text-faint",
                  )}
                >
                  {milestone.threshold}%
                </span>
                {index < props.milestones.length - 1 ? (
                  <span aria-hidden className="h-px w-2 bg-line" />
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-faint">
            Averaged across everyone against their own target.
          </p>
        </div>
      </section>

      <section className="card p-5">
        <p className="font-data text-[11px] tracking-widest text-amber">SHARED GOAL</p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">
          {props.goalTitle ?? "No goal set"}
        </h2>

        <ul className="mt-5 space-y-4">
          {props.members.map((member) => (
            <li key={member.userId}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className={cn("truncate text-sm", member.isYou && "text-amber")}>
                    {member.displayName}
                    {member.isYou ? " (you)" : ""}
                  </span>
                  <RankBadge rating={member.rating} />
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  {member.onRestDay ? (
                    <span className="font-data rounded-full border border-line px-2 py-0.5 text-[10px] tracking-widest text-muted">
                      REST DAY
                    </span>
                  ) : member.atRisk ? (
                    <span className="font-data rounded-full border border-warn/50 px-2 py-0.5 text-[10px] tracking-widest text-warn">
                      AT RISK
                    </span>
                  ) : null}

                  <span className="font-data text-sm tabular-nums text-ink-soft">
                    {member.progress} / {member.target}
                  </span>
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      member.isYou ? "bg-amber" : "bg-line-strong",
                    )}
                    style={{ width: `${member.pct * 100}%` }}
                  />
                </div>
                <span className="font-data w-9 text-right text-[11px] tabular-nums text-faint">
                  {Math.round(member.pct * 100)}%
                </span>

                {!member.isYou && member.atRisk && member.acceptsNudges ? (
                  <button
                    type="button"
                    disabled={member.nudgedByYou}
                    onClick={() => run(() => nudgeMemberAction(props.syncId, member.userId))}
                    className={cn(
                      "font-data text-[10px] tracking-widest",
                      member.nudgedByYou
                        ? "cursor-not-allowed text-faint"
                        : "text-amber hover:text-amber-soft",
                    )}
                  >
                    {member.nudgedByYou ? "NUDGED" : "NUDGE"}
                  </button>
                ) : null}

                {props.isOwner && !member.isYou ? (
                  <button
                    type="button"
                    onClick={() => run(() => removeMemberAction(props.syncId, member.userId))}
                    className="font-data text-[10px] tracking-widest text-faint hover:text-bad"
                  >
                    REMOVE
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-data text-[11px] tracking-widest text-muted">TODAY</p>
            <p className="font-data mt-1 text-[11px] tabular-nums text-faint">
              GROUP {Math.round(props.groupActivity * 100)}%
            </p>
          </div>

          <ViewSwitcher value={view} onChange={setView} />
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-amber transition-[width] duration-500"
            style={{ width: `${props.groupActivity * 100}%` }}
          />
        </div>

        <div className="mt-5">
          {tasks.length === 0 && view !== "activity" ? (
            <p className="text-sm text-muted">
              No shared tasks scheduled today. Anyone in the SYNC can add one below.
            </p>
          ) : (
            (() => {
              const shared = {
                members: props.members.map((m) => ({
                  userId: m.userId,
                  displayName: m.displayName,
                  isYou: m.isYou,
                })),
                tasks: tasks as ViewTask[],
                activity: props.activity,
                onToggle: (task: ViewTask) =>
                  toggleMine(tasks.find((t) => t.id === task.id) as SharedTask),
                onRemove: (taskId: string) => run(() => archiveSyncTaskAction(taskId)),
              };

              if (view === "people") return <PeopleView {...shared} />;
              if (view === "tasks") return <TasksView {...shared} />;
              if (view === "activity") return <ActivityView {...shared} />;
              return <BoardView {...shared} />;
            })()
          )}
        </div>

        <p className="mt-5 text-xs text-faint">
          You can only change your own row. SYNC work never counts toward your personal rank.
        </p>
      </section>

      {props.writable ? (
      <section className="card space-y-4 p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">ADD SHARED TASK</p>

        <div className="flex gap-2">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Solve 2 DSA problems"
            maxLength={60}
          />
          <Button
            size="md"
            disabled={!newTask.trim()}
            onClick={() => {
              run(() =>
                createSyncTaskAction({
                  syncId: props.syncId,
                  name: newTask,
                  category: "CUSTOM",
                  dayType: newTaskDate ? "ONE_OFF" : "DAILY",
                  scheduledDate: newTaskDate || null,
                  isCore: true,
                }),
              );
              setNewTask("");
              setNewTaskDate("");
            }}
          >
            Add
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sync-task-date" className="font-data text-[10px] tracking-widest text-faint">
            ONE DAY ONLY
          </label>
          <Input
            id="sync-task-date"
            type="date"
            value={newTaskDate}
            onChange={(e) => setNewTaskDate(e.target.value)}
            className="max-w-[170px]"
          />
          {newTaskDate ? (
            <button
              type="button"
              onClick={() => setNewTaskDate("")}
              className="font-data text-[10px] tracking-widest text-faint hover:text-ink"
            >
              CLEAR
            </button>
          ) : null}
        </div>

        <p className="text-xs text-faint">
          Anyone in the SYNC can add shared work. You can remove what you added; the creator can
          remove anything.
        </p>

        {props.isOwner ? (
          <div className="border-t border-line pt-4">
            <p className="font-data text-[11px] tracking-widest text-muted">INVITE A FRIEND</p>
            <div className="mt-2 flex gap-2">
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="username"
              />
              <Button
                size="md"
                variant="ghost"
                disabled={!inviteName.trim()}
                onClick={() => {
                  run(() => inviteToSyncAction(props.syncId, inviteName));
                  setInviteName("");
                }}
              >
                Invite
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-line pt-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                run(() => leaveSyncAction(props.syncId));
                router.push("/sync");
              }}
            >
              Leave SYNC
            </Button>
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}
