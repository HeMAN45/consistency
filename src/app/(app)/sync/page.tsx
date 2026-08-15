import type { Metadata } from "next";

import { SyncList } from "@/components/sync-list";
import { listFriends } from "@/lib/friends";
import { requireUser } from "@/lib/session";
import { listSyncs, pendingInvites } from "@/lib/sync";

export const metadata: Metadata = { title: "SYNC · ~/consistency" };

export default async function SyncPage() {
  const user = await requireUser();

  const [syncs, invites, friends] = await Promise.all([
    listSyncs(user.id),
    pendingInvites(user.id),
    listFriends(user.id),
  ]);

  return (
    <div className="rise space-y-6">
      <header>
        <h1 className="font-data text-2xl tracking-tight">SYNC</h1>
        <p className="mt-1 text-sm text-muted">Let&apos;s grow together. Your progress stays yours.</p>
      </header>

      <SyncList
        syncs={syncs.map((s) => ({
          id: s.id,
          name: s.name,
          goalTitle: s.goalTitle,
          memberCount: s.memberCount,
          pct: s.pct,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          syncName: i.sync.name,
          from: i.invitedBy?.displayName ?? "a member",
        }))}
        friends={friends.map((f) => ({
          id: f.id,
          displayName: f.displayName,
          username: f.username,
        }))}
      />
    </div>
  );
}
