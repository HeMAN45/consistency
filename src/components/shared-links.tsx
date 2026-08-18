"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Send, Trash2 } from "lucide-react";

import {
  deleteLinkAction,
  markLinkSeenAction,
  sendLinkAction,
} from "@/app/(app)/friends/link-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Received = {
  id: string;
  url: string;
  title: string;
  note: string | null;
  at: string;
  seen: boolean;
  fromName: string;
};

type Sent = { id: string; title: string; at: string; seen: boolean; toName: string };

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SharedLinks({
  friends,
  received,
  sent,
}: {
  friends: { id: string; displayName: string }[];
  received: Received[];
  sent: Sent[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState(friends[0]?.id ?? "");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [showSent, setShowSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const unseen = received.filter((link) => !link.seen).length;

  function run(fn: () => Promise<{ error?: string; message?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setMessage({ text: result.error, bad: true });
      else {
        if (result.message) setMessage({ text: result.message });
        router.refresh();
      }
    });
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-data text-[11px] tracking-widest text-muted">SHARED LINKS</p>
          <p className="mt-1 text-xs text-faint">
            Pass a problem or a video along. It creates no task and changes no score.
          </p>
        </div>

        {friends.length > 0 && !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-data flex items-center gap-1.5 text-[10px] tracking-widest text-amber hover:text-amber-soft"
          >
            <Send size={12} /> SHARE
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <select
            value={toUserId}
            onChange={(event) => setToUserId(event.target.value)}
            aria-label="Send to"
            className="font-data h-10 w-full rounded-md border border-line bg-void px-2 text-sm text-ink focus:border-amber focus:outline-none"
          >
            {friends.map((friend) => (
              <option key={friend.id} value={friend.id}>
                {friend.displayName}
              </option>
            ))}
          </select>

          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://leetcode.com/problems/two-sum/"
            autoFocus
          />

          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="One line, optional"
            maxLength={200}
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !url.trim() || !toUserId}
              onClick={() => {
                run(() => sendLinkAction({ toUserId, url, note }));
                setUrl("");
                setNote("");
                setOpen(false);
              }}
            >
              Send
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className={cn("mt-3 text-sm", message.bad ? "text-bad" : "text-good")}>{message.text}</p>
      ) : null}

      {received.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-line pt-4">
          {received.map((link) => (
            <li key={link.id} className="flex items-start gap-3 py-2">
              <span
                aria-hidden
                className={cn(
                  "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                  link.seen ? "bg-line-strong" : "bg-amber",
                )}
              />

              <div className="min-w-0 flex-1">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (!link.seen) void markLinkSeenAction(link.id).then(() => router.refresh());
                  }}
                  className={cn(
                    "flex items-center gap-1.5 truncate text-sm hover:text-amber",
                    link.seen ? "text-muted" : "text-ink",
                  )}
                >
                  {link.title}
                  <ExternalLink size={11} className="shrink-0 text-amber" />
                </a>

                {link.note ? <p className="mt-0.5 text-xs text-muted">{link.note}</p> : null}

                <p className="font-data mt-0.5 text-[10px] tracking-widest text-faint">
                  {link.fromName.toUpperCase()} · {ago(link.at).toUpperCase()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => run(() => deleteLinkAction(link.id))}
                aria-label={`Remove ${link.title}`}
                className="shrink-0 text-faint hover:text-bad"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
          {friends.length === 0
            ? "Add a friend and you can pass links back and forth."
            : "Nothing shared with you yet."}
        </p>
      )}

      {sent.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowSent((value) => !value)}
            className="font-data text-[10px] tracking-widest text-muted hover:text-ink"
          >
            SENT ({sent.length})
          </button>

          {showSent ? (
            <ul className="mt-2 space-y-1">
              {sent.map((link) => (
                <li key={link.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-muted">{link.title}</span>
                  <span className="font-data shrink-0 text-[10px] tracking-widest text-faint">
                    {link.toName.toUpperCase()} · {link.seen ? "OPENED" : "UNREAD"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {unseen > 0 ? (
        <p className="font-data mt-3 text-[10px] tracking-widest text-amber">{unseen} UNREAD</p>
      ) : null}
    </section>
  );
}
