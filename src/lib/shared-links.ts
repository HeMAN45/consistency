import { db } from "@/lib/db";
import { areFriends } from "@/lib/friends";
import { parseProblemUrl, PLATFORM_LABELS } from "@/lib/problem-urls";
import { parsePlaylistId, parseVideoId } from "@/lib/youtube";

/**
 * Passing a link to a friend.
 *
 * Deliberately not a chat. One link, one optional line, no replies and no
 * thread: the moment a shared room has a message feed it competes with
 * WhatsApp and loses. Nothing here creates a task or moves a score, because
 * being sent something is not the same as doing it.
 */

export type LinkKind = "PROBLEM" | "VIDEO" | "PLAYLIST" | "LINK";

export function describeLink(url: string): { title: string; kind: LinkKind } | null {
  const problem = parseProblemUrl(url);
  if (!problem) return null;

  if (parsePlaylistId(url)) return { title: "YouTube playlist", kind: "PLAYLIST" };
  if (parseVideoId(url)) return { title: "YouTube video", kind: "VIDEO" };

  if (problem.platform !== "OTHER") {
    return { title: `${problem.title} · ${PLATFORM_LABELS[problem.platform]}`, kind: "PROBLEM" };
  }

  return { title: problem.title, kind: "LINK" };
}

export async function sendLink(input: {
  fromUserId: string;
  toUserId: string;
  url: string;
  note: string | null;
}) {
  if (input.fromUserId === input.toUserId) return { error: "That's you." };

  // Only friends. Otherwise this becomes a way to message strangers.
  if (!(await areFriends(input.fromUserId, input.toUserId))) {
    return { error: "You can only share with friends." };
  }

  const described = describeLink(input.url);
  if (!described) return { error: "That doesn't look like a link." };

  const recent = await db.sharedLink.count({
    where: {
      fromUserId: input.fromUserId,
      createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
    },
  });

  if (recent >= 30) return { error: "That's a lot of links in an hour. Give it a rest." };

  await db.sharedLink.create({
    data: {
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      url: input.url.trim().slice(0, 500),
      title: described.title.slice(0, 120),
      note: input.note?.trim().slice(0, 200) || null,
    },
  });

  return { ok: true };
}

export async function inbox(userId: string) {
  const links = await db.sharedLink.findMany({
    where: { toUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      url: true,
      title: true,
      note: true,
      createdAt: true,
      seenAt: true,
      from: { select: { id: true, displayName: true } },
    },
  });

  return links.map((link) => ({
    id: link.id,
    url: link.url,
    title: link.title,
    note: link.note,
    at: link.createdAt.toISOString(),
    seen: Boolean(link.seenAt),
    fromName: link.from.displayName,
  }));
}

export async function sent(userId: string) {
  const links = await db.sharedLink.findMany({
    where: { fromUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      createdAt: true,
      seenAt: true,
      to: { select: { displayName: true } },
    },
  });

  return links.map((link) => ({
    id: link.id,
    title: link.title,
    at: link.createdAt.toISOString(),
    seen: Boolean(link.seenAt),
    toName: link.to.displayName,
  }));
}

export function unseenCount(userId: string) {
  return db.sharedLink.count({ where: { toUserId: userId, seenAt: null } });
}
