import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // PWA assets must stay public: an icon or manifest redirected to /login
  // breaks installation and shows a blank icon on the home screen.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|json|webmanifest)$).*)",
  ],
};