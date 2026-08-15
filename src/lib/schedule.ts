import { db } from "@/lib/db";
import { dayKeyToDate, hhmmFromMinutes, type DayKey } from "@/lib/time";

export { overlaps, parseTimeRange } from "@/lib/schedule-rules";

export type ScheduleEntry = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  start: string;
  end: string;
  taskId: string | null;
  taskName: string | null;
  imported: boolean;
};

export async function scheduleForDay(userId: string, key: DayKey): Promise<ScheduleEntry[]> {
  const blocks = await db.scheduleBlock.findMany({
    where: { userId, date: dayKeyToDate(key) },
    orderBy: { startMinute: "asc" },
    select: {
      id: true,
      title: true,
      startMinute: true,
      endMinute: true,
      taskId: true,
      source: true,
      task: { select: { name: true } },
    },
  });

  return blocks.map((block) => ({
    id: block.id,
    title: block.title,
    startMinute: block.startMinute,
    endMinute: block.endMinute,
    start: hhmmFromMinutes(block.startMinute),
    end: hhmmFromMinutes(block.endMinute),
    taskId: block.taskId,
    taskName: block.task?.name ?? null,
    imported: block.source === "IMPORTED",
  }));
}
