"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Archive,
  Code2,
  Gauge,
  MessageSquare,
  MonitorPlay,
  MoreHorizontal,
  Settings,
  Timer,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/*
 * Ordered by how a day actually runs: what's due, what you do it with, when
 * it's planned, then how it went, then the people, then the settings you touch
 * once a month.
 */
const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/problems", label: "Problems", icon: Code2 },
  { href: "/watch", label: "Watch", icon: MonitorPlay },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/sync", label: "SYNC", icon: Zap },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/analyze", label: "Analyzer", icon: Gauge },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/problems", label: "Problems", icon: Code2 },
  { href: "/focus", label: "Focus", icon: Timer },
];

/** Everything the five-slot bar can't hold, reachable from one More sheet. */
const MOBILE_MORE = [
  { href: "/watch", label: "Watch", icon: MonitorPlay },
  { href: "/sync", label: "SYNC", icon: Zap },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/analyze", label: "Playlist analyzer", icon: Gauge },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({
  pendingRequests = 0,
  unreadMessages = 0,
}: {
  pendingRequests?: number;
  unreadMessages?: number;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="space-y-1">
      {PRIMARY.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-raised text-ink" : "text-muted hover:bg-raised/60 hover:text-ink-soft",
            )}
          >
            <Icon size={16} strokeWidth={1.75} className={active ? "text-amber" : undefined} />
            <span>{label}</span>
            {href === "/friends" && pendingRequests > 0 ? (
              <span className="font-data ml-auto rounded-full bg-amber px-1.5 text-[10px] text-void">
                {pendingRequests}
              </span>
            ) : null}
            {href === "/chat" && unreadMessages > 0 ? (
              <span className="font-data ml-auto rounded-full bg-amber px-1.5 text-[10px] text-void">
                {unreadMessages}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({
  pendingRequests = 0,
  unreadMessages = 0,
}: {
  pendingRequests?: number;
  unreadMessages?: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // The sheet is portalled to <body>: a fixed child of a transformed or sticky
  // ancestor is trapped inside that stacking context, which is how an overlay
  // ends up behind the page it is supposed to cover.
  useEffect(() => setMounted(true), []);

  const moreActive = MOBILE_MORE.some((item) => isActive(pathname, item.href));
  const moreBadge = pendingRequests + unreadMessages;

  const sheet = (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-void/70 backdrop-blur-sm md:hidden"
      onClick={() => setMoreOpen(false)}
      role="dialog"
      aria-label="More destinations"
    >
      <div
        className="w-full rounded-t-2xl border-t border-line bg-surface p-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="font-data text-[11px] tracking-widest text-muted">MORE</p>
          <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close">
            <X size={16} className="text-muted" />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-md px-2 py-2">
          <span className="text-sm text-ink-soft">Theme</span>
          <ThemeToggle />
        </div>

        <ul>
          {MOBILE_MORE.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-md px-2 py-3 text-sm text-ink-soft hover:bg-raised"
              >
                <Icon size={17} strokeWidth={1.75} className="text-muted" />
                <span>{label}</span>
                {href === "/friends" && pendingRequests > 0 ? (
                  <span className="font-data ml-auto rounded-full bg-amber px-1.5 text-[10px] text-void">
                    {pendingRequests}
                  </span>
                ) : null}
                {href === "/chat" && unreadMessages > 0 ? (
                  <span className="font-data ml-auto rounded-full bg-amber px-1.5 text-[10px] text-void">
                    {unreadMessages}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      {moreOpen && mounted ? createPortal(sheet, document.body) : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {MOBILE.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 text-[10px]",
                    active ? "text-amber" : "text-muted",
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span className="font-data tracking-wide">{label}</span>
                </Link>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={cn(
                "relative flex h-14 w-full flex-col items-center justify-center gap-1 text-[10px]",
                moreActive ? "text-amber" : "text-muted",
              )}
            >
              <MoreHorizontal size={18} strokeWidth={1.75} />
              <span className="font-data tracking-wide">More</span>
              {moreBadge > 0 ? (
                <span className="absolute top-2.5 right-6 h-1.5 w-1.5 rounded-full bg-amber" />
              ) : null}
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
