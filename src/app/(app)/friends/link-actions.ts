"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { sendLink } from "@/lib/shared-links";

export type LinkState = { error?: string; ok?: boolean; message?: string };

const sendSchema = z.object({
  toUserId: z.string().min(1),
  url: z.string().trim().min(1).max(500),
  note: z.string().trim().max(200).optional(),
});

export async function sendLinkAction(input: unknown): Promise<LinkState> {
  const user = await requireUser();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { error: "Paste a link." };

  const result = await sendLink({
    fromUserId: user.id,
    toUserId: parsed.data.toUserId,
    url: parsed.data.url,
    note: parsed.data.note ?? null,
  });

  if ("error" in result && result.error) return { error: result.error };

  revalidatePath("/friends");
  return { ok: true, message: "Sent." };
}

export async function markLinkSeenAction(linkId: string): Promise<LinkState> {
  const user = await requireUser();

  const link = await db.sharedLink.findUnique({
    where: { id: linkId },
    select: { toUserId: true, seenAt: true },
  });

  if (!link || link.toUserId !== user.id) return { error: "Not found." };
  if (link.seenAt) return { ok: true };

  await db.sharedLink.update({ where: { id: linkId }, data: { seenAt: new Date() } });

  revalidatePath("/friends");
  return { ok: true };
}

export async function deleteLinkAction(linkId: string): Promise<LinkState> {
  const user = await requireUser();

  const link = await db.sharedLink.findUnique({
    where: { id: linkId },
    select: { toUserId: true, fromUserId: true },
  });

  // Either end can remove it: the sender because it was a mistake, the
  // recipient because it is their inbox.
  if (!link || (link.toUserId !== user.id && link.fromUserId !== user.id)) {
    return { error: "Not found." };
  }

  await db.sharedLink.delete({ where: { id: linkId } });

  revalidatePath("/friends");
  return { ok: true };
}
