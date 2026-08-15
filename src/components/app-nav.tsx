"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Settings,
  Timer,
  Users,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/sync", label: "SYNC", icon: Zap },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/sync", label: "SYNC", icon: Zap },
  { href: "/settings", label: "You", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ pendingRequests = 0 }: { pendingRequests?: number }) {
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
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
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
      </ul>
    </nav>
  );
}
