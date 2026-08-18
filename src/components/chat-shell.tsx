"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Send, Trash2, Users, Zap } from "lucide-react";

import {
  deleteMessageAction,
  fetchThreadAction,
  refreshConversationsAction,
  sendMessageAction,
} from "@/app/(app)/chat/actions";
import type { ChatMessage, Conversation } from "@/lib/chat";
import { cn } from "@/lib/utils";

const POLL_MS = 6000;

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dayOf(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Polls rather than holding a socket open. New messages arrive within a few
 * seconds while the tab is open, which is the honest first version: a real-time
 * transport is a separate piece of infrastructure, not a checkbox.
 */
export function ChatShell({ initial }: { initial: Conversation[] }) {
  const [conversations, setConversations] = useState(initial);
  const [active, setActive] = useState<Conversation | null>(initial[0] ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  const bottom = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const targetOf = useCallback(
    (conversation: Conversation) =>
      conversation.kind === "direct"
        ? { peerId: conversation.id, syncId: null }
        : { peerId: null, syncId: conversation.id },
    [],
  );

  const load = useCallback(
    async (conversation: Conversation, showSpinner = false) => {
      if (showSpinner) setLoading(true);
      const next = await fetchThreadAction(targetOf(conversation));
      setLoading(false);

      if (next) setMessages(next);
    },
    [targetOf],
  );

  // Open the first conversation, then keep it fresh while the tab is visible.
  useEffect(() => {
    if (!active) return;
    void load(active, true);
  }, [active, load]);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load(active);
      void refreshConversationsAction().then(setConversations);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [active, load]);

  // Only scroll when something actually arrived, so reading history isn't
  // yanked back to the bottom every poll.
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  function send() {
    if (!active || !body.trim()) return;

    const text = body;
    setBody("");
    setError(null);

    startTransition(async () => {
      const result = await sendMessageAction({ ...targetOf(active), body: text });
      if (result.error) {
        setError(result.error);
        setBody(text);
        return;
      }
      await load(active);
      void refreshConversationsAction().then(setConversations);
    });
  }

  if (conversations.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-sm text-ink">Nobody to talk to yet.</p>
        <p className="mt-1 text-sm text-muted">
          Add a friend or join a SYNC and the conversation appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="card h-fit overflow-hidden p-0">
        <ul>
          {conversations.map((conversation) => {
            const selected =
              active?.id === conversation.id && active.kind === conversation.kind;

            return (
              <li key={`${conversation.kind}:${conversation.id}`}>
                <button
                  type="button"
                  onClick={() => setActive(conversation)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0",
                    selected ? "bg-raised" : "hover:bg-raised/60",
                  )}
                >
                  {conversation.kind === "sync" ? (
                    <Zap size={14} className="shrink-0 text-amber" />
                  ) : (
                    <Users size={14} className="shrink-0 text-muted" />
                  )}

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm",
                        selected ? "text-ink" : "text-ink-soft",
                      )}
                    >
                      {conversation.name}
                    </span>
                    {conversation.preview ? (
                      <span className="block truncate text-xs text-faint">
                        {conversation.preview}
                      </span>
                    ) : null}
                  </span>

                  {conversation.unread > 0 ? (
                    <span className="font-data shrink-0 rounded-full bg-amber px-1.5 text-[10px] text-void">
                      {conversation.unread}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="card flex h-[70dvh] flex-col overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          {active?.kind === "sync" ? (
            <Zap size={14} className="text-amber" />
          ) : (
            <Users size={14} className="text-muted" />
          )}
          <p className="font-data text-sm">{active?.name}</p>
          {active?.kind === "sync" ? (
            <span className="font-data ml-auto text-[10px] tracking-widest text-faint">
              EVERYONE IN THIS SYNC
            </span>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading && messages.length === 0 ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing here yet. Send a link or say something.
            </p>
          ) : (
            messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay = !previous || dayOf(previous.at) !== dayOf(message.at);

              return (
                <div key={message.id}>
                  {newDay ? (
                    <p className="font-data my-4 text-center text-[10px] tracking-widest text-faint">
                      {dayOf(message.at).toUpperCase()}
                    </p>
                  ) : null}

                  <div className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%]", message.mine && "text-right")}>
                      {!message.mine && active?.kind === "sync" ? (
                        <p className="font-data mb-1 text-[10px] tracking-widest text-faint">
                          {message.authorName.toUpperCase()}
                        </p>
                      ) : null}

                      <div
                        className={cn(
                          "group inline-block rounded-lg px-3 py-2 text-left text-sm",
                          message.mine
                            ? "bg-amber/15 text-ink"
                            : "border border-line bg-raised text-ink-soft",
                        )}
                      >
                        <p className="break-words whitespace-pre-wrap">{message.body}</p>

                        {message.url ? (
                          <a
                            href={message.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-amber hover:border-amber/50"
                          >
                            <ExternalLink size={11} className="shrink-0" />
                            <span className="truncate">{message.linkTitle ?? message.url}</span>
                          </a>
                        ) : null}
                      </div>

                      <p className="font-data mt-1 flex items-center gap-2 text-[10px] text-faint">
                        {message.mine ? (
                          <button
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                await deleteMessageAction(message.id);
                                if (active) await load(active);
                              })
                            }
                            aria-label="Delete message"
                            className="opacity-0 transition-opacity hover:text-bad focus:opacity-100 group-hover:opacity-100"
                          >
                            <Trash2 size={11} />
                          </button>
                        ) : null}
                        {timeOf(message.at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={bottom} />
        </div>

        {error ? (
          <p role="alert" className="border-t border-line px-5 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}

        <div className="flex items-end gap-2 border-t border-line px-4 py-3">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Message, or paste a link"
            className="font-data max-h-32 flex-1 resize-none rounded-md border border-line bg-void px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-amber focus:outline-none"
          />

          <button
            type="button"
            onClick={send}
            disabled={!body.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber text-void transition-colors hover:bg-amber-soft disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
