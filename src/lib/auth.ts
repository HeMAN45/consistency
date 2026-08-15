import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;

        if (await isLoginRateLimited(username)) return null;

        const user = await db.user.findUnique({ where: { username } });

        // Compare against a dummy hash when the user is missing so that a
        // wrong username and a wrong password take the same time to answer.
        const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
        const ok = await bcrypt.compare(password, hash);

        if (!user || !ok) {
          await recordLoginAttempt(username, false);
          return null;
        }

        await recordLoginAttempt(username, true);
        await db.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });

        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          timezone: user.timezone,
          name: user.displayName,
          email: user.email ?? undefined,
        };
      },
    }),
  ],
});
