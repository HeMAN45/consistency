"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createSyncAction, respondSyncInviteAction } from "@/app/(app)/social-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type SyncCard = {
  id: string;
  name: string;
  goalTitle: string | null;
  memberCount: number;
  pct: number;
};

type Invite = { id: string; syncName: string; from: string };
type Friend = { id: string; displayName: string; username: string };

export function SyncList({
  syncs,
  invites,
  friends,
}: {
  syncs: SyncCard[];
  invites: Invite[];
  friends: Friend[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [draft, setDraft] = useState({ name: "", goalTitle: "", target: 100, endDate: "" });
  const [invited, setInvited] = useState<string[]>([]);

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createSyncAction({
        ...draft,
        endDate: draft.endDate || null,
        inviteUserIds: invited,
      });
      if (result.error) setError(result.error);
      else if (result.id) router.push(`/sync/${result.id}`);
    });
  }

  return (
    <div className="space-y-6">
      {invites.length > 0 ? (
        <section>
          <p className="font-data text-[11px] tracking-widest text-amber">
            INVITATIONS ({invites.length})
          </p>
          <ul className="mt-3 space-y-2">
            {invites.map((invite) => (
              <li key={invite.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-data text-sm">{invite.syncName}</p>
                  <p className="text-xs text-muted">from {invite.from}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      await respondSyncInviteAction(invite.id, true);
                      router.refresh();
                    })
                  }
                >
                  Join
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    startTransition(async () => {
                      await respondSyncInviteAction(invite.id, false);
                      router.refresh();
                    })
                  }
                >
                  Decline
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {creating ? (
        <section className="card space-y-4 p-5">
          <p className="font-data text-[11px] tracking-widest text-muted">CREATE SYNC</p>

          <Field label="NAME" htmlFor="sync-name">
            <Input
              id="sync-name"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="DSA 100 Day Grind"
              maxLength={48}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="SHARED GOAL" htmlFor="sync-goal">
              <Input
                id="sync-goal"
                value={draft.goalTitle}
                onChange={(e) => setDraft({ ...draft, goalTitle: e.target.value })}
                placeholder="100 Days of DSA"
                maxLength={60}
              />
            </Field>

            <Field label="TARGET DAYS" htmlFor="sync-target">
              <Input
                id="sync-target"
                inputMode="numeric"
                value={String(draft.target)}
                onChange={(e) =>
                  setDraft({ ...draft, target: Number(e.target.value.replace(/[^\d]/g, "") || 0) })
                }
              />
            </Field>
          </div>

          <Field
            label="SEASON ENDS"
            htmlFor="sync-end"
            hint="Optional, but finite commitments get finished. Indefinite ones get abandoned."
          >
            <Input
              id="sync-end"
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              className="max-w-[200px]"
            />
          </Field>

          {friends.length > 0 ? (
            <div>
              <p className="font-data text-[11px] tracking-widest text-muted">INVITE</p>
              <ul className="mt-2 space-y-1">
                {friends.map((friend) => (
                  <li key={friend.id}>
                    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={invited.includes(friend.id)}
                        onChange={(e) =>
                          setInvited((prev) =>
                            e.target.checked
                              ? [...prev, friend.id]
                              : prev.filter((id) => id !== friend.id),
                          )
                        }
                        className="h-4 w-4 accent-[var(--color-amber)]"
                      />
                      <span>{friend.displayName}</span>
                      <span className="font-data text-[11px] text-faint">@{friend.username}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-faint">
              Add friends first. You can only invite people who accepted you.
            </p>
          )}

          {error ? <p className="text-sm text-bad">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={create}
              disabled={!draft.name.trim() || !draft.goalTitle.trim() || draft.target < 1}
            >
              Create SYNC
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : (
        <Button size="sm" onClick={() => setCreating(true)}>
          Create SYNC
        </Button>
      )}

      {syncs.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-ink">No SYNCs yet.</p>
          <p className="mt-1 text-sm text-muted">
            Find people to grow with. Shared direction, individual accountability.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {syncs.map((sync) => (
            <li key={sync.id}>
              <Link href={`/sync/${sync.id}`} className="card block p-4 hover:border-line-strong">
                <p className="font-data text-sm tracking-tight">{sync.name}</p>
                {sync.goalTitle ? (
                  <p className="mt-0.5 text-xs text-muted">{sync.goalTitle}</p>
                ) : null}

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
                  <div
                    className="h-full rounded-full bg-amber"
                    style={{ width: `${sync.pct * 100}%` }}
                  />
                </div>

                <p className="font-data mt-2 text-[11px] text-faint">
                  {Math.round(sync.pct * 100)}% · {sync.memberCount}{" "}
                  {sync.memberCount === 1 ? "member" : "members"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
