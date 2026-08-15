import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";

/**
 * The raw token exists only in the email. The database holds its SHA-256 hash,
 * so a leaked table can't be replayed into account takeover.
 */

const TOKEN_TTL_MINUTES = 30;
const MAX_TOKENS_PER_HOUR = 3;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createResetToken(userId: string) {
  const since = new Date(Date.now() - 60 * 60_000);
  const recent = await db.passwordResetToken.count({
    where: { userId, createdAt: { gte: since } },
  });

  if (recent >= MAX_TOKENS_PER_HOUR) return null;

  const token = randomBytes(32).toString("base64url");

  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
    },
  });

  return { token, expiresInMinutes: TOKEN_TTL_MINUTES };
}

export async function consumeResetToken(token: string) {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  return record;
}

/** Marks the token used and invalidates every other outstanding one. */
export async function markTokenUsed(tokenId: string, userId: string) {
  await db.$transaction([
    db.passwordResetToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } }),
    db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
}
