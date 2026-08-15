import { db } from "@/lib/db";

export const LOGIN_LIMIT = { attempts: 8, windowMinutes: 15 } as const;

/** Fixed window per username. Serverless-safe because it lives in Postgres. */
export async function isLoginRateLimited(identifier: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_LIMIT.windowMinutes * 60_000);
  const failures = await db.loginAttempt.count({
    where: { identifier: identifier.toLowerCase(), success: false, createdAt: { gte: since } },
  });
  return failures >= LOGIN_LIMIT.attempts;
}

export async function recordLoginAttempt(identifier: string, success: boolean, ip?: string) {
  await db.loginAttempt.create({
    data: { identifier: identifier.toLowerCase(), success, ip },
  });
}

/** Housekeeping — call from a cron or after a successful login. */
export async function pruneLoginAttempts() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
