"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { listConversations, loadThread, markRead, postMessage, type ChatMessage } from "@/lib/chat";
import { requireUser } from "@/lib/session";

export type ChatState = { error?: string; ok?: boolean };

const target = z
  .object({
    peerId: z.string().nullable().optional(),
    syncId: z.string().nullable().optional(),
  })
  .refine((value) => Boolean(value.peerId) !== Boolean(value.syncId), {
    message: "Pick exactly one conversation.",
  });

export async function fetchThreadAction(input: unknown): Promise<ChatMessage[] | null> {
  const user = await requireUser();
  const parsed = target.safeParse(input);
  if (!parsed.success) return null;

  const messages = await loadThread(user.id, {
    peerId: parsed.data.peerId ?? undefined,
    syncId: parsed.data.syncId ?? undefined,
  });

  if (messages) {
    await markRead(user.id, {
      peerId: parsed.data.peerId ?? undefined,
      syncId: parsed.data.syncId ?? undefined,
    });
  }

  return messages;
}

export async function sendMessageAction(input: unknown): Promise<ChatState> {
  const user = await requireUser();

  const parsed = target
    .and(z.object({ body: z.string().min(1).max(2000) }))
    .safeParse(input);

  if (!parsed.success) return { error: "Nothing to send." };

  const result = await postMessage(
    user.id,
    { peerId: parsed.data.peerId ?? undefined, syncId: parsed.data.syncId ?? undefined },
    parsed.data.body,
  );

  if ("error" in result && result.error) return { error: result.error };

  revalidatePath("/chat");
  return { ok: true };
}

export async function refreshConversationsAction() {
  const user = await requireUser();
  return listConversations(user.id);
}

/** Authors can withdraw their own message. Nothing else is editable. */
export async function deleteMessageAction(messageId: string): Promise<ChatState> {
  const user = await requireUser();

  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { authorId: true },
  });

  if (!message || message.authorId !== user.id) return { error: "Not found." };

  await db.message.delete({ where: { id: messageId } });

  revalidatePath("/chat");
  return { ok: true };
}
