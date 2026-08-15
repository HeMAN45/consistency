import { db } from "@/lib/db";

/**
 * The privacy contract lives here, not in the UI.
 *
 * A friendship grants exactly four fields: display name, rank, streak, last
 * active. Every query in this file selects that shape explicitly, so a future
 * change can't accidentally widen it — there is no `select: undefined` path
 * that returns the whole user row.
 */
const FRIEND_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  rating: true,
  tier: true,
  currentStreak: true,
  longestStreak: true,
  lastActiveAt: true,
} as const;

export type FriendView = {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date;
  friendshipId: string;
};

export async function listFriends(userId: string): Promise<FriendView[]> {
  const friendships = await db.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: {
      id: true,
      requester: { select: FRIEND_FIELDS },
      addressee: { select: FRIEND_FIELDS },
    },
  });

  return friendships.map((f) => {
    const other = f.requester.id === userId ? f.addressee : f.requester;
    return {
      id: other.id,
      username: other.username,
      displayName: other.displayName,
      rating: other.rating,
      currentStreak: other.currentStreak,
      longestStreak: other.longestStreak,
      lastActiveAt: other.lastActiveAt,
      friendshipId: f.id,
    };
  });
}

export async function incomingRequests(userId: string) {
  return db.friendship.findMany({
    where: { addresseeId: userId, status: "PENDING" },
    select: { id: true, createdAt: true, requester: { select: FRIEND_FIELDS } },
    orderBy: { createdAt: "desc" },
  });
}

export async function outgoingRequests(userId: string) {
  return db.friendship.findMany({
    where: { requesterId: userId, status: "PENDING" },
    select: { id: true, createdAt: true, addressee: { select: FRIEND_FIELDS } },
    orderBy: { createdAt: "desc" },
  });
}

export async function pendingRequestCount(userId: string) {
  return db.friendship.count({ where: { addresseeId: userId, status: "PENDING" } });
}

/** Exact-username lookup only — no browsing the user list. */
export async function findUserByUsername(username: string, viewerId: string) {
  const user = await db.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: FRIEND_FIELDS,
  });

  if (!user || user.id === viewerId) return null;

  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: user.id },
        { requesterId: user.id, addresseeId: viewerId },
      ],
    },
    select: { id: true, status: true, requesterId: true },
  });

  return {
    user,
    relationship: existing
      ? {
          status: existing.status,
          outgoing: existing.requesterId === viewerId,
        }
      : null,
  };
}

export async function areFriends(a: string, b: string) {
  const found = await db.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}
