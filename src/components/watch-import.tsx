"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importPlaylistAction } from "@/app/(app)/watch/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function WatchImport() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await importPlaylistAction(url);
      if (result.error) {
        setError(result.error);
        if (result.id) router.push(`/watch/${result.id}`);
        return;
      }
      setUrl("");
      if (result.id) router.push(`/watch/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <p className="font-data text-[11px] tracking-widest text-muted">ADD A PLAYLIST OR VIDEO</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && url.trim()) submit();
          }}
          placeholder="https://youtube.com/playlist?list=..."
        />
        <Button onClick={submit} disabled={pending || url.trim().length === 0}>
          {pending ? "Reading…" : "Add"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-faint">
        Saved as metadata only. Nothing is downloaded, and it is read from YouTube once, not on
        every visit.
      </p>
    </section>
  );
}
