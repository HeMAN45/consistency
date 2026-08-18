import Link from "next/link";

import { MobileNav, SideNav } from "@/components/app-nav";
import { AmbientPlayer } from "@/components/ambient-player";
import { CommandPalette } from "@/components/command-palette";
import { OfflineSync } from "@/components/offline-sync";
import { ThemeToggle } from "@/components/theme-toggle";
import { RankBadge } from "@/components/rank-badge";
import { SignOutButton } from "@/components/sign-out-button";
import { unreadTotal } from "@/lib/chat";
import { pendingRequestCount } from "@/lib/friends";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [pendingRequests, unreadMessages] = await Promise.all([
    pendingRequestCount(user.id),
    unreadTotal(user.id),
  ]);

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="font-data sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-amber focus:px-4 focus:py-2 focus:text-sm focus:text-void"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
        <Link href="/dashboard" className="font-data px-3 text-base tracking-tight">
          <span className="text-amber">~/</span>
          <span className="text-ink">consistency</span>
        </Link>

        <div className="mt-6 flex-1">
          <SideNav pendingRequests={pendingRequests} unreadMessages={unreadMessages} />
        </div>

        <p className="font-data px-3 pb-2 text-[10px] tracking-widest text-faint">
          CTRL K FOR COMMANDS
        </p>

        <div className="flex items-center gap-1.5 px-3 pb-3">
          <AmbientPlayer />
          <ThemeToggle />
        </div>

        <div className="border-t border-line px-3 pt-4">
          <p className="truncate text-sm text-ink-soft">{user.displayName}</p>
          <RankBadge rating={user.rating} className="mt-1" />
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-5 py-3 md:hidden">
          <Link href="/dashboard" className="font-data text-sm tracking-tight">
            <span className="text-amber">~/</span>
            <span className="text-ink">consistency</span>
          </Link>
          <div className="flex items-center gap-2">
            <AmbientPlayer />
            <RankBadge rating={user.rating} />
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 pb-24 md:px-8 md:py-8 md:pb-8"
        >
          {children}
        </main>
      </div>

      <MobileNav pendingRequests={pendingRequests} unreadMessages={unreadMessages} />
      <CommandPalette timezone={user.timezone} />
      <OfflineSync />
    </div>
  );
}
