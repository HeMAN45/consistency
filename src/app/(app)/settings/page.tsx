import type { Metadata } from "next";

import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings · ~/consistency" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="rise space-y-6">
      <header>
        <h1 className="font-data text-2xl tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as <span className="font-data text-ink-soft">{user.username}</span>
        </p>
      </header>

      <SettingsForm
        displayName={user.displayName}
        timezone={user.timezone}
        stepGoal={user.stepGoal}
        wakeGoalTime={user.wakeGoalTime}
        email={user.email}
        reminderEnabled={user.reminderEnabled}
        reminderTime={user.reminderTime}
        allowNudges={user.allowNudges}
      />
    </div>
  );
}
