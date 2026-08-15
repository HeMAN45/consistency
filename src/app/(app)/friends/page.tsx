import type { Metadata } from "next";

import { FriendsPanel } from "@/components/friends-panel";
import { incomingRequests, listFriends, outgoingRequests } from "@/lib/friends";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Friends · ~/consistency" };

export default async function FriendsPage() {
  const user = await requireUser();

  const [friends, incoming, outgoing] = await Promise.all([
    listFriends(user.id),
    incomingRequests(user.id),
    outgoingRequests(user.id),
  ]);

  return (
    <div className="rise space-y-6">
      <header>
        <h1 className="font-data text-2xl tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-muted">
          Your accountability circle. Your data stays yours.
        </p>
      </header>

      <FriendsPanel
        friends={friends.map((f) => ({
          id: f.id,
          username: f.username,
          displayName: f.displayName,
          rating: f.rating,
          currentStreak: f.currentStreak,
          lastActiveAt: f.lastActiveAt.toISOString(),
          friendshipId: f.friendshipId,
        }))}
        incoming={incoming.map((r) => ({
          id: r.id,
          person: {
            id: r.requester.id,
            username: r.requester.username,
            displayName: r.requester.displayName,
            rating: r.requester.rating,
            currentStreak: r.requester.currentStreak,
            lastActiveAt: r.requester.lastActiveAt.toISOString(),
          },
        }))}
        outgoing={outgoing.map((r) => ({
          id: r.id,
          person: {
            id: r.addressee.id,
            username: r.addressee.username,
            displayName: r.addressee.displayName,
            rating: r.addressee.rating,
            currentStreak: r.addressee.currentStreak,
            lastActiveAt: r.addressee.lastActiveAt.toISOString(),
          },
        }))}
      />
    </div>
  );
}
