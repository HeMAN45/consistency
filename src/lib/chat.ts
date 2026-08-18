import { db } from "@/lib/db";
import { areFriends, listFriends } from "@/lib/friends";
import { describeLink } from "@/lib/shared-links";
import { requireMembership } from "@/lib/sync";

/**
 * Chat, kept deliberately small.
 *
 * Two kinds of thread: direct with a friend, and one per SYNC. Messages carry
 * text and links, nothing else. No editing, no reactions, no threads inside
 * threads. Nothing here creates a task or moves a score, because sending
 * somebody a problem is not the same as solving it.
 *
 * It lives on its own tab rather than inside a SYNC room on purpose: a message
 * feed under the standings turns a scoreboard into a group chat with statistics
 * attached.
 */

const PAGE = 60;
const MAX_LENGTH = 2000;

export type ChatMessage = {
  id: string;
  body: string;
  url: string | null;
  linkTitle: string | null;
  at: string;
  authorId: string;
  authorName: string;
  mine: boolean;
};

export type Conversation = {
  kind: "direct" | "sync";
  id: string;
  name: string;
  preview: string | null;
  at: string | null;
  unread: number;
};

/** The first link in a message body, described once on the way in. */
function extractLink(body: string) {
  const match = body.match(/https?:\/\/\S+/i);
  if (!match) return { url: null, linkTitle: null };

  const described = describeLink(match[0]);
  return {
    url: match[0].slice(0, 500),
    linkTitle: described?.title.slice(0, 120) ?? null,
  };
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  const [friends, memberships, reads] = await Promise.all([
    listFriends(userId),
    db.syncMembership.findMany({
      where: { userId, status: "ACCEPTED" },
      select: { sync: { select: { id: true, name: true, archivedAt: true } } },
    }),
    db.chatRead.findMany({
      where: { userId },
      select: { peerId: true, syncId: true, lastReadAt: true },
    }),
  ]);

  const readAt = new Map<string, Date>();
  for (const read of reads) {
    readAt.set(read.peerId ? `direct:${read.peerId}` : `sync:${read.syncId}`, read.lastReadAt);
  }

  const conversations: Conversation[] = [];

  for (const friend of friends) {
    const [last, unread] = await Promise.all([
      db.message.findFirst({
        where: {
          OR: [
            { authorId: userId, recipientId: friend.id },
            { authorId: friend.id, recipientId: userId },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { body: true, createdAt: true },
      }),
      db.message.count({
        where: {
          authorId: friend.id,
          recipientId: userId,
          createdAt: { gt: readAt.get(`direct:${friend.id}`) ?? new Date(0) },
        },
      }),
    ]);

    conversations.push({
      kind: "direct",
      id: friend.id,
      name: friend.displayName,
      preview: last?.body.slice(0, 80) ?? null,
      at: last?.createdAt.toISOString() ?? null,
      unread,
    });
  }

  for (const membership of memberships) {
    if (membership.sync.archivedAt) continue;

    const [last, unread] = await Promise.all([
      db.message.findFirst({
        where: { syncId: membership.sync.id },
        orderBy: { createdAt: "desc" },
        select: { body: true, createdAt: true },
      }),
      db.message.count({
        where: {
          syncId: membership.sync.id,
          authorId: { not: userId },
          createdAt: { gt: readAt.get(`sync:${membership.sync.id}`) ?? new Date(0) },
        },
      }),
    ]);

    conversations.push({
      kind: "sync",
      id: membership.sync.id,
      name: membership.sync.name,
      preview: last?.body.slice(0, 80) ?? null,
      at: last?.createdAt.toISOString() ?? null,
      unread,
    });
  }

  // Anything with activity first, then unread, then alphabetical.
  return conversations.sort((a, b) => {
    if (a.unread !== b.unread) return b.unread - a.unread;
    if (a.at && b.at) return a.at < b.at ? 1 : -1;
    if (a.at) return -1;
    if (b.at) return 1;
    return a.name.localeCompare(b.name);
  });
}

async function canAccess(userId: string, target: { peerId?: string; syncId?: string }) {
  if (target.peerId) return areFriends(userId, target.peerId);
  if (target.syncId) return Boolean(await requireMembership(target.syncId, userId));
  return false;
}

export async function loadThread(
  userId: string,
  target: { peerId?: string; syncId?: string },
): Promise<ChatMessage[] | null> {
  if (!(await canAccess(userId, target))) return null;

  const messages = await db.message.findMany({
    where: target.peerId
      ? {
          OR: [
            { authorId: userId, recipientId: target.peerId },
            { authorId: target.peerId, recipientId: userId },
          ],
        }
      : { syncId: target.syncId },
    orderBy: { createdAt: "desc" },
    take: PAGE,
    select: {
      id: true,
      body: true,
      url: true,
      linkTitle: true,
      createdAt: true,
      authorId: true,
      author: { select: { displayName: true } },
    },
  });

  return messages.reverse().map((message) => ({
    id: message.id,
    body: message.body,
    url: message.url,
    linkTitle: message.linkTitle,
    at: message.createdAt.toISOString(),
    authorId: message.authorId,
    authorName: message.author.displayName,
    mine: message.authorId === userId,
  }));
}

export async function postMessage(
  userId: string,
  target: { peerId?: string; syncId?: string },
  body: string,
) {
  const text = body.trim().slice(0, MAX_LENGTH);
  if (!text) return { error: "Nothing to send." };

  if (!(await canAccess(userId, target))) {
    return { error: "You can't post there." };
  }

  // A modest ceiling: enough for a real conversation, not enough to flood.
  const recent = await db.message.count({
    where: { authorId: userId, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent >= 30) return { error: "Slow down a moment." };

  const link = extractLink(text);

  await db.message.create({
    data: {
      authorId: userId,
      recipientId: target.peerId ?? null,
      syncId: target.syncId ?? null,
      body: text,
      url: link.url,
      linkTitle: link.linkTitle,
    },
  });

  await markRead(userId, target);
  return { ok: true };
}

export async function markRead(userId: string, target: { peerId?: string; syncId?: string }) {
  if (target.peerId) {
    await db.chatRead.upsert({
      where: { userId_peerId: { userId, peerId: target.peerId } },
      update: { lastReadAt: new Date() },
      create: { userId, peerId: target.peerId, lastReadAt: new Date() },
    });
    return;
  }

  if (target.syncId) {
    await db.chatRead.upsert({
      where: { userId_syncId: { userId, syncId: target.syncId } },
      update: { lastReadAt: new Date() },
      create: { userId, syncId: target.syncId, lastReadAt: new Date() },
    });
  }
}

export async function unreadTotal(userId: string) {
  const conversations = await listConversations(userId);
  return conversations.reduce((sum, conversation) => sum + conversation.unread, 0);
}
