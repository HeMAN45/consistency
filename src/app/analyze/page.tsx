import type { Metadata } from "next";
import Link from "next/link";

import { PlaylistAnalyzer } from "@/components/playlist-analyzer";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/session";
import { todayKey } from "@/lib/time";

export const metadata: Metadata = {
  title: "Playlist analyzer · ~/consistency",
  description:
    "Paste a YouTube playlist and see its total runtime, video count, and how long it takes at 1x through 2x, plus the date you'd finish at any pace.",
};

export const dynamic = "force-dynamic";

export default async function AnalyzePage() {
  const user = await requireUser();
  const today = todayKey(user.timezone);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-12 sm:py-16">
      <header>
        <Link href="/dashboard" className="font-data text-sm tracking-tight">
          <span className="text-amber">~/</span>
          <span className="text-ink">consistency</span>
        </Link>

        <h1 className="mt-8 text-[clamp(1.9rem,6vw,3rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
          How long is that
          <br />
          <span className="text-amber">playlist, really?</span>
        </h1>

        <p className="mt-4 max-w-md text-ink-soft">
          Paste a YouTube playlist or video. Total runtime, time at every speed, and the date you
          would actually finish.
        </p>
      </header>

      <div className="mt-8">
        <PlaylistAnalyzer todayKey={today} />
      </div>

      <footer className="mt-12 border-t border-line pt-6">
        <p className="text-sm text-muted">
          Turn a playlist into scheduled tasks in{" "}
          <Link href="/watch" className="text-amber hover:text-amber-soft">
            Watch
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
