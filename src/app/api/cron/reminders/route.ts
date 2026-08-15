import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { dayKeyFor, dayKeyToDate, localTimeNow, minutesFromHHmm, taskAppliesOn, todayKey } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily reminder job. Run it hourly from Vercel Cron; it works out who is due
 * based on each user's own timezone rather than server time.
 *
 * Rules that keep this from becoming spam:
 *  - only users who switched reminders on and have an email
 *  - only when their local clock has reached their chosen time
 *  - only when core tasks are still incomplete: nothing to nag about otherwise
 *  - at most one per local day, tracked by lastReminderAt
 */
const WINDOW_MINUTES = 90;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!emailConfigured()) {
    return NextResponse.json({ error: "Email is not configured." }, { status: 503 });
  }

  const candidates = await db.user.findMany({
    where: { reminderEnabled: true, email: { not: null } },
    select: {
      id: true,
      email: true,
      displayName: true,
      timezone: true,
      reminderTime: true,
      lastReminderAt: true,
      currentStreak: true,
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const user of candidates) {
    const today = todayKey(user.timezone);

    // Once per local day.
    if (user.lastReminderAt && dayKeyFor(user.lastReminderAt, user.timezone) === today) {
      skipped++;
      continue;
    }

    const nowMinutes = minutesFromHHmm(localTimeNow(user.timezone));
    const dueMinutes = minutesFromHHmm(user.reminderTime);

    if (nowMinutes < dueMinutes || nowMinutes > dueMinutes + WINDOW_MINUTES) {
      skipped++;
      continue;
    }

    const [tasks, logs] = await Promise.all([
      db.task.findMany({
        where: { ownerUserId: user.id, isActive: true, isCore: true, archivedAt: null },
        select: { id: true, name: true, dayType: true, scheduledDate: true, createdAt: true },
      }),
      db.taskLog.findMany({
        where: { userId: user.id, date: dayKeyToDate(today), completed: true },
        select: { taskId: true },
      }),
    ]);

    const scheduled = tasks.filter(
      (task) =>
        taskAppliesOn(task, today) && dayKeyFor(task.createdAt, user.timezone) <= today,
    );

    const done = new Set(logs.map((l) => l.taskId));
    const remaining = scheduled.filter((task) => !done.has(task.id));

    // Nothing outstanding means nothing worth an email.
    if (scheduled.length === 0 || remaining.length === 0) {
      skipped++;
      continue;
    }

    const lines = [
      `${user.displayName},`,
      "",
      `${remaining.length} of ${scheduled.length} core tasks are still open today:`,
      "",
      ...remaining.slice(0, 8).map((task) => `  ${task.name}`),
      "",
      user.currentStreak > 0
        ? `Your streak is at ${user.currentStreak} ${user.currentStreak === 1 ? "day" : "days"}.`
        : "No streak yet. Today is day one if you want it.",
      "",
      appUrl("/dashboard"),
      "",
      "Turn these off any time in Settings.",
    ];

    const result = await sendEmail({
      to: user.email as string,
      subject: `${remaining.length} core ${remaining.length === 1 ? "task" : "tasks"} left today`,
      text: lines.join("\n"),
    });

    if (result.ok) {
      await db.user.update({ where: { id: user.id }, data: { lastReminderAt: new Date() } });
      sent++;
    }
  }

  return NextResponse.json({ checked: candidates.length, sent, skipped });
}
