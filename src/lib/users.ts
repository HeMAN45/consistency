import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { defaultTasksFor } from "@/lib/default-tasks";
import type { RegisterInput } from "@/lib/validation/auth";

export type CreateUserResult =
  | { ok: true; id: string; username: string }
  | { ok: false; error: string; status: number };

/** Shared by the server action and the JSON endpoint so behaviour can't drift. */
export async function createUser(input: RegisterInput): Promise<CreateUserResult> {
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          passwordHash,
          email: input.email ? input.email : null,
          timezone: input.timezone,
        },
        select: { id: true, username: true },
      });

      await tx.task.createMany({ data: defaultTasksFor(created.id) });
      return created;
    });

    return { ok: true, id: user.id, username: user.username };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(",") ?? "";
      return {
        ok: false,
        status: 409,
        error: target.includes("email") ? "That email is already registered." : "That username is taken.",
      };
    }
    console.error("createUser failed", error);
    return { ok: false, status: 500, error: "Could not create the account." };
  }
}
