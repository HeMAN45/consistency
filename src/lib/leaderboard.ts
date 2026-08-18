import { db } from "@/lib/db";
import { listFriends } from "@/lib/friends";
import { tierFor } from "@/lib/rank";
import {
  dateToDayKey,
  dayKeyRange,
  dayKeyToDate,
  taskAppliesOn,
  todayKey,
  type DayKey,
} from "@/lib/time";

/**
 * Two leaderboards, deliberately measuring different things.
 *
 * Inside a SYNC, members are ranked by completion of the SYNC's own shared
 * tasks. That data is already visible in the room, so ranking it exposes
 * nothing new.
 *
 * Among friends, ranking by task completion would leak personal data: a friend
 * is only ever entitled to see name, rank, streak and last active. So the
 * friends board ranks on rating, which is the number those four fields already
 * imply.
 */

export type SyncRanking = {
  userId: string;
  displayName: string;
  rating: number;
  completed: number;
  scheduled: number;
  pct: number;
  isYou: boolean;
};

export async function syncLeaderboard(
  syncId: string,
  viewerId: string,
  timezone: string,
): Promise<SyncRanking[]> {
  const today = todayKey(timezone);

  const sync = await db.sync.findUnique({
    where: { id: syncId },
    select: { startDate: true, endDate: true, createdAt: true },
  });
  if (!sync) return [];

  const from = sync.startDate ? dateToDayKey(sync.startDate) : dateToDayKey(sync.createdAt);
  const rawTo = sync.endDate ? dateToDayKey(sync.endDate) : today;
  const to = rawTo > today ? today : rawTo;
  if (to < from) return [];

  const [members, tasks, logs, rests] = await Promise.all([
    db.syncMembership.findMany({
      where: { syncId, status: "ACCEPTED" },
      select: { userId: true, user: { select: { displayName: true, rating: true } } },
    }),
    db.syncTask.findMany({
      where: { syncId },
      select: {
        id: true,
        dayType: true,
        scheduledDate: true,
        createdAt: true,
        archivedAt: true,
      },
    }),
    db.syncTaskLog.findMany({
      where: {
        completed: true,
        syncTask: { syncId },
        date: { gte: dayKeyToDate(from), lte: dayKeyToDate(to) },
      },
      select: { userId: true, syncTaskId: true, date: true },
    }),
    db.restDay.findMany({
      where: { date: { gte: dayKeyToDate(from), lte: dayKeyToDate(to) } },
      select: { userId: true, date: true },
    }),
  ]);

  const done = new Set(logs.map((log) => `${dateToDayKey(log.date)}:${log.syncTaskId}:${log.userId}`));
  const resting = new Set(rests.map((rest) => `${dateToDayKey(rest.date)}:${rest.userId}`));

  const days = dayKeyRange(from, to);

  const rankings: SyncRanking[] = members.map((member) => {
    let scheduled = 0;
    let completed = 0;

    for (const day of days) {
      // A declared rest day is not a missed opportunity, so it leaves the
      // denominator entirely.
      if (resting.has(`${day}:${member.userId}`)) continue;

      for (const task of tasks) {
        if (dateToDayKey(task.createdAt) > day) continue;
        if (task.archivedAt && dateToDayKey(task.archivedAt) <= day) continue;
        if (!taskAppliesOn(task, day)) continue;

        scheduled += 1;
        if (done.has(`${day}:${task.id}:${member.userId}`)) completed += 1;
      }
    }

    return {
      userId: member.userId,
      displayName: member.user.displayName,
      rating: member.user.rating,
      completed,
      scheduled,
      pct: scheduled === 0 ? 0 : completed / scheduled,
      isYou: member.userId === viewerId,
    };
  });

  return rankings.sort(
    (a, b) => b.pct - a.pct || b.completed - a.completed || a.displayName.localeCompare(b.displayName),
  );
}

export type FriendRanking = {
  userId: string;
  displayName: string;
  rating: number;
  tier: string;
  streak: number;
  longestStreak: number;
  isYou: boolean;
};

export async function friendsLeaderboard(userId: string): Promise<FriendRanking[]> {
  const [friends, me] = await Promise.all([
    listFriends(userId),
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, rating: true, currentStreak: true, longestStreak: true },
    }),
  ]);

  if (!me) return [];

  const rows: FriendRanking[] = [
    {
      userId: me.id,
      displayName: me.displayName,
      rating: me.rating,
      tier: tierFor(me.rating).label,
      streak: me.currentStreak,
      longestStreak: me.longestStreak,
      isYou: true,
    },
    ...friends.map((friend) => ({
      userId: friend.id,
      displayName: friend.displayName,
      rating: friend.rating,
      tier: tierFor(friend.rating).label,
      streak: friend.currentStreak,
      longestStreak: friend.longestStreak,
      isYou: false,
    })),
  ];

  return rows.sort((a, b) => b.rating - a.rating || b.streak - a.streak);
}
