"use client";

import { useState, useTransition } from "react";

import { saveMetricsAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type Props = {
  dateKey: string;
  stepGoal: number;
  wakeGoalTime: string;
  initial: { steps: number | null; wakeTime: string | null; notes: string | null };
};

export function MetricsForm({ dateKey, stepGoal, wakeGoalTime, initial }: Props) {
  const [steps, setSteps] = useState(initial.steps?.toString() ?? "");
  const [wakeTime, setWakeTime] = useState(initial.wakeTime ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveMetricsAction({
        date: dateKey,
        steps: steps.trim() === "" ? null : Number(steps),
        wakeTime: wakeTime.trim() === "" ? null : wakeTime,
        notes: notes.trim() === "" ? null : notes,
      });
      setMessage(
        result.error ? { text: result.error, bad: true } : { text: "Saved." },
      );
    });
  }

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">TODAY&apos;S METRICS</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="STEPS" htmlFor="steps" hint={`Goal ${stepGoal.toLocaleString("en-IN")}`}>
          <Input
            id="steps"
            inputMode="numeric"
            value={steps}
            onChange={(e) => setSteps(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
          />
        </Field>

        <Field label="WAKE TIME" htmlFor="wakeTime" hint={`Goal ${wakeGoalTime}`}>
          <Input
            id="wakeTime"
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="NOTE" htmlFor="notes" hint="Optional. One line about the day.">
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={pending} size="sm">
          {pending ? "Saving…" : "Save metrics"}
        </Button>
        {message ? (
          <span className={message.bad ? "text-sm text-bad" : "text-sm text-good"}>
            {message.text}
          </span>
        ) : null}
      </div>
    </section>
  );
}
