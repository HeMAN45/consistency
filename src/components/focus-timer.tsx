"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { endFocusAction, startFocusAction } from "@/app/(app)/focus/actions";
import { FocusClock, type ClockStyle } from "@/components/focus-clock";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { CATEGORY_LABELS } from "@/lib/task-labels";

type Option = { id: string; name: string; category: keyof typeof CATEGORY_LABELS };

const DURATIONS = [25, 45, 60, 90];

function clock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusTimer({ tasks }: { tasks: Option[] }) {
  const router = useRouter();

  const [taskId, setTaskId] = useState<string>(tasks[0]?.id ?? "");
  const [label, setLabel] = useState(tasks[0]?.name ?? "Deep work");
  const [minutes, setMinutes] = useState(60);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [clockStyle, setClockStyle] = useState<ClockStyle>("plain");

  useEffect(() => {
    const stored = window.localStorage.getItem("consistency:clock-style");
    if (stored === "flip" || stored === "plain") setClockStyle(stored);
  }, []);

  function changeClockStyle(next: ClockStyle) {
    setClockStyle(next);
    window.localStorage.setItem("consistency:clock-style", next);
  }

  const target = minutes * 60;
  const remaining = Math.max(0, target - elapsed);
  const startedAtRef = useRef<number | null>(null);

  // Wall-clock based, so a backgrounded tab doesn't drift or freeze the count.
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      if (startedAtRef.current === null) return;
      setElapsed((base) => base + Math.round((Date.now() - startedAtRef.current!) / 1000));
      startedAtRef.current = Date.now();
    }, 1000);
    return () => clearInterval(tick);
  }, [running]);

  const finish = useCallback(
    async (completed: boolean) => {
      if (!sessionId) return;
      setRunning(false);
      startedAtRef.current = null;

      const result = await endFocusAction({ id: sessionId, elapsedSeconds: elapsed, completed });

      setSessionId(null);
      setElapsed(0);

      if ("error" in result && result.error) setMessage(result.error);
      else if ("xpAwarded" in result) {
        setMessage(
          completed
            ? `Session recorded. +${result.xpAwarded} XP.`
            : "Session stopped. Nothing awarded.",
        );
      }

      router.refresh();
    },
    [sessionId, elapsed, router],
  );

  useEffect(() => {
    if (running && remaining === 0 && sessionId) void finish(true);
  }, [running, remaining, sessionId, finish]);

  async function start() {
    setMessage(null);
    const selected = tasks.find((t) => t.id === taskId);

    const result = await startFocusAction({
      label: label.trim() || selected?.name || "Deep work",
      category: selected?.category ?? "CUSTOM",
      taskId: taskId || null,
      plannedMinutes: minutes,
    });

    if ("error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    if ("id" in result && result.id) {
      setSessionId(result.id);
      setElapsed(0);
      startedAtRef.current = Date.now();
      setRunning(true);
    }
  }

  if (sessionId) {
    return (
      <FocusClock
        remaining={remaining}
        style={clockStyle}
        onStyleChange={changeClockStyle}
        label={label}
        plannedMinutes={minutes}
        progress={elapsed / target}
      >
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (running) {
                startedAtRef.current = null;
                setRunning(false);
              } else {
                startedAtRef.current = Date.now();
                setRunning(true);
              }
            }}
          >
            {running ? "Pause" : "Resume"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void finish(false)}>
            Stop
          </Button>
          <Button size="sm" onClick={() => void finish(true)}>
            Finish now
          </Button>
        </div>

        <p className="mt-4 text-xs text-faint">
          Leaving this page ends the timer without recording it.
        </p>
      </FocusClock>
    );
  }

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">NEW SESSION</p>

      <div className="mt-4 space-y-4">
        {tasks.length > 0 ? (
          <Field
            label="TASK"
            htmlFor="focus-task"
            hint="Not listed? Pick 'Something else' and type your own name below."
          >
            <select
              id="focus-task"
              className="font-data h-10 w-full rounded-md border border-line bg-void px-2 text-sm text-ink focus:border-amber focus:outline-none"
              value={taskId}
              onChange={(e) => {
                setTaskId(e.target.value);
                const found = tasks.find((t) => t.id === e.target.value);
                if (found) setLabel(found.name);
              }}
            >
              <option value="">Something else (type a name below)</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field
          label="LABEL"
          htmlFor="focus-label"
          hint="What this session is called in your history. Edit it freely."
        >
          <Input
            id="focus-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
          />
        </Field>

        <div>
          <p className="font-data text-[11px] tracking-widest text-muted">LENGTH</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={minutes === d ? "primary" : "ghost"}
                onClick={() => setMinutes(d)}
              >
                {d} min
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={() => void start()}>Start focus</Button>

        {message ? <p className="text-sm text-good">{message}</p> : null}
      </div>

      <p className="mt-4 text-xs text-faint">
        10 XP per completed half hour. Focus never counts toward core completion or your streak.
      </p>
    </section>
  );
}
