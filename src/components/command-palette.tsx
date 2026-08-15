"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { saveMetricsAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
};

/** Shortcuts must never fire while the user is typing (PRD §45). */
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export function CommandPalette({ timezone }: { timezone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const todayKey = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date()),
    [timezone],
  );

  const commands: Command[] = useMemo(
    () => [
      { id: "dashboard", label: "Go to dashboard", hint: "D", run: () => go("/dashboard") },
      { id: "tasks", label: "Go to tasks", hint: "T", run: () => go("/tasks") },
      { id: "focus", label: "Start a focus session", hint: "F", run: () => go("/focus") },
      { id: "calendar", label: "Open calendar", hint: "C", run: () => go("/calendar") },
      { id: "analytics", label: "Open analytics", hint: "A", run: () => go("/analytics") },
      { id: "achievements", label: "View achievements", run: () => go("/achievements") },
      { id: "sync", label: "Open SYNC", hint: "S", run: () => go("/sync") },
      { id: "settings", label: "Open settings", run: () => go("/settings") },
    ],
    [go],
  );

  /** `log steps 10432` and `steps 10432` both work. */
  const parsed = useMemo(() => {
    const match = query.trim().match(/^(?:log\s+)?steps\s+(\d{1,6})$/i);
    return match ? Number(match[1]) : null;
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if (event.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      if (open || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const map: Record<string, string> = {
        d: "/dashboard",
        t: "/tasks",
        f: "/focus",
        c: "/calendar",
        a: "/analytics",
        s: "/sync",
      };
      const href = map[event.key.toLowerCase()];
      if (href) {
        event.preventDefault();
        router.push(href);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, router]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setNote(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  async function submit() {
    if (parsed !== null) {
      const result = await saveMetricsAction({
        date: todayKey,
        steps: parsed,
        wakeTime: null,
        notes: null,
      });
      setNote(result.error ?? `Logged ${parsed.toLocaleString("en-IN")} steps.`);
      if (!result.error) {
        router.refresh();
        setTimeout(() => setOpen(false), 900);
      }
      return;
    }

    const first = filtered[0];
    if (first) void first.run();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-void/70 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="card w-full max-w-md overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="font-data text-sm text-amber">~/consistency $</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="type a command, or: log steps 10432"
            className="font-data flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            aria-label="Command"
          />
        </div>

        {parsed !== null ? (
          <button
            type="button"
            onClick={() => void submit()}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-raised"
          >
            <span>Log {parsed.toLocaleString("en-IN")} steps for today</span>
            <span className="font-data text-[10px] text-faint">ENTER</span>
          </button>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  onClick={() => void command.run()}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-raised",
                    index === 0 && "bg-raised/60",
                  )}
                >
                  <span>{command.label}</span>
                  {command.hint ? (
                    <span className="font-data text-[10px] text-faint">{command.hint}</span>
                  ) : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">No command matches that.</li>
            ) : null}
          </ul>
        )}

        {note ? <p className="border-t border-line px-4 py-2 text-sm text-good">{note}</p> : null}
      </div>
    </div>
  );
}
