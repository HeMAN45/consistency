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
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration fails on http without localhost. Not fatal.
      });
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
