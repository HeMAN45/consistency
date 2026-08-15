"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card p-8">
      <p className="font-data text-[11px] tracking-widest text-bad">SOMETHING BROKE</p>
      <h1 className="font-data mt-2 text-xl tracking-tight">That screen didn&apos;t load.</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Your logged data is safe. This failed on the way to the page, not on the way to the
        database.
      </p>

      {error.digest ? (
        <p className="font-data mt-3 text-[11px] text-faint">REF {error.digest}</p>
      ) : null}

      <Button size="sm" className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
