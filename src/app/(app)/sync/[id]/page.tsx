import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeasonBanner } from "@/components/season-banner";
import { SyncReviewCard } from "@/components/sync-review-card";
import { SyncRoom } from "@/components/sync-room";
import { requireUser } from "@/lib/session";
import { loadSyncRoom } from "@/lib/sync";

export const metadata: Metadata = { title: "SYNC Room · ~/consistency" };

export default async function SyncRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  // Not a member? Indistinguishable from the SYNC not existing.
  const room = await loadSyncRoom(id, user.id, user.timezone);
  if (!room) notFound();

  return (
    <div className="rise space-y-5">
      <header>
        <Link href="/sync" className="font-data text-xs text-muted hover:text-ink">
          ← All SYNCs
        </Link>
        <h1 className="font-data mt-2 text-2xl tracking-tight">{room.sync.name}</h1>
      </header>

      <SeasonBanner season={room.season} summary={room.summary} />

      <SyncRoom
        syncId={room.sync.id}
        goalTitle={room.goal?.title ?? null}
        isOwner={room.isOwner}
        today={room.today}
        members={room.members}
        tasks={room.tasks.map((t) => ({
          id: t.id,
          name: t.name,
          isCore: t.isCore,
          canRemove: t.canRemove,
          completions: t.completions,
        }))}
        activity={room.activity}
        groupActivity={room.groupActivity}
        streak={room.streak}
        milestones={room.milestones}
        writable={room.writable}
      />

      {room.review ? <SyncReviewCard review={room.review} /> : null}
    </div>
  );
}
