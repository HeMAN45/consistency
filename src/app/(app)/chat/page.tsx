import type { Metadata } from "next";

import { ChatShell } from "@/components/chat-shell";
import { listConversations } from "@/lib/chat";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Chat · ~/consistency" };

export default async function ChatPage() {
  const user = await requireUser();
  const conversations = await listConversations(user.id);

  return (
    <div className="rise space-y-4">
      <header>
        <h1 className="font-data text-2xl tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-muted">
          Friends and SYNC rooms. Links open in a new tab and never become tasks.
        </p>
      </header>

      <ChatShell initial={conversations} />
    </div>
  );
}
