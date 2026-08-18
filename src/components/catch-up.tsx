"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { catchUpAction } from "@/app/(app)/watch/watch-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/**
 * For joining part way through a course. Marks earlier videos as watched
 * without writing a single task log, so forty videos of prior progress move the
 * plan forward without inventing forty days of history you never had here.
 */
export function CatchUp({
  playlistId,
  total,
  watched,
}: {
  playlistId: string;
  total: number;
  watched: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(watched || ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const upTo = Number(value);
    if (!Number.isInteger(upTo) || upTo < 1 || upTo > total) {
      setError(`Enter a number between 1 and ${total}.`);
      return;
    }

    setError(null);
    startTransition(async () => {
      // Positions are zero-based; the user counts from one.
      const result = await catchUpAction({ playlistId, throughPosition: upTo - 1 });
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-data text-[10px] tracking-widest text-muted hover:text-ink"
      >
        ALREADY WATCHED SOME OF THIS?
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-line p-4">
      <p className="text-sm text-ink">Where are you up to?</p>
      <p className="mt-1 text-xs text-muted">
        Everything up to and including that video is marked watched, and the plan starts from the
        next one. Nothing is added to your streak or rating: you did that work elsewhere.
      </p>

      <div className="mt-3 flex gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          inputMode="numeric"
          placeholder="40"
          aria-label="Last video you watched"
          className="max-w-[110px]"
        />
        <Button size="md" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Set"}
        </Button>
        <Button size="md" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
