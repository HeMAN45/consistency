import { PrismaClient } from "@prisma/client";

/**
 * Serverless Postgres suspends when idle, and the request that wakes it usually
 * fails before the compute is ready. Telling the user to reload is not a fix:
 * the query should simply wait and try again.
 *
 * This retries only connection failures. A constraint violation, a missing row
 * or bad input fails immediately, as it should, because retrying those would
 * hide real bugs behind a delay.
 */

const RETRIES = 3;
const BACKOFF_MS = [400, 900, 1800];

function isConnectionFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const name = (error as { name?: string }).name ?? "";
  const code = (error as { errorCode?: string; code?: string }).code ?? "";
  const message = (error as { message?: string }).message ?? "";

  return (
    name === "PrismaClientInitializationError" ||
    // P1001 unreachable, P1002 timed out, P1017 connection closed.
    code === "P1001" ||
    code === "P1002" ||
    code === "P1017" ||
    message.includes("Can't reach database server") ||
    message.includes("Server has closed the connection") ||
    message.includes("Connection reset by peer") ||
    message.includes("ECONNRESET")
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return base.$extends({
    query: {
      async $allOperations({ args, query, model, operation }) {
        let lastError: unknown;

        for (let attempt = 0; attempt <= RETRIES; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;

            if (!isConnectionFailure(error) || attempt === RETRIES) throw error;

            if (attempt === 0) {
              console.warn(
                `[db] ${model ?? "raw"}.${operation} could not reach the database. Waking it and retrying.`,
              );
            }

            await wait(BACKOFF_MS[attempt] ?? 2000);
          }
        }

        throw lastError;
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
