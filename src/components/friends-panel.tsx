"use client";

import { useState, useTransition } from "react";
import { Check, UserMinus, X } from "lucide-react";

import {
  removeFriendshipAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
} from "@/app/(app)/social-actions";
import { RankBadge } from "@/components/rank-badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type Person = {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  currentStreak: number;
  lastActiveAt: string;
};

type Props = {
  friends: (Person & { friendshipId: string })[];
  incoming: { id: string; person: Person }[];
  outgoing: { id: string; person: Person }[];
};

export function FriendsPanel({ friends, incoming, outgoing }: Props) {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string; message?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setMessage({ text: result.error, bad: true });
      else if (result.message) setMessage({ text: result.message });
    });
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <Field label="ADD BY USERNAME" htmlFor="friend-username" hint="Exact username, case-insensitive.">
          <div className="flex gap-2">
            <Input
              id="friend-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="rahul"
              onKeyDown={(e) => {
                if (e.key === "Enter" && username.trim()) {
                  run(() => sendFriendRequestAction(username));
                  setUsername("");
                }
              }}
            />
            <Button
              size="md"
              disabled={pending || username.trim().length === 0}
              onClick={() => {
                run(() => sendFriendRequestAction(username));
                setUsername("");
              }}
            >
              Send
            </Button>
          </div>
        </Field>

        {message ? (
          <p className={message.bad ? "mt-3 text-sm text-bad" : "mt-3 text-sm text-good"}>
            {message.text}
          </p>
        ) : null}
      </section>

      {incoming.length > 0 ? (
        <section>
          <p className="font-data text-[11px] tracking-widest text-amber">
            REQUESTS ({incoming.length})
          </p>
          <ul className="mt-3 space-y-2">
            {incoming.map((request) => (
              <li key={request.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{request.person.displayName}</p>
                  <p className="font-data text-[11px] text-faint">@{request.person.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => run(() => respondFriendRequestAction(request.id, true))}
                  aria-label={`Accept ${request.person.displayName}`}
                  className="text-good hover:opacity-70"
                >
                  <Check size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => run(() => respondFriendRequestAction(request.id, false))}
                  aria-label={`Decline ${request.person.displayName}`}
                  className="text-muted hover:text-bad"
                >
                  <X size={17} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <p className="font-data text-[11px] tracking-widest text-muted">
          FRIENDS ({friends.length})
        </p>

        {friends.length === 0 ? (
          <div className="card mt-3 p-6">
            <p className="text-sm text-ink">No friends yet.</p>
            <p className="mt-1 text-sm text-muted">
              Build your accountability circle. Add someone by username above.
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {friends.map((friend) => (
              <li key={friend.id} className="card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{friend.displayName}</p>
                  <p className="font-data text-[11px] text-faint">@{friend.username}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <RankBadge rating={friend.rating} />
                    <span className="font-data text-[11px] text-muted">
                      {friend.currentStreak}d streak
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => run(() => removeFriendshipAction(friend.friendshipId))}
                  aria-label={`Remove ${friend.displayName}`}
                  className="text-muted hover:text-bad"
                >
                  <UserMinus size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-faint">
          Friends see your name, rank, streak and last active day. Nothing else.
        </p>
      </section>

      {outgoing.length > 0 ? (
        <section>
          <p className="font-data text-[11px] tracking-widest text-muted">SENT</p>
          <ul className="mt-2 space-y-1">
            {outgoing.map((request) => (
              <li key={request.id} className="font-data text-sm text-faint">
                @{request.person.username} · awaiting reply
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
