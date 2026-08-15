"use client";

/**
 * Offline queue for task completions.
 *
 * The rules that matter:
 *  - one entry per task per day, so ticking and unticking offline collapses to
 *    the final state rather than replaying a fight
 *  - last write wins, by timestamp, which is the right call for a checkbox
 *  - entries survive a reload, so closing the app underground loses nothing
 *  - the rating is server-side, so an offline tick shows the box filled but the
 *    rank only moves once it syncs. The UI says so rather than pretending.
 */

const KEY = "consistency:pending-toggles";

export type PendingToggle = {
  taskId: string;
  date: string;
  completed: boolean;
  at: number;
};

function read(): PendingToggle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingToggle[]) : [];
  } catch {
    return [];
  }
}

function write(entries: PendingToggle[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent("pending-toggles-changed"));
  } catch {
    // Storage full or blocked. The tick is still applied on screen; it just
    // won't survive a reload, which is better than crashing.
  }
}

export function pendingCount() {
  return read().length;
}

export function enqueue(entry: Omit<PendingToggle, "at">) {
  const entries = read().filter((e) => !(e.taskId === entry.taskId && e.date === entry.date));
  entries.push({ ...entry, at: Date.now() });
  write(entries);
}

export function clearEntry(taskId: string, date: string) {
  write(read().filter((e) => !(e.taskId === taskId && e.date === date)));
}

export function clearAll() {
  write([]);
}

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Replays the queue oldest first. An entry that fails stays queued; an entry
 * the server rejects on its merits (outside the backfill window, task deleted)
 * is dropped, because retrying it forever would never succeed.
 */
export async function flush(
  send: (entry: PendingToggle) => Promise<{ error?: string } | undefined>,
) {
  const entries = read().sort((a, b) => a.at - b.at);
  if (entries.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const result = await send(entry);
      if (result?.error) {
        // A refusal is final, not a network problem.
        clearEntry(entry.taskId, entry.date);
        failed += 1;
      } else {
        clearEntry(entry.taskId, entry.date);
        sent += 1;
      }
    } catch {
      // Still offline. Leave it queued and stop trying for now.
      break;
    }
  }

  return { sent, failed };
}
