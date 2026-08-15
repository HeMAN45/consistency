import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Data Access Layer. The proxy only does an optimistic cookie check, so this
 * is the authoritative gate — every page and route handler starts here.
 * `cache` dedupes it across a single render pass.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      timezone: true,
      stepGoal: true,
      wakeGoalTime: true,
      allowNudges: true,
      reminderEnabled: true,
      reminderTime: true,
      rating: true,
      tier: true,
      xp: true,
      currentStreak: true,
      longestStreak: true,
      createdAt: true,
    },
  });
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers, where a redirect would be wrong. */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export class ForbiddenError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Ownership assertion used by every mutating route from Phase 2 onward. */
export function assertOwner(ownerId: string, userId: string) {
  if (ownerId !== userId) throw new ForbiddenError();
}
