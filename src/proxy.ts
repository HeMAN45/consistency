import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` and statically checks for a
// function export, so Auth.js's destructured `export const { auth: proxy }`
// form is rejected. Assign first, then export as default.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // PWA assets must stay public: an icon or manifest redirected to /login
  // breaks installation and shows a blank icon on the home screen.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|sounds|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|json|webmanifest|m4a|mp3|ogg|wav|aac)$).*)",
  ],
};
