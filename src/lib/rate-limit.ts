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


/**
 * Generic fixed-window limiter, sharing the LoginAttempt table.
 *
 * The identifier is namespaced, e.g. "register:1.2.3.4", so counts for
 * different actions never collide. Postgres rather than memory, because a
 * serverless instance forgets everything between cold starts.
 */
export async function isRateLimited(
  namespace: string,
  key: string,
  limit: number,
  windowMinutes: number,
): Promise<boolean> {
  const identifier = `${namespace}:${key}`.toLowerCase().slice(0, 200);
  const since = new Date(Date.now() - windowMinutes * 60_000);

  const used = await db.loginAttempt.count({
    where: { identifier, createdAt: { gte: since } },
  });

  if (used >= limit) return true;

  await db.loginAttempt.create({ data: { identifier, success: true } });
  return false;
}

/** Best-effort client address behind a proxy. Never trusted for anything else. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
