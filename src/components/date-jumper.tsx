"use client";

import { useRouter } from "next/navigation";

import { shiftDayKey } from "@/lib/time";

/**
 * Jump straight to any date instead of stepping a day at a time. Uses the
 * native date picker, so it gets the platform's own month grid for free and
 * behaves correctly on mobile.
 */
export function DateJumper({ value, today }: { value: string; today: string }) {
  const router = useRouter();

  function go(next: string) {
    router.push(next === today ? "/calendar" : `/calendar?date=${next}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(shiftDayKey(value, -1))}
          aria-label="Previous day"
          className="font-data rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs text-muted hover:border-line-strong hover:text-ink"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => go(shiftDayKey(value, 1))}
          aria-label="Next day"
          className="font-data rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs text-muted hover:border-line-strong hover:text-ink"
        >
          ›
        </button>
      </div>

      <label className="sr-only" htmlFor="jump-date">
        Jump to a date
      </label>
      <input
        id="jump-date"
        type="date"
        value={value}
        onChange={(event) => {
          if (event.target.value) go(event.target.value);
        }}
        className="font-data h-8 rounded-md border border-line bg-void px-2 text-xs text-ink-soft focus:border-amber focus:outline-none"
      />

      <button
        type="button"
        onClick={() => go(shiftDayKey(value, 7))}
        className="font-data rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs text-muted hover:border-line-strong hover:text-ink"
      >
        +1 week
      </button>
      <button
        type="button"
        onClick={() => go(shiftDayKey(value, 30))}
        className="font-data rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs text-muted hover:border-line-strong hover:text-ink"
      >
        +1 month
      </button>

      {value !== today ? (
        <button
          type="button"
          onClick={() => go(today)}
          className="font-data rounded-md px-2 py-1.5 text-xs text-amber hover:text-amber-soft"
        >
          Today
        </button>
      ) : null}
    </div>
  );
}
