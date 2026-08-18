import type { Metadata } from "next";

import { TaskManager, type ManagedTask } from "@/components/task-manager";
import { requireUser } from "@/lib/session";
import { allTasks } from "@/lib/tasks";

export const metadata: Metadata = { title: "Tasks · ~/consistency" };

export default async function TasksPage() {
  const user = await requireUser();
  const tasks = await allTasks(user.id);

  const managed: ManagedTask[] = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    customLabel: t.customLabel,
    dayType: t.dayType,
    scheduledDate: t.scheduledDate ? t.scheduledDate.toISOString().slice(0, 10) : null,
    linkUrl: t.linkUrl,
    isCore: t.isCore,
    archived: Boolean(t.archivedAt),
  }));

  return (
    <div className="rise space-y-6">
      <header>
        <h1 className="font-data text-2xl tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-muted">
          Core work sets your daily bar. Archiving keeps your history intact.
        </p>
      </header>

      <TaskManager tasks={managed} />
    </div>
  );
}
