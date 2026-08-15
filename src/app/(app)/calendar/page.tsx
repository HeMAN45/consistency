import type { Metadata } from "next";
import { DateJumper } from "@/components/date-jumper";
import { DaySchedule } from "@/components/day-schedule";
import { REST_DAYS_PER_MONTH, restDayKeys, restDaysInMonth } from "@/lib/rest-days";
import { scheduleForDay } from "@/lib/schedule";
import { requireUser } from "@/lib/session";
import { tasksForDay } from "@/lib/tasks";
import { formatDayKey, isValidDayKey, todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Calendar · ~/consistency" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const today = todayKey(user.timezone);
  const date = params.date && isValidDayKey(params.date) ? params.date : today;

  const [entries, tasks, rests, restsUsed] = await Promise.all([
    scheduleForDay(user.id, date),
    tasksForDay(user.id, date, user.timezone),
    restDayKeys(user.id, date, date),
    restDaysInMonth(user.id, date),
  ]);

  const isRestDay = rests.has(date);
  // Declaring, or undoing, is only possible strictly ahead of time.
  const canDeclareRest = date > today;

  const core = tasks.filter((t) => t.isCore);
  const coreDone = core.filter((t) => t.completed).length;

  return (
    <div className="rise space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-data text-2xl tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDayKey(date, "EEEE, d MMMM")}
            {date === today ? " · today" : ""}
          </p>
        </div>

        <DateJumper value={date} today={today} />
      </header>

      <DaySchedule
        dateKey={date}
        entries={entries}
        tasks={tasks.map((t) => ({ id: t.id, name: t.name, completed: t.completed }))}
        completionPct={core.length === 0 ? 0 : coreDone / core.length}
        coreDone={coreDone}
        coreTotal={core.length}
        isRestDay={isRestDay}
        canDeclareRest={canDeclareRest}
        restDaysUsed={restsUsed}
        restDaysPerMonth={REST_DAYS_PER_MONTH}
      />

      <p className="text-xs text-faint">
        These blocks are yours alone. No external calendar is connected.
      </p>

    </div>
  );
}
