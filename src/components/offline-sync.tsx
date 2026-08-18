"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";

import { toggleTaskAction } from "@/app/(app)/actions";
import { flush, isOffline, pendingCount, type PendingToggle } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

/**
 * Registers the service worker and drains the offline queue whenever the
 * connection comes back. Shows a status pill only when there is something to
 * say, so it stays out of the way on a normal day.
 */
export function OfflineSync() {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  const drain = useCallback(async () => {
    if (isOffline() || pendingCount() === 0) return;

    setSyncing(true);
    const result = await flush((entry: PendingToggle) =>
      toggleTaskAction({
        taskId: entry.taskId,
        date: entry.date,
        completed: entry.completed,
      }),
    );
    setSyncing(false);
    setPending(pendingCount());

    if (result.sent > 0) router.refresh();
  }, [router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            // An installed app otherwise keeps its old build until every tab is
            // closed, which on a phone can be weeks.
            registration.addEventListener("updatefound", () => {
              const installing = registration.installing;
              if (!installing) return;

              installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  setUpdateReady(true);
                }
              });
            });

            void registration.update();
          })
          .catch(() => {
            // Registration fails on http without localhost. Not fatal.
          });
      } else {
        /*
         * Never run the service worker in development. It caches /_next/static
         * cache-first, which is correct in production where filenames are
         * content-hashed, and catastrophic in dev where Turbopack reuses the
         * same chunk URLs: the browser pins the first build and every later
         * edit is invisible, surfacing as a hydration mismatch.
         *
         * Actively tear down anything registered earlier, so a developer who
         * already has one installed is freed without clearing site data.
         */
        void navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) void registration.unregister();
        });
        if ("caches" in window) {
          void caches.keys().then((keys) => {
            for (const key of keys) void caches.delete(key);
          });
        }
      }
    }

    setPending(pendingCount());
    setOffline(isOffline());

    function onOnline() {
      setOffline(false);
      void drain();
    }
    function onOffline() {
      setOffline(true);
    }
    function onChanged() {
      setPending(pendingCount());
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pending-toggles-changed", onChanged);

    void drain();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pending-toggles-changed", onChanged);
    };
  }, [drain]);

  if (updateReady) {
    return (
      <div
        role="status"
        className="font-data fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber/40 bg-surface px-3 py-1.5 text-[11px] text-amber md:bottom-5"
      >
        <span>New version ready</span>
        <button type="button" onClick={() => window.location.reload()} className="underline">
          RELOAD
        </button>
      </div>
    );
  }

  if (!offline && pending === 0) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-20 left-1/2 z-30 -translate-x-1/2 md:bottom-5",
        "font-data flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]",
        offline ? "border-warn/40 bg-surface text-warn" : "border-line bg-surface text-muted",
      )}
    >
      {offline ? <CloudOff size={13} /> : <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />}

      {offline ? (
        <span>
          Offline{pending > 0 ? ` · ${pending} saved here` : ""}
        </span>
      ) : (
        <span>
          {syncing ? "Syncing" : `${pending} to sync`}
        </span>
      )}

      {!offline && pending > 0 && !syncing ? (
        <button type="button" onClick={() => void drain()} className="text-amber">
          RETRY
        </button>
      ) : null}
    </div>
  );
}
