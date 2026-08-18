import type { Metadata } from "next";

import { ProblemsPanel } from "@/components/problems-panel";
import { listProblems, problemStats } from "@/lib/problems";
import { requireUser } from "@/lib/session";
import { listSyncs } from "@/lib/sync";

export const metadata: Metadata = { title: "Problems · ~/consistency" };

export default async function ProblemsPage() {
  const user = await requireUser();

  const [problems, stats, syncs] = await Promise.all([
    listProblems(user.id, user.timezone),
    problemStats(user.id, user.timezone),
    listSyncs(user.id),
  ]);

  return (
    <div className="rise space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-data text-2xl tracking-tight">Problems</h1>
          <p className="mt-1 text-sm text-muted">
            LeetCode, Codeforces, anywhere. Solving one counts as a task.
          </p>
        </div>

        <p className="font-data text-sm tabular-nums text-muted">
          <span className="text-amber">{stats.solved}</span> / {stats.total} solved
        </p>
      </header>

      <ProblemsPanel
        problems={problems}
        syncs={syncs.map((sync) => ({ id: sync.id, name: sync.name }))}
      />
    </div>
  );
}
