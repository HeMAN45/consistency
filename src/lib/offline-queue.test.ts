import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearAll, enqueue, flush, pendingCount } from "@/lib/offline-queue";

// Minimal localStorage so the queue can be tested without a browser.
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
    dispatchEvent: () => true,
  });
  vi.stubGlobal("CustomEvent", class {});
  clearAll();
});

describe("offline queue", () => {
  it("collapses repeated toggles of the same task and day", () => {
    enqueue({ taskId: "t1", date: "2026-08-15", completed: true });
    enqueue({ taskId: "t1", date: "2026-08-15", completed: false });
    enqueue({ taskId: "t1", date: "2026-08-15", completed: true });

    expect(pendingCount()).toBe(1);
  });

  it("keeps the same task on different days apart", () => {
    enqueue({ taskId: "t1", date: "2026-08-15", completed: true });
    enqueue({ taskId: "t1", date: "2026-08-14", completed: true });

    expect(pendingCount()).toBe(2);
  });

  it("clears entries the server accepts", async () => {
    enqueue({ taskId: "t1", date: "2026-08-15", completed: true });
    enqueue({ taskId: "t2", date: "2026-08-15", completed: true });

    const result = await flush(async () => undefined);

    expect(result.sent).toBe(2);
    expect(pendingCount()).toBe(0);
  });

  it("drops entries the server refuses, rather than retrying forever", async () => {
    enqueue({ taskId: "t1", date: "2020-01-01", completed: true });

    const result = await flush(async () => ({ error: "Outside the window" }));

    expect(result.failed).toBe(1);
    expect(pendingCount()).toBe(0);
  });

  it("keeps entries queued when the network throws", async () => {
    enqueue({ taskId: "t1", date: "2026-08-15", completed: true });

    await flush(async () => {
      throw new Error("offline");
    });

    expect(pendingCount()).toBe(1);
  });
});
