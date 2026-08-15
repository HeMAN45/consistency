"use client";

import { useState, useTransition } from "react";

import { updateSettingsAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type Props = {
  displayName: string;
  timezone: string;
  stepGoal: number;
  wakeGoalTime: string;
  email: string | null;
  reminderEnabled: boolean;
  reminderTime: string;
  allowNudges: boolean;
};

export function SettingsForm(initial: Props) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateSettingsAction({
        ...form,
        stepGoal: Number(form.stepGoal),
        email: form.email?.trim() ? form.email.trim() : null,
      });
      setMessage(result.error ? { text: result.error, bad: true } : { text: "Saved." });
    });
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">ACCOUNT</p>

        <Field label="DISPLAY NAME" htmlFor="displayName">
          <Input
            id="displayName"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            maxLength={40}
          />
        </Field>

        <Field
          label="EMAIL"
          htmlFor="email"
          hint="Used for password resets and reminders. Nothing else."
        >
          <Input
            id="email"
            type="email"
            value={form.email ?? ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="TIMEZONE"
          htmlFor="timezone"
          hint="Decides when your day starts and ends. Everything daily depends on it."
        >
          <Input
            id="timezone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            placeholder="Asia/Kolkata"
          />
        </Field>
      </div>

      <div className="card space-y-4 p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">GOALS</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="STEP GOAL" htmlFor="stepGoal">
            <Input
              id="stepGoal"
              inputMode="numeric"
              value={String(form.stepGoal)}
              onChange={(e) =>
                setForm({ ...form, stepGoal: Number(e.target.value.replace(/[^\d]/g, "") || 0) })
              }
            />
          </Field>

          <Field
            label="WAKE GOAL"
            htmlFor="wakeGoalTime"
            hint="15 minutes of grace counts as on time."
          >
            <Input
              id="wakeGoalTime"
              type="time"
              value={form.wakeGoalTime}
              onChange={(e) => setForm({ ...form, wakeGoalTime: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <p className="font-data text-[11px] tracking-widest text-muted">REMINDERS</p>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={form.reminderEnabled}
            onChange={(e) => setForm({ ...form, reminderEnabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-amber)]"
          />
          <span className="text-sm">Email me when core tasks are still open</span>
        </label>

        {form.reminderEnabled ? (
          <Field
            label="SEND AT"
            htmlFor="reminderTime"
            hint="Your local time. Nothing is sent on days you already finished."
          >
            <Input
              id="reminderTime"
              type="time"
              value={form.reminderTime}
              onChange={(e) => setForm({ ...form, reminderTime: e.target.value })}
              className="max-w-[160px]"
            />
          </Field>
        ) : null}

        <p className="text-xs text-faint">
          One email a day at most, and only when something is actually outstanding.
        </p>

        <label className="flex cursor-pointer items-center gap-3 border-t border-line pt-4">
          <input
            type="checkbox"
            checked={form.allowNudges}
            onChange={(e) => setForm({ ...form, allowNudges: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-amber)]"
          />
          <span className="text-sm">Let SYNC members nudge me</span>
        </label>
        <p className="text-xs text-faint">
          One nudge per person per day, and only when your shared work is still open.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending} size="sm">
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {message ? (
          <span className={message.bad ? "text-sm text-bad" : "text-sm text-good"}>
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
