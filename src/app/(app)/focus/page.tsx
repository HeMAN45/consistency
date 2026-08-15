import type { Metadata } from "next";

import { FocusTimer } from "@/components/focus-timer";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { tasksForDay } from "@/lib/tasks";
import { todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Focus · ~/consistency" };

export default async function FocusPage() {
  const user = await requireUser();
  const today = todayKey(user.timezone);

  const [tasks, sessions] = await Promise.all([
    tasksForDay(user.id, today, user.timezone),
    db.focusSession.findMany({
      where: { userId: user.id, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const totalMinutes = Math.round(
    sessions.reduce((sum, s) => sum + s.elapsedSeconds, 0) / 60,
  );

  return (
    <div className="rise space-y-6">
      <header>
        <h1 className="font-data text-2xl tracking-tight">Focus</h1>
        <p className="mt-1 text-sm text-muted">
          One task, one timer, nothing else on screen.
        </p>
      </header>

      <FocusTimer
        tasks={tasks.map((t) => ({ id: t.id, name: t.name, category: t.category }))}
      />

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-data text-[11px] tracking-widest text-muted">RECENT SESSIONS</p>
          {sessions.length > 0 ? (
            <p className="font-data text-[11px] text-faint">{totalMinutes} min logged</p>
          ) : null}
        </div>

        {sessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No sessions yet. Start one above.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 border-b border-line py-2 last:border-0"
              >
                <span className="flex-1 truncate text-sm">{s.label}</span>
                <span className="font-data text-xs text-muted">
                  {Math.round(s.elapsedSeconds / 60)} min
                </span>
                <span className="font-data w-14 text-right text-xs text-faint">
                  {s.xpAwarded > 0 ? `+${s.xpAwarded} XP` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
