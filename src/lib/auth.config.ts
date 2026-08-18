import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the auth setup: no Prisma, no bcrypt, no Node APIs.
 * `src/proxy.ts` imports only this, so route gating stays lightweight.
 */
export const authConfig = {
  /*
   * Seven days rather than thirty, refreshed each day you use it. A stolen
   * session cookie is the realistic attack here, and a month-long window is a
   * long time to hold one.
   */
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const signedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        // The service worker serves this when the network is gone, so it can
        // never require a session check.
        pathname === "/offline";

      if (isPublic) return true;
      return signedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.username = (user as { username: string }).username;
        token.displayName = (user as { displayName: string }).displayName;
        token.timezone = (user as { timezone: string }).timezone;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.displayName = token.displayName as string;
        session.user.timezone = token.timezone as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
